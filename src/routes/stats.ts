import { Router, Request, Response, NextFunction } from 'express';
import { query, param } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate, requireRole } from '../middleware/auth';
import { successResponse, AppError } from '../utils/response';
import { Child, CheckInRecord, Organization, Alert } from '../database/associations';
import { Op, fn, col, literal } from 'sequelize';

const router = Router();

router.use(authenticate);

router.get(
  '/organization/daily',
  requireRole('school_admin', 'scenic_admin', 'system_admin'),
  validate([
    query('organizationId').optional().isUUID(),
    query('date').optional().isISO8601()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let organizationId = req.query.organizationId as string;
      const dateStr = req.query.date as string;

      if (!organizationId && req.user!.organizationId) {
        organizationId = req.user!.organizationId;
      }

      if (!organizationId) {
        throw new AppError('请指定机构ID', 400);
      }

      const org = await Organization.findByPk(organizationId);
      if (!org) throw new AppError('机构不存在', 404);

      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const totalChildren = await Child.count({
        where: { organizationId, status: 'normal' }
      });

      const enterRecords = await CheckInRecord.findAll({
        where: {
          organizationId,
          type: 'enter',
          status: 'success',
          createdAt: { [Op.between]: [dayStart, dayEnd] }
        },
        attributes: ['childId', [fn('MAX', col('created_at')), 'lastEnter']],
        group: ['childId']
      });

      const enteredChildIds = enterRecords.map((r: any) => r.childId);

      const exitRecords = await CheckInRecord.findAll({
        where: {
          organizationId,
          type: 'exit',
          status: 'success',
          createdAt: { [Op.between]: [dayStart, dayEnd] }
        },
        attributes: ['childId', [fn('MAX', col('created_at')), 'lastExit']],
        group: ['childId']
      });

      const exitedChildIds = exitRecords.map((r: any) => r.childId);

      const inCampCount = enteredChildIds.filter(id => !exitedChildIds.includes(id)).length;
      const leftCount = exitedChildIds.length;
      const notArrivedCount = totalChildren - enteredChildIds.length;

      const todayAlerts = await Alert.findAll({
        where: {
          createdAt: { [Op.between]: [dayStart, dayEnd] }
        },
        include: [
          {
            association: 'child',
            where: { organizationId },
            attributes: ['id', 'name'],
            required: true
          }
        ],
        attributes: ['type', 'level', 'status', 'childId'],
        order: [['createdAt', 'DESC']]
      });

      const abnormalCount = todayAlerts.filter(a =>
        ['geofence_exit', 'tamper', 'missing', 'sos'].includes(a.type) &&
        a.status === 'pending'
      ).reduce((acc, cur) => {
        if (!acc.includes(cur.childId)) acc.push(cur.childId);
        return acc;
      }, [] as string[]).length;

      const byAlertType = todayAlerts.reduce((acc: any, cur) => {
        acc[cur.type] = (acc[cur.type] || 0) + 1;
        return acc;
      }, {});

      const abnormalChildren = todayAlerts
        .filter(a => a.status === 'pending')
        .reduce((acc: any[], cur) => {
          const existing = acc.find(c => c.childId === cur.childId);
          if (!existing) {
            acc.push({
              childId: cur.childId,
              childName: (cur as any).child?.name,
              alertTypes: [cur.type],
              levels: [cur.level]
            });
          } else {
            if (!existing.alertTypes.includes(cur.type)) existing.alertTypes.push(cur.type);
            if (!existing.levels.includes(cur.level)) existing.levels.push(cur.level);
          }
          return acc;
        }, []);

      return successResponse(res, {
        organization: {
          id: org.id,
          name: org.name,
          type: org.type
        },
        date: targetDate.toISOString().split('T')[0],
        statistics: {
          totalChildren,
          inCamp: inCampCount,
          left: leftCount,
          notArrived: notArrivedCount,
          abnormal: abnormalCount,
          inCampRate: totalChildren > 0 ? ((inCampCount / totalChildren) * 100).toFixed(1) + '%' : '0%'
        },
        alerts: {
          todayTotal: todayAlerts.length,
          byType: byAlertType,
          abnormalChildren
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/organization/children-details',
  requireRole('school_admin', 'scenic_admin', 'system_admin'),
  validate([
    query('organizationId').optional().isUUID(),
    query('status').optional().isIn(['in_camp', 'left', 'not_arrived', 'abnormal']),
    query('date').optional().isISO8601()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let organizationId = req.query.organizationId as string;
      const status = req.query.status as string;
      const dateStr = req.query.date as string;

      if (!organizationId && req.user!.organizationId) {
        organizationId = req.user!.organizationId;
      }

      if (!organizationId) throw new AppError('请指定机构ID', 400);

      const targetDate = dateStr ? new Date(dateStr) : new Date();
      const dayStart = new Date(targetDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDate);
      dayEnd.setHours(23, 59, 59, 999);

      const allChildren = await Child.findAll({
        where: { organizationId, status: 'normal' },
        include: [
          {
            association: 'checkInRecords',
            where: { createdAt: { [Op.between]: [dayStart, dayEnd] } },
            required: false,
            order: [['createdAt', 'DESC']],
            limit: 10
          },
          {
            association: 'devices',
            attributes: ['id', 'batteryLevel', 'status']
          }
        ],
        order: [['grade', 'ASC'], ['class', 'ASC'], ['name', 'ASC']]
      });

      const childrenWithStatus = await Promise.all(allChildren.map(async child => {
        const records = (child as any).checkInRecords || [];
        const enters = records.filter((r: any) => r.type === 'enter' && r.status === 'success');
        const exits = records.filter((r: any) => r.type === 'exit' && r.status === 'success');

        let childStatus = 'not_arrived';
        if (enters.length > 0 && exits.length === 0) childStatus = 'in_camp';
        else if (exits.length > 0) childStatus = 'left';

        const childAlerts = await Alert.count({
          where: {
            childId: child.id,
            status: 'pending',
            type: ['geofence_exit', 'tamper', 'missing', 'sos'],
            createdAt: { [Op.between]: [dayStart, dayEnd] }
          }
        });

        if (childAlerts > 0) childStatus = 'abnormal';

        const lastEnter = enters.length > 0 ? enters[0] : null;
        const lastExit = exits.length > 0 ? exits[0] : null;

        return {
          id: child.id,
          name: child.name,
          gender: child.gender,
          grade: child.grade,
          class: child.class,
          studentId: child.studentId,
          avatar: child.avatar,
          status: childStatus,
          lastEnterTime: lastEnter?.createdAt || null,
          lastExitTime: lastExit?.createdAt || null,
          lastEnterGate: lastEnter?.gateName || null,
          batteryLevel: (child as any).devices?.[0]?.batteryLevel || null,
          deviceStatus: (child as any).devices?.[0]?.status || null,
          hasAlert: childAlerts > 0,
          alertCount: childAlerts
        };
      }));

      const filtered = status ? childrenWithStatus.filter(c => c.status === status) : childrenWithStatus;

      return successResponse(res, {
        total: filtered.length,
        children: filtered
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/organization/trend',
  requireRole('school_admin', 'scenic_admin', 'system_admin'),
  validate([
    query('organizationId').optional().isUUID(),
    query('days').optional().isInt({ min: 1, max: 30 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let organizationId = req.query.organizationId as string;
      const days = parseInt(req.query.days as string) || 7;

      if (!organizationId && req.user!.organizationId) {
        organizationId = req.user!.organizationId;
      }

      if (!organizationId) throw new AppError('请指定机构ID', 400);

      const org = await Organization.findByPk(organizationId);
      if (!org) throw new AppError('机构不存在', 404);

      const results: any[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);

        const total = await Child.count({ where: { organizationId, status: 'normal' } });

        const enterCount = await CheckInRecord.count({
          where: {
            organizationId,
            type: 'enter',
            status: 'success',
            createdAt: { [Op.between]: [dayStart, dayEnd] }
          },
          distinct: true,
          col: 'child_id'
        });

        const exitCount = await CheckInRecord.count({
          where: {
            organizationId,
            type: 'exit',
            status: 'success',
            createdAt: { [Op.between]: [dayStart, dayEnd] }
          },
          distinct: true,
          col: 'child_id'
        });

        const alertCount = await Alert.count({
          include: [{ association: 'child', where: { organizationId }, attributes: [], required: true }],
          where: { createdAt: { [Op.between]: [dayStart, dayEnd] } }
        });

        results.push({
          date: date.toISOString().split('T')[0],
          totalChildren: total,
          entered: enterCount,
          exited: exitCount,
          alerts: alertCount
        });
      }

      return successResponse(res, {
        organization: { id: org.id, name: org.name, type: org.type },
        days,
        trend: results
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/dashboard/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let orgWhere: any = {};
      let childWhere: any = {};

      if (req.user!.role === 'parent') {
        return successResponse(res, {
          message: '家长用户请使用 /api/guardians/children/my 获取个人统计'
        });
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        orgWhere.id = req.user!.organizationId;
        childWhere.organizationId = req.user!.organizationId;
      }

      const [orgCount, childCount, deviceCount, todayAlerts, pendingAlerts] = await Promise.all([
        Organization.count({ where: { ...orgWhere, status: 'active' } }),
        Child.count({ where: { ...childWhere, status: 'normal' } }),
        (await import('../database/associations')).Device.count({ where: { bindStatus: 'bound' } }),
        Alert.count({
          include: childWhere.organizationId ? [{
            association: 'child',
            where: { organizationId: childWhere.organizationId },
            required: true
          }] : undefined,
          where: literal('DATE(created_at) = CURRENT_DATE')
        }),
        Alert.count({
          include: childWhere.organizationId ? [{
            association: 'child',
            where: { organizationId: childWhere.organizationId },
            required: true
          }] : undefined,
          where: { status: 'pending' }
        })
      ]);

      return successResponse(res, {
        organizations: orgCount,
        children: childCount,
        boundDevices: deviceCount,
        todayAlerts,
        pendingAlerts
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
