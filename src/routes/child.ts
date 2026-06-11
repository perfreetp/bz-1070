import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Child, Guardian, Device } from '../database/associations';
import { Op } from 'sequelize';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('name').optional().isString(),
    query('status').optional().isIn(['normal', 'missing', 'rescued']),
    query('organizationId').optional().isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = getPaginationParams(req);
      const { name, status, organizationId } = req.query;

      const where: any = {};
      if (name) where.name = { [Op.like]: `%${name}%` };
      if (status) where.status = status;
      if (organizationId) where.organizationId = organizationId;

      if (req.user!.role === 'parent') {
        const guardianChildIds = (
          await Guardian.findAll({
            where: { userId: req.user!.userId, status: 'active' },
            attributes: ['childId']
          })
        ).map(g => g.childId);
        where.id = { [Op.in]: guardianChildIds.length > 0 ? guardianChildIds : [''] };
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (!where.organizationId) where.organizationId = req.user!.organizationId;
      }

      const { count, rows } = await Child.findAndCountAll({
        where,
        include: [
          { association: 'organization', attributes: ['id', 'name', 'type'] },
          {
            association: 'guardians',
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
          },
          {
            association: 'devices',
            attributes: ['id', 'deviceId', 'deviceType', 'status', 'batteryLevel']
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset
      });

      return paginatedResponse(res, rows, count, page, pageSize);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  validate([param('id').isUUID().withMessage('无效的儿童ID')]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const child = await Child.findByPk(req.params.id, {
        include: [
          { association: 'organization', attributes: ['id', 'name', 'type'] },
          {
            association: 'guardians',
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar', 'role'] }]
          },
          {
            association: 'devices',
            attributes: ['id', 'deviceId', 'deviceType', 'model', 'status', 'batteryLevel', 'lastOnlineAt']
          },
          {
            association: 'geofences',
            where: { isActive: true },
            required: false
          }
        ]
      });

      if (!child) throw new AppError('儿童档案不存在', 404);

      if (req.user!.role === 'parent') {
        const isGuardian = await Guardian.findOne({
          where: { childId: child.id, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看此儿童信息', 403);
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (child.organizationId !== req.user!.organizationId) {
          throw new AppError('无权限查看此儿童信息', 403);
        }
      }

      return successResponse(res, child);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate([
    body('name').notEmpty().isLength({ max: 50 }).withMessage('姓名不能为空'),
    body('gender').isIn(['male', 'female']).withMessage('性别无效'),
    body('birthDate').notEmpty().isISO8601().withMessage('出生日期无效'),
    body('organizationId').optional().isUUID(),
    body('studentId').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name, gender, birthDate, idCardNumber, avatar, height, weight,
        bloodType, healthInfo, address, organizationId, studentId, class: className, grade
      } = req.body;

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin')) {
        if (!organizationId && req.user!.organizationId) {
          req.body.organizationId = req.user!.organizationId;
        }
      }

      const child = await Child.create({
        name, gender, birthDate, idCardNumber, avatar, height, weight,
        bloodType, healthInfo, address, organizationId: organizationId || req.user!.organizationId,
        studentId, class: className, grade
      });

      if (req.user!.role === 'parent') {
        await Guardian.create({
          childId: child.id,
          userId: req.user!.userId,
          relation: 'other',
          isPrimary: true,
          canReceiveAlerts: true,
          canViewLocation: true,
          canPickup: true,
          canManage: true,
          authorizedBy: req.user!.userId,
          status: 'active'
        });
      }

      return successResponse(res, child, '儿童档案创建成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate([
    param('id').isUUID(),
    body('name').optional().isLength({ max: 50 }),
    body('gender').optional().isIn(['male', 'female']),
    body('birthDate').optional().isISO8601()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const child = await Child.findByPk(req.params.id);
      if (!child) throw new AppError('儿童档案不存在', 404);

      if (req.user!.role === 'parent') {
        const canManage = await Guardian.findOne({
          where: { childId: child.id, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!canManage) throw new AppError('无权限修改此儿童信息', 403);
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (child.organizationId !== req.user!.organizationId) {
          throw new AppError('无权限修改此儿童信息', 403);
        }
      }

      const updateData = { ...req.body };
      if (updateData.class) {
        updateData.class = updateData.class;
      }

      await child.update(updateData);
      return successResponse(res, child, '儿童档案更新成功');
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  requireRole('system_admin', 'school_admin', 'scenic_admin'),
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const child = await Child.findByPk(req.params.id);
      if (!child) throw new AppError('儿童档案不存在', 404);

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (child.organizationId !== req.user!.organizationId) {
          throw new AppError('无权限删除此儿童信息', 403);
        }
      }

      await child.destroy();
      return successResponse(res, null, '儿童档案删除成功');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
