import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Guardian, User, Child } from '../database/associations';
import { Op } from 'sequelize';
import { hashPassword } from '../utils/auth';
import * as crypto from 'crypto';

function generatePickupQrCode(childId: string, userId: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  const childPart = childId.split('-')[0];
  const userPart = userId.split('-')[0];
  return `PICK-${childPart}-${userPart}-${timestamp}${random}`.toUpperCase();
}

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
          const pickupEnabled = canPickup || existing.canPickup;
          const newQrCode = pickupEnabled
            ? (existing.pickupQrCode || generatePickupQrCode(childId, user.id))
            : existing.pickupQrCode;

          await existing.update({
            status: 'active',
            relation,
            canPickup: pickupEnabled,
            canReceiveAlerts: canReceiveAlerts !== false,
            canViewLocation: canViewLocation !== false,
            expiresAt,
            authorizedBy: req.user!.userId,
            pickupQrCode: newQrCode
          });

          return successResponse(res, {
            guardian: existing,
            pickupQrCode: pickupEnabled ? newQrCode : undefined,
            pickupEnabled
          }, pickupEnabled ? '授权关系已恢复，已生成接送二维码' : '授权关系已恢复');
        }
        throw new AppError('该用户已被授权', 400);
      }

      const isPickupEnabled = canPickup || false;
      const pickupQrCodeValue = isPickupEnabled ? generatePickupQrCode(childId, user.id) : undefined;

      const guardian = await Guardian.create({
        childId,
        userId: user.id,
        relation,
        isPrimary: false,
        canPickup: isPickupEnabled,
        canReceiveAlerts: canReceiveAlerts !== false,
        canViewLocation: canViewLocation !== false,
        canManage: false,
        status: 'active',
        expiresAt,
        authorizedBy: req.user!.userId,
        pickupQrCode: pickupQrCodeValue
      });

      return successResponse(res, {
        guardian,
        pickupQrCode: pickupQrCodeValue,
        pickupEnabled: isPickupEnabled,
        hint: isPickupEnabled
          ? '已为该亲友生成接送二维码，请将此码告知对方或在家长App中展示，门禁扫码即可核验接送身份'
          : undefined
      }, '授权成功', 201);
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

      let where: any = { childId, status: 'active' };
      if (guardianId) where.id = guardianId;
      if (qrCode) where.pickupQrCode = qrCode;

      let matchReason = '';
      let guardian = null;

      if (qrCode) {
        guardian = await Guardian.findOne({
          where: { childId, status: 'active', pickupQrCode: qrCode },
          include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
        });
        if (guardian) matchReason = '接送二维码匹配成功';
      }

      if (!guardian && guardianId) {
        guardian = await Guardian.findOne({
          where: { ...where, canPickup: true },
          include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
        });
        if (guardian) matchReason = '授权ID匹配成功';
      }

      if (!guardian && phone) {
        const user = await User.findOne({ where: { phone } });
        if (user) {
          guardian = await Guardian.findOne({
            where: { childId, userId: user.id, status: 'active' },
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
          });
          if (guardian && guardian.canPickup) {
            matchReason = '手机号匹配成功';
          } else if (guardian && !guardian.canPickup) {
            return successResponse(res, {
              authorized: false,
              reason: 'NO_PICKUP_PERMISSION',
              message: '该人员已被授权但未开启接送权限，请家长在App中为其开启接送权限',
              guardian: guardian ? {
                id: guardian.id,
                relation: guardian.relation,
                user: (guardian as any).user
              } : null
            });
          }
        }
      }

      if (!guardian) {
        return successResponse(res, {
          authorized: false,
          reason: 'NOT_FOUND',
          message: qrCode
            ? '二维码无效或已失效，请确认是否为该儿童最新接送码，或请家长重新生成'
            : '未找到匹配的接送授权，请联系家长添加接送权限',
          hint: qrCode
            ? '提示：接送二维码为一次性且与儿童绑定，不同儿童接送码不同'
            : '提示：家长可在家长App → 亲友管理 → 为亲友开启接送权限并获取接送二维码'
        });
      }

      if (!guardian.canPickup) {
        return successResponse(res, {
          authorized: false,
          reason: 'NO_PICKUP_PERMISSION',
          message: '该人员已被授权但未开启接送权限，请家长在App中为其开启',
          guardian: {
            id: guardian.id,
            relation: guardian.relation,
            user: (guardian as any).user
          }
        });
      }

      if (guardian.expiresAt && new Date(guardian.expiresAt) < new Date()) {
        return successResponse(res, {
          authorized: false,
          reason: 'EXPIRED',
          message: `接送授权已于 ${new Date(guardian.expiresAt).toLocaleString('zh-CN')} 过期`,
          guardian: {
            id: guardian.id,
            relation: guardian.relation,
            user: (guardian as any).user
          }
        });
      }

      return successResponse(res, {
        authorized: true,
        verifiedBy: matchReason,
        guardian: {
          id: guardian.id,
          relation: guardian.relation,
          pickupQrCode: guardian.pickupQrCode,
          expiresAt: guardian.expiresAt,
          user: (guardian as any).user
        },
        child: { id: childId },
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

      const allowedFields = ['relation', 'canPickup', 'canReceiveAlerts', 'canViewLocation', 'canManage', 'expiresAt', 'status'];
      const updateData: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (updateData.canPickup === true && !guardian.pickupQrCode) {
        updateData.pickupQrCode = generatePickupQrCode(guardian.childId, guardian.userId);
      }

      if (updateData.canPickup === false) {
        updateData.pickupQrCode = null as any;
      }

      await guardian.update(updateData);

      return successResponse(res, {
        guardian,
        pickupQrCode: updateData.canPickup ? (guardian.pickupQrCode || updateData.pickupQrCode) : undefined,
        hint: updateData.canPickup && updateData.pickupQrCode
          ? '已为该亲友开启接送权限并生成接送二维码'
          : undefined
      }, '授权信息更新成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/refresh-pickup-code',
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guardian = await Guardian.findByPk(req.params.id, {
        include: [{ association: 'user', attributes: ['id', 'realName', 'phone'] }]
      });
      if (!guardian) throw new AppError('授权关系不存在', 404);

      if (req.user!.role === 'parent') {
        const isManager = await Guardian.findOne({
          where: { childId: guardian.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!isManager) throw new AppError('无权限刷新此接送码', 403);
      }

      if (!guardian.canPickup) {
        throw new AppError('该亲友未开启接送权限，请先开启后再生成接送码', 400, 'PICKUP_DISABLED');
      }

      const oldQrCode = guardian.pickupQrCode;
      const newQrCode = generatePickupQrCode(guardian.childId, guardian.userId);
      await guardian.update({ pickupQrCode: newQrCode });

      return successResponse(res, {
        guardianId: guardian.id,
        oldPickupQrCode: oldQrCode,
        newPickupQrCode: newQrCode,
        user: (guardian as any).user,
        expiresAt: guardian.expiresAt,
        hint: '旧接送码已失效，请将新接送码告知亲友或在家长App中重新展示'
      }, '接送二维码已刷新，旧码已作废');
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
