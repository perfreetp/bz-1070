import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Alert, AlertPush, Guardian, Child } from '../database/associations';
import { Op } from 'sequelize';
import { AlertService } from '../services/AlertService';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'processing', 'resolved', 'ignored']),
    query('type').optional().isIn(['geofence_exit', 'geofence_enter', 'long_stay', 'tamper', 'low_battery', 'offline', 'missing', 'sos']),
    query('level').optional().isIn(['info', 'warning', 'danger']),
    query('childId').optional().isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = getPaginationParams(req);
      const { status, type, level, childId } = req.query;

      if (req.user!.role === 'parent') {
        const { rows, count } = await AlertService.getUserAlerts(req.user!.userId, {
          status: status as string,
          type: type as string,
          page,
          pageSize
        });

        if (childId) {
          const filtered = rows.filter(a => a.childId === childId);
          return paginatedResponse(res, filtered, filtered.length, page, pageSize);
        }

        return paginatedResponse(res, rows, count, page, pageSize);
      }

      const where: any = {};
      if (status) where.status = status;
      if (type) where.type = type;
      if (level) where.level = level;
      if (childId) where.childId = childId;

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        const orgChildren = await Child.findAll({
          where: { organizationId: req.user!.organizationId },
          attributes: ['id']
        });
        where.childId = {
          [Op.in]: orgChildren.map(c => c.id)
        };
      }

      const { count, rows } = await Alert.findAndCountAll({
        where,
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'device', attributes: ['id', 'deviceId', 'deviceType'] },
          { association: 'geofence', attributes: ['id', 'name', 'type'] },
          { association: 'handler', attributes: ['id', 'realName'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (page - 1) * pageSize
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
      const alert = await Alert.findByPk(req.params.id, {
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'device', attributes: ['id', 'deviceId', 'deviceType', 'batteryLevel'] },
          { association: 'geofence', attributes: ['id', 'name', 'type', 'radius'] },
          { association: 'handler', attributes: ['id', 'realName'] },
          {
            association: 'pushes',
            include: [{ association: 'guardian', include: [{ association: 'user', attributes: ['id', 'realName', 'phone'] }] }]
          }
        ]
      });

      if (!alert) throw new AppError('告警不存在', 404);

      if (req.user!.role === 'parent') {
        const isGuardian = await Guardian.findOne({
          where: { childId: alert.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看此告警', 403);
      }

      return successResponse(res, alert);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id/handle',
  validate([
    param('id').isUUID(),
    body('status').isIn(['processing', 'resolved', 'ignored']).withMessage('处理状态无效'),
    body('handleNote').optional().isString()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, handleNote } = req.body;

      const alert = await Alert.findByPk(req.params.id);
      if (!alert) throw new AppError('告警不存在', 404);

      if (req.user!.role === 'parent') {
        const canReceive = await Guardian.findOne({
          where: { childId: alert.childId, userId: req.user!.userId, status: 'active', canReceiveAlerts: true }
        });
        if (!canReceive) throw new AppError('无权限处理此告警', 403);
      }

      const updated = await AlertService.handleAlert(
        req.params.id,
        req.user!.userId,
        status as 'processing' | 'resolved' | 'ignored',
        handleNote
      );

      return successResponse(res, updated, '告警处理成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/re-push',
  requireRole('system_admin', 'school_admin', 'scenic_admin'),
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await Alert.findByPk(req.params.id);
      if (!alert) throw new AppError('告警不存在', 404);

      const pushes = await AlertService.createAlertPushes(alert.id, alert.childId);

      return successResponse(res, { pushCount: pushes.length }, '告警已重新推送');
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id/pushes',
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alert = await Alert.findByPk(req.params.id);
      if (!alert) throw new AppError('告警不存在', 404);

      if (req.user!.role === 'parent') {
        const isGuardian = await Guardian.findOne({
          where: { childId: alert.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看推送记录', 403);
      }

      const pushes = await AlertPush.findAll({
        where: { alertId: req.params.id },
        include: [
          { association: 'guardian', include: [{ association: 'user', attributes: ['id', 'realName', 'phone', 'avatar'] }] }
        ],
        order: [['createdAt', 'DESC']]
      });

      return successResponse(res, pushes);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/statistics/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let where: any = {};

      if (req.user!.role === 'parent') {
        const guardianChildIds = (
          await Guardian.findAll({
            where: { userId: req.user!.userId, status: 'active' },
            attributes: ['childId']
          })
        ).map(g => g.childId);
        where.childId = { [Op.in]: guardianChildIds };
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        const orgChildren = await Child.findAll({
          where: { organizationId: req.user!.organizationId },
          attributes: ['id']
        });
        where.childId = { [Op.in]: orgChildren.map(c => c.id) };
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalToday, pendingCount, byType, byLevel] = await Promise.all([
        Alert.count({ where: { ...where, createdAt: { [Op.gte]: today } } }),
        Alert.count({ where: { ...where, status: 'pending' } }),
        Alert.findAll({
          where: { ...where, createdAt: { [Op.gte]: today } },
          attributes: ['type', [Alert.sequelize!.fn('COUNT', Alert.sequelize!.col('id')), 'count']],
          group: ['type']
        }),
        Alert.findAll({
          where: { ...where, status: 'pending' },
          attributes: ['level', [Alert.sequelize!.fn('COUNT', Alert.sequelize!.col('id')), 'count']],
          group: ['level']
        })
      ]);

      return successResponse(res, {
        todayTotal: totalToday,
        pendingCount,
        byType: byType.map((r: any) => ({ type: r.type, count: parseInt(r.dataValues.count) })),
        byLevel: byLevel.map((r: any) => ({ level: r.level, count: parseInt(r.dataValues.count) }))
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
