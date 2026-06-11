import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Geofence, Guardian } from '../database/associations';
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
    query('type').optional().isIn(['home', 'school', 'scenic', 'custom']),
    query('isActive').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = getPaginationParams(req);
      const { childId, organizationId, type, isActive } = req.query;

      const where: any = {};
      if (childId) where.childId = childId;
      if (organizationId) where.organizationId = organizationId;
      if (type) where.type = type;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      if (req.user!.role === 'parent' && childId) {
        const canView = await Guardian.findOne({
          where: { childId: childId as string, userId: req.user!.userId, status: 'active' }
        });
        if (!canView) throw new AppError('无权限查看此儿童围栏', 403);
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (!where.organizationId) where.organizationId = req.user!.organizationId;
        where.childId = { [Op.or]: [childId, null] };
      }

      const { count, rows } = await Geofence.findAndCountAll({
        where,
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'organization', attributes: ['id', 'name', 'type'] },
          { association: 'creator', attributes: ['id', 'realName'] }
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
      const geofence = await Geofence.findByPk(req.params.id, {
        include: [
          { association: 'child', attributes: ['id', 'name'] },
          { association: 'organization', attributes: ['id', 'name'] },
          { association: 'creator', attributes: ['id', 'realName'] }
        ]
      });

      if (!geofence) throw new AppError('围栏不存在', 404);

      if (req.user!.role === 'parent' && geofence.childId) {
        const canView = await Guardian.findOne({
          where: { childId: geofence.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!canView) throw new AppError('无权限查看此围栏', 403);
      }

      return successResponse(res, geofence);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate([
    body('name').notEmpty().isLength({ max: 100 }).withMessage('围栏名称不能为空'),
    body('type').isIn(['home', 'school', 'scenic', 'custom']).withMessage('围栏类型无效'),
    body('shape').isIn(['circle', 'polygon']).withMessage('围栏形状无效'),
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('纬度无效'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('经度无效'),
    body('radius').optional().isInt({ min: 10 }),
    body('childId').optional().isUUID(),
    body('organizationId').optional().isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        name, type, shape, latitude, longitude, radius, polygonPoints, address,
        isActive, notifyOnEnter, notifyOnExit, scheduleStart, scheduleEnd,
        weekdays, childId, organizationId
      } = req.body;

      if (req.user!.role === 'parent') {
        if (!childId) throw new AppError('家长创建围栏必须指定儿童', 400);
        const canManage = await Guardian.findOne({
          where: { childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!canManage) throw new AppError('无权限为此儿童创建围栏', 403);
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (!organizationId) req.body.organizationId = req.user!.organizationId;
      }

      const geofence = await Geofence.create({
        name,
        type,
        shape,
        latitude,
        longitude,
        radius: radius || 100,
        polygonPoints,
        address,
        isActive: isActive !== false,
        notifyOnEnter: notifyOnEnter || false,
        notifyOnExit: notifyOnExit !== false,
        scheduleStart,
        scheduleEnd,
        weekdays,
        childId,
        organizationId: organizationId || req.user!.organizationId,
        createdBy: req.user!.userId
      });

      return successResponse(res, geofence, '围栏创建成功', 201);
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
      const geofence = await Geofence.findByPk(req.params.id);
      if (!geofence) throw new AppError('围栏不存在', 404);

      if (req.user!.role === 'parent' && geofence.childId) {
        const canManage = await Guardian.findOne({
          where: { childId: geofence.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!canManage) throw new AppError('无权限修改此围栏', 403);
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (geofence.organizationId && geofence.organizationId !== req.user!.organizationId) {
          throw new AppError('无权限修改此围栏', 403);
        }
      }

      const allowedFields = ['name', 'type', 'shape', 'latitude', 'longitude', 'radius', 'polygonPoints', 'address', 'isActive', 'notifyOnEnter', 'notifyOnExit', 'scheduleStart', 'scheduleEnd', 'weekdays'];
      const updateData: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      await geofence.update(updateData);
      return successResponse(res, geofence, '围栏更新成功');
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id',
  validate([param('id').isUUID()]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const geofence = await Geofence.findByPk(req.params.id);
      if (!geofence) throw new AppError('围栏不存在', 404);

      if (req.user!.role === 'parent' && geofence.childId) {
        const canManage = await Guardian.findOne({
          where: { childId: geofence.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!canManage) throw new AppError('无权限删除此围栏', 403);
      }

      if ((req.user!.role === 'school_admin' || req.user!.role === 'scenic_admin') && req.user!.organizationId) {
        if (geofence.organizationId && geofence.organizationId !== req.user!.organizationId) {
          throw new AppError('无权限删除此围栏', 403);
        }
      }

      await geofence.destroy();
      return successResponse(res, null, '围栏删除成功');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
