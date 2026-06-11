import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate, requireRole, deviceAuth } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { Device, Child, Guardian, Location } from '../database/associations';
import { Op, Transaction } from 'sequelize';
import sequelize from '../database';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('deviceId').optional().isString(),
    query('childId').optional().isUUID(),
    query('bindStatus').optional().isIn(['unbound', 'bound', 'merged']),
    query('status').optional().isIn(['online', 'offline', 'disabled', 'tampered'])
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = getPaginationParams(req);
      const { deviceId, childId, bindStatus, status } = req.query;

      const where: any = {};
      if (deviceId) where.deviceId = { [Op.like]: `%${deviceId}%` };
      if (childId) where.childId = childId;
      if (bindStatus) where.bindStatus = bindStatus;
      if (status) where.status = status;

      if (req.user!.role === 'parent') {
        const guardianChildIds = (
          await Guardian.findAll({
            where: { userId: req.user!.userId, status: 'active' },
            attributes: ['childId']
          })
        ).map(g => g.childId);
        where.childId = { [Op.in]: guardianChildIds.length > 0 ? guardianChildIds : [''] };
      }

      const { count, rows } = await Device.findAndCountAll({
        where,
        include: [
          {
            association: 'child',
            attributes: ['id', 'name', 'avatar', 'organizationId'],
            include: [{ association: 'organization', attributes: ['id', 'name'] }]
          }
        ],
        order: [['updatedAt', 'DESC']],
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
      const device = await Device.findByPk(req.params.id, {
        include: [
          {
            association: 'child',
            attributes: ['id', 'name', 'avatar'],
            include: [{ association: 'guardians' }]
          },
          {
            association: 'locations',
            limit: 1,
            order: [['reportedAt', 'DESC']]
          }
        ]
      });

      if (!device) throw new AppError('设备不存在', 404);

      if (req.user!.role === 'parent' && device.childId) {
        const isGuardian = await Guardian.findOne({
          where: { childId: device.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看此设备', 403);
      }

      return successResponse(res, device);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  requireRole('system_admin'),
  validate([
    body('deviceId').notEmpty().isLength({ max: 100 }).withMessage('设备ID不能为空'),
    body('deviceType').optional().isIn(['watch', 'bracelet', 'tag']),
    body('imei').optional().isLength({ min: 15, max: 15 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceId, deviceType, model, manufacturer, firmwareVersion, imei, simNumber } = req.body;

      const existing = await Device.findOne({ where: { [Op.or]: [{ deviceId }, { imei: imei || '' }] } });
      if (existing) throw new AppError('设备ID或IMEI已存在', 400);

      const device = await Device.create({
        deviceId,
        deviceType: deviceType || 'watch',
        model,
        manufacturer,
        firmwareVersion,
        imei,
        simNumber,
        bindStatus: 'unbound',
        status: 'offline'
      });

      return successResponse(res, device, '设备创建成功', 201);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/bind',
  validate([
    body('deviceId').notEmpty().withMessage('设备ID不能为空'),
    body('childId').isUUID().withMessage('儿童ID不能为空')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    const t = await sequelize.transaction();
    try {
      const { deviceId, childId } = req.body;

      if (req.user!.role === 'parent') {
        const canManage = await Guardian.findOne({
          where: { childId, userId: req.user!.userId, status: 'active', canManage: true },
          transaction: t
        });
        if (!canManage) {
          await t.rollback();
          throw new AppError('无权限绑定设备到此儿童', 403);
        }
      }

      const child = await Child.findByPk(childId, { transaction: t });
      if (!child) {
        await t.rollback();
        throw new AppError('儿童不存在', 404);
      }

      const device = await Device.findOne({
        where: { [Op.or]: [{ id: deviceId }, { deviceId }] },
        transaction: t
      });
      if (!device) {
        await t.rollback();
        throw new AppError('设备不存在', 404);
      }

      if (device.bindStatus === 'merged') {
        await t.rollback();
        throw new AppError('该设备已合并到其他设备，无法绑定', 400);
      }

      if (device.bindStatus === 'bound' && device.childId !== childId) {
        await t.rollback();
        throw new AppError('设备已绑定到其他儿童，请先解绑', 400);
      }

      await device.update({ childId, bindStatus: 'bound' }, { transaction: t });
      await t.commit();

      const refreshed = await Device.findByPk(device.id, {
        include: [{ association: 'child', attributes: ['id', 'name'] }]
      });

      return successResponse(res, refreshed, '设备绑定成功');
    } catch (error) {
      await t.rollback();
      next(error);
    }
  }
);

router.post(
  '/unbind',
  validate([
    body('deviceId').notEmpty().withMessage('设备ID不能为空')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceId } = req.body;

      const device = await Device.findOne({
        where: { [Op.or]: [{ id: deviceId }, { deviceId }] }
      });
      if (!device) throw new AppError('设备不存在', 404);

      if (req.user!.role === 'parent' && device.childId) {
        const canManage = await Guardian.findOne({
          where: { childId: device.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!canManage) throw new AppError('无权限解绑此设备', 403);
      }

      await device.update({ childId: undefined, bindStatus: 'unbound' } as any);
      return successResponse(res, null, '设备解绑成功');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/merge',
  requireRole('system_admin'),
  validate([
    body('sourceDeviceId').isUUID().withMessage('源设备ID无效'),
    body('targetDeviceId').isUUID().withMessage('目标设备ID无效')
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    const t: Transaction = await sequelize.transaction();
    try {
      const { sourceDeviceId, targetDeviceId } = req.body;

      if (sourceDeviceId === targetDeviceId) {
        await t.rollback();
        throw new AppError('不能合并到同一设备', 400);
      }

      const sourceDevice = await Device.findByPk(sourceDeviceId, { transaction: t });
      const targetDevice = await Device.findByPk(targetDeviceId, { transaction: t });

      if (!sourceDevice || !targetDevice) {
        await t.rollback();
        throw new AppError('源设备或目标设备不存在', 404);
      }

      if (targetDevice.bindStatus === 'merged') {
        await t.rollback();
        throw new AppError('目标设备已被合并，无法作为目标', 400);
      }

      const targetChildId = targetDevice.childId || sourceDevice.childId;

      await Location.update(
        { deviceId: targetDeviceId },
        { where: { deviceId: sourceDeviceId }, transaction: t }
      );

      await sourceDevice.update({
        bindStatus: 'merged',
        mergedToDeviceId: targetDeviceId,
        childId: targetChildId
      }, { transaction: t });

      if (!targetDevice.childId && sourceDevice.childId) {
        await targetDevice.update({
          childId: sourceDevice.childId,
          bindStatus: 'bound'
        }, { transaction: t });
      }

      await t.commit();

      return successResponse(res, {
        sourceDevice: sourceDevice.id,
        targetDevice: targetDevice.id,
        message: '设备合并成功，历史定位数据已迁移'
      }, '设备合并成功');
    } catch (error) {
      await t.rollback();
      next(error);
    }
  }
);

router.put(
  '/report-tamper',
  deviceAuth,
  validate([
    body('deviceId').notEmpty(),
    body('tamperType').notEmpty().isIn(['detached', 'opened', 'shutdown'])
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceId, tamperType, latitude, longitude } = req.body;

      const device = await Device.findOne({
        where: { [Op.or]: [{ id: deviceId }, { deviceId }] }
      });
      if (!device) throw new AppError('设备不存在', 404);

      await device.update({ status: 'tampered' });

      if (device.childId) {
        const { AlertService } = await import('../services/AlertService');
        await AlertService.createAlert({
          childId: device.childId,
          deviceId: device.id,
          type: 'tamper',
          level: 'danger',
          title: '设备拆卸告警',
          content: `检测到设备${tamperType === 'detached' ? '被摘下' : tamperType === 'opened' ? '被拆开' : '被关机'}，请立即确认儿童安全`,
          latitude,
          longitude,
          triggerValue: tamperType
        });
      }

      return successResponse(res, null, '拆卸告警已上报');
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate([
    param('id').isUUID()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const device = await Device.findByPk(req.params.id);
      if (!device) throw new AppError('设备不存在', 404);

      if (req.user!.role === 'parent') {
        throw new AppError('家长无权限修改设备信息', 403);
      }

      await device.update(req.body);
      return successResponse(res, device, '设备信息更新成功');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
