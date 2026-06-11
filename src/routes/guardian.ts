import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Guardian, User, Child } from '../database/associations';
import { Op } from 'sequelize';
import { hashPassword } from '../utils/auth';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate([
    query('childId').optional().isUUID(),
    query('userId').optional().isUUID(),
    query('status').optional().isIn(['active', 'revoked', 'pending'])
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = getPaginationParams(req);
      const { childId, status } = req.query;

      const where: any = {};
      if (childId) where.childId = childId;
      if (status) where.status = status;

      if (req.user!.role === 'parent') {
        where.userId = req.user!.userId;
      }

      const { count, rows } = await Guardian.findAndCountAll({
        where,
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar', 'organizationId'] },
          { association: 'user', attributes: ['id', 'username', 'realName', 'phone', 'email', 'avatar', 'role'] },
          { association: 'authorizer', attributes: ['id', 'realName'] }
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
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guardian = await Guardian.findByPk(req.params.id, {
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'user', attributes: ['id', 'username', 'realName', 'phone', 'email', 'avatar'] },
          { association: 'authorizer', attributes: ['id', 'realName'] }
        ]
      });

      if (!guardian) throw new AppError('授权关系不存在', 404);

      if (req.user!.role === 'parent' && guardian.userId !== req.user!.userId) {
        const isManager = await Guardian.findOne({
          where: { childId: guardian.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!isManager) throw new AppError('无权限查看此授权', 403);
      }

      return successResponse(res, guardian);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate([
    body('childId').isUUID().withMessage('儿童ID无效'),
    body('phone').notEmpty().withMessage('手机号不能为空'),
    body('realName').notEmpty().withMessage('姓名不能为空'),
    body('relation').isIn(['father', 'mother', 'grandfather', 'grandmother', 'uncle', 'aunt', 'brother', 'sister', 'other']).withMessage('关系无效'),
    body('canPickup').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { childId, phone, realName, relation, canPickup, canReceiveAlerts, canViewLocation, expiresAt } = req.body;

      const child = await Child.findByPk(childId);
      if (!child) throw new AppError('儿童不存在', 404);

      if (req.user!.role === 'parent') {
        const isManager = await Guardian.findOne({
          where: { childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!isManager) throw new AppError('无权限为此儿童添加授权', 403);
      }

      let user = await User.findOne({ where: { phone } });
      if (!user) {
        const randomPassword = Math.random().toString(36).slice(-8);
        user = await User.create({
          username: phone,
          password: await hashPassword(randomPassword),
          realName,
          phone,
          role: 'parent',
          status: 'active'
        });
      }

      const existing = await Guardian.findOne({
        where: { childId, userId: user.id }
      });

      if (existing) {
        if (existing.status === 'revoked') {
          await existing.update({
            status: 'active',
            relation,
            canPickup: canPickup || false,
            canReceiveAlerts: canReceiveAlerts !== false,
            canViewLocation: canViewLocation !== false,
            expiresAt,
            authorizedBy: req.user!.userId
          });
          return successResponse(res, existing, '授权关系已恢复');
        }
        throw new AppError('该用户已被授权', 400);
      }

      const guardian = await Guardian.create({
        childId,
        userId: user.id,
        relation,
        isPrimary: false,
        canPickup: canPickup || false,
        canReceiveAlerts: canReceiveAlerts !== false,
        canViewLocation: canViewLocation !== false,
        canManage: false,
        status: 'active',
        expiresAt,
        authorizedBy: req.user!.userId
      });

      return successResponse(res, guardian, '授权成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/verify-pickup',
  validate([
    body('childId').isUUID().withMessage('儿童ID无效'),
    body('guardianId').optional().isUUID(),
    body('qrCode').optional().isString(),
    body('phone').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { childId, guardianId, qrCode, phone } = req.body;

      let where: any = { childId, status: 'active', canPickup: true };
      if (guardianId) where.id = guardianId;
      if (qrCode) where.pickupQrCode = qrCode;

      let guardian = await Guardian.findOne({
        where,
        include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
      });

      if (!guardian && phone) {
        const user = await User.findOne({ where: { phone } });
        if (user) {
          guardian = await Guardian.findOne({
            where: { childId, userId: user.id, status: 'active', canPickup: true },
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
          });
        }
      }

      if (!guardian) {
        return successResponse(res, {
          authorized: false,
          message: '该人员无接送权限'
        });
      }

      if (guardian.expiresAt && new Date(guardian.expiresAt) < new Date()) {
        return successResponse(res, {
          authorized: false,
          message: '接送授权已过期'
        });
      }

      return successResponse(res, {
        authorized: true,
        guardian: {
          id: guardian.id,
          relation: guardian.relation,
          user: (guardian as any).user
        },
        message: '接送权限验证通过'
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guardian = await Guardian.findByPk(req.params.id);
      if (!guardian) throw new AppError('授权关系不存在', 404);

      if (req.user!.role === 'parent') {
        const isManager = await Guardian.findOne({
          where: { childId: guardian.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!isManager) throw new AppError('无权限修改此授权', 403);
      }

      if (guardian.isPrimary && req.body.isPrimary === false) {
        throw new AppError('不能取消主监护人身份', 400);
      }

      await guardian.update(req.body);
      return successResponse(res, guardian, '授权信息更新成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/revoke',
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guardian = await Guardian.findByPk(req.params.id);
      if (!guardian) throw new AppError('授权关系不存在', 404);

      if (req.user!.role === 'parent') {
        const isManager = await Guardian.findOne({
          where: { childId: guardian.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!isManager && guardian.userId !== req.user!.userId) {
          throw new AppError('无权限撤销此授权', 403);
        }
      }

      if (guardian.isPrimary) {
        throw new AppError('不能撤销主监护人授权', 400);
      }

      await guardian.update({ status: 'revoked' });
      return successResponse(res, null, '授权已撤销');
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/children/my',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role !== 'parent') {
        return successResponse(res, [], '非家长用户无监护儿童');
      }

      const guardians = await Guardian.findAll({
        where: { userId: req.user!.userId, status: 'active' },
        include: [
          {
            association: 'child',
            include: [
              { association: 'devices', attributes: ['id', 'deviceId', 'status', 'batteryLevel'] },
              { association: 'organization', attributes: ['id', 'name', 'type'] }
            ]
          }
        ],
        order: [['isPrimary', 'DESC']]
      });

      const children = guardians.map(g => ({
        relation: g.relation,
        isPrimary: g.isPrimary,
        canReceiveAlerts: g.canReceiveAlerts,
        canViewLocation: g.canViewLocation,
        canPickup: g.canPickup,
        canManage: g.canManage,
        child: (g as any).child
      }));

      return successResponse(res, children);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
