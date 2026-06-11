import { Router, Request, Response, NextFunction } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { successResponse, AppError } from '../utils/response';
import { generateToken, comparePassword, hashPassword } from '../utils/auth';
import { User } from '../database/associations';
import { Op } from 'sequelize';

const router = Router();

router.post(
  '/login',
  validate([
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password } = req.body;

      const user = await User.findOne({
        where: { [Op.or]: [{ username }, { phone: username }] },
        include: [{ association: 'organization', attributes: ['id', 'name', 'type'] }]
      });

      if (!user) {
        throw new AppError('用户不存在', 404, 'USER_NOT_FOUND');
      }

      if (user.status !== 'active') {
        throw new AppError('账号已被禁用', 403, 'USER_DISABLED');
      }

      const isValid = await comparePassword(password, user.password);
      if (!isValid) {
        throw new AppError('密码错误', 401, 'PASSWORD_WRONG');
      }

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId
      });

      return successResponse(res, {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.realName,
          phone: user.phone,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          organization: (user as any).organization
        }
      }, '登录成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/register',
  validate([
    body('username').notEmpty().isLength({ min: 4, max: 50 }).withMessage('用户名长度4-50位'),
    body('password').notEmpty().isLength({ min: 6, max: 50 }).withMessage('密码长度6-50位'),
    body('realName').notEmpty().withMessage('真实姓名不能为空'),
    body('phone').notEmpty().isMobilePhone('zh-CN').withMessage('请输入有效的手机号')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, password, realName, phone, email } = req.body;

      const existing = await User.findOne({
        where: { [Op.or]: [{ username }, { phone }] }
      });

      if (existing) {
        throw new AppError('用户名或手机号已存在', 400, 'USER_EXISTS');
      }

      const hashedPassword = await hashPassword(password);

      const user = await User.create({
        username,
        password: hashedPassword,
        realName,
        phone,
        email,
        role: 'parent',
        status: 'active'
      });

      const token = generateToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      return successResponse(res, {
        token,
        user: {
          id: user.id,
          username: user.username,
          realName: user.realName,
          phone: user.phone,
          email: user.email,
          role: user.role
        }
      }, '注册成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('未登录', 401);

    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['password'] },
      include: [{ association: 'organization', attributes: ['id', 'name', 'type'] }]
    });

    if (!user) throw new AppError('用户不存在', 404);

    return successResponse(res, user);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, (req: Request, res: Response) => {
  successResponse(res, null, '退出成功');
});

export default router;
