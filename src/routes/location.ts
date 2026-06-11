import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate, deviceAuth } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Location, Device, Child, Guardian } from '../database/associations';
import { Op } from 'sequelize';
import { LocationService } from '../services/LocationService';

const router = Router();

router.post(
  '/report',
  deviceAuth,
  validate([
    body('deviceId').notEmpty().withMessage('设备ID不能为空'),
    body('childId').isUUID().withMessage('儿童ID不能为空'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('纬度无效'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('经度无效'),
    body('batteryLevel').optional().isInt({ min: 0, max: 100 }),
    body('locationType').optional().isIn(['gps', 'wifi', 'lbs', 'cellular'])
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const location = await LocationService.reportLocation(req.body);
      return successResponse(res, location, '位置上报成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.use(authenticate);

router.get(
  '/latest/:childId',
  validate([param('childId').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user!.role === 'parent') {
        const canView = await Guardian.findOne({
          where: { childId: req.params.childId, userId: req.user!.userId, status: 'active', canViewLocation: true }
        });
        if (!canView) throw new AppError('无权限查看此儿童位置', 403);
      }

      const location = await LocationService.getLatestLocation(req.params.childId);
      if (!location) return successResponse(res, null, '暂无位置数据');

      return successResponse(res, location);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/history/:childId',
  validate([
    param('childId').isUUID(),
    query('startTime').notEmpty().isISO8601().withMessage('开始时间无效'),
    query('endTime').notEmpty().isISO8601().withMessage('结束时间无效'),
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 1000 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize } = getPaginationParams(req);
      const { startTime, endTime } = req.query;

      if (req.user!.role === 'parent') {
        const canView = await Guardian.findOne({
          where: { childId: req.params.childId, userId: req.user!.userId, status: 'active', canViewLocation: true }
        });
        if (!canView) throw new AppError('无权限查看此儿童位置', 403);
      }

      const { rows, count } = await LocationService.getLocationHistory(
        req.params.childId,
        new Date(startTime as string),
        new Date(endTime as string),
        { page, pageSize: pageSize > 200 ? 200 : pageSize }
      );

      return paginatedResponse(res, rows, count, page, pageSize);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/batch-latest',
  validate([
    query('childIds').notEmpty().withMessage('儿童ID列表不能为空')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const childIdsStr = req.query.childIds as string;
      const childIds = childIdsStr.split(',').filter(id => id);

      if (req.user!.role === 'parent') {
        const guardianChildIds = (
          await Guardian.findAll({
            where: { userId: req.user!.userId, status: 'active', canViewLocation: true },
            attributes: ['childId']
          })
        ).map(g => g.childId);

        const validChildIds = childIds.filter(id => guardianChildIds.includes(id));
        if (validChildIds.length !== childIds.length) {
          throw new AppError('部分儿童无权限查看位置', 403);
        }
      }

      const results: any[] = [];
      for (const childId of childIds) {
        const location = await Location.findOne({
          where: { childId },
          include: [{ association: 'device', attributes: ['id', 'deviceId', 'status', 'batteryLevel'] }],
          order: [['reportedAt', 'DESC']]
        });
        results.push({ childId, location });
      }

      return successResponse(res, results);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
