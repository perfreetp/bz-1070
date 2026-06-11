import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { CheckInRecord, Child, Guardian, Organization } from '../database/associations';
import { Op } from 'sequelize';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('childId').optional().isUUID(),
    query('organizationId').optional().isUUID(),
    query('type').optional().isIn(['enter', 'exit']),
    query('status').optional().isIn(['success', 'failed', 'pending_verification']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = getPaginationParams(req);
      const { childId, organizationId, type, status, startDate, endDate } = req.query;

      const where: any = {};
      if (childId) where.childId = childId;
      if (organizationId) where.organizationId = organizationId;
      if (type) where.type = type;
      if (status) where.status = status;
      if (startDate && endDate) {
        where.createdAt = { [Op.between]: [new Date(startDate as string), new Date(endDate as string)] };
      }

      if (req.user!.role === 'parent') {
        const guardianChildIds = (
          await Guardian.findAll({
            where: { userId: req.user!.userId, status: 'active' },
            attributes: ['childId']
          })
        ).map(g => g.childId);
        where.childId = { [Op.in]: guardianChildIds.length > 0 ? guardianChildIds : [''] };
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (!where.organizationId) where.organizationId = req.user!.organizationId;
      }

      const { count, rows } = await CheckInRecord.findAndCountAll({
        where,
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar', 'studentId', 'grade', 'class'] },
          { association: 'organization', attributes: ['id', 'name', 'type'] },
          { association: 'device', attributes: ['id', 'deviceId'] },
          {
            association: 'guardian',
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
          },
          { association: 'verifier', attributes: ['id', 'realName'] }
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
      const record = await CheckInRecord.findByPk(req.params.id, {
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'organization', attributes: ['id', 'name'] },
          { association: 'device', attributes: ['id', 'deviceId'] },
          {
            association: 'guardian',
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone'] }]
          },
          { association: 'verifier', attributes: ['id', 'realName'] }
        ]
      });

      if (!record) throw new AppError('记录不存在', 404);

      if (req.user!.role === 'parent') {
        const isGuardian = await Guardian.findOne({
          where: { childId: record.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看此记录', 403);
      }

      return successResponse(res, record);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate([
    body('childId').isUUID().withMessage('儿童ID无效'),
    body('organizationId').optional().isUUID(),
    body('type').isIn(['enter', 'exit']).withMessage('类型无效'),
    body('method').isIn(['device', 'gate', 'manual', 'face', 'qr']).withMessage('打卡方式无效'),
    body('guardianId').optional().isUUID(),
    body('latitude').optional().isFloat(),
    body('longitude').optional().isFloat()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        childId, organizationId, type, method, deviceId, guardianId,
        latitude, longitude, gateName, photoUrl
      } = req.body;

      const child = await Child.findByPk(childId);
      if (!child) throw new AppError('儿童不存在', 404);

      let orgId = organizationId;
      if (!orgId && child.organizationId) orgId = child.organizationId;
      if (!orgId) throw new AppError('请指定机构或儿童已关联机构', 400);

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (orgId !== req.user!.organizationId) {
          throw new AppError('无权限为此机构创建记录', 403);
        }
      }

      let recordStatus: 'success' | 'pending_verification' = 'success';
      let verificationNote: string | undefined;
      let verifiedBy: string | undefined;

      if (type === 'exit' && guardianId) {
        const guardian = await Guardian.findByPk(guardianId);
        if (!guardian || !guardian.canPickup || guardian.status !== 'active') {
          recordStatus = 'pending_verification';
          verificationNote = '接送人权限校验失败，需要人工确认';
        } else if (guardian.expiresAt && new Date(guardian.expiresAt) < new Date()) {
          recordStatus = 'pending_verification';
          verificationNote = '接送人授权已过期，需要人工确认';
        }
      }

      if (method === 'manual') {
        verifiedBy = req.user!.userId;
      }

      const record = await CheckInRecord.create({
        childId,
        organizationId: orgId,
        type,
        method,
        deviceId,
        guardianId,
        latitude,
        longitude,
        gateName,
        photoUrl,
        status: recordStatus,
        verifiedBy,
        verificationNote
      });

      return successResponse(res, record, '打卡记录创建成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id/verify',
  requireRole('school_admin', 'scenic_admin', 'system_admin'),
  validate([
    param('id').isUUID(),
    body('status').isIn(['success', 'failed']).withMessage('审核结果无效'),
    body('verificationNote').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, verificationNote } = req.body;

      const record = await CheckInRecord.findByPk(req.params.id);
      if (!record) throw new AppError('记录不存在', 404);

      if (record.status !== 'pending_verification') {
        throw new AppError('此记录无需审核', 400);
      }

      if (req.user!.organizationId && record.organizationId !== req.user!.organizationId) {
        throw new AppError('无权限审核此记录', 403);
      }

      await record.update({
        status,
        verifiedBy: req.user!.userId,
        verificationNote
      });

      return successResponse(res, record, status === 'success' ? '审核通过' : '审核拒绝');
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/today/child/:childId',
  validate([param('childId').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date();
      const dayStart = new Date(today);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(today);
      dayEnd.setHours(23, 59, 59, 999);

      if (req.user!.role === 'parent') {
        const isGuardian = await Guardian.findOne({
          where: { childId: req.params.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看此儿童记录', 403);
      }

      const records = await CheckInRecord.findAll({
        where: {
          childId: req.params.childId,
          createdAt: { [Op.between]: [dayStart, dayEnd] }
        },
        include: [
          { association: 'organization', attributes: ['id', 'name'] },
          {
            association: 'guardian',
            include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }]
          }
        ],
        order: [['createdAt', 'ASC']]
      });

      const enters = records.filter(r => r.type === 'enter' && r.status === 'success');
      const exits = records.filter(r => r.type === 'exit' && r.status === 'success');

      let currentStatus = 'not_arrived';
      if (enters.length > 0 && exits.length === 0) currentStatus = 'in';
      else if (exits.length > 0) currentStatus = 'left';

      return successResponse(res, {
        date: today.toISOString().split('T')[0],
        currentStatus,
        enterCount: enters.length,
        exitCount: exits.length,
        lastEnter: enters.length > 0 ? enters[enters.length - 1] : null,
        lastExit: exits.length > 0 ? exits[exits.length - 1] : null,
        records
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
