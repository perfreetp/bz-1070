import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param } from 'express-validator';
import { validate, getPaginationParams } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { successResponse, AppError, paginatedResponse } from '../utils/response';
import { RescueLink, Child, Guardian, Location, Alert } from '../database/associations';
import { Op } from 'sequelize';
import { generateShortCode } from '../utils/geo';
import * as crypto from 'crypto';

const router = Router();

router.get(
  '/access/:token',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;

      const link = await RescueLink.findOne({
        where: { [Op.or]: [{ token }, { shortCode: token.toUpperCase() }] },
        include: [
          {
            association: 'child',
            attributes: ['id', 'name', 'gender', 'avatar', 'healthInfo']
          },
          {
            association: 'alert',
            attributes: ['id', 'type', 'title', 'content', 'latitude', 'longitude', 'createdAt']
          },
          {
            association: 'creator',
            attributes: ['id', 'realName', 'phone']
          }
        ]
      });

      if (!link) throw new AppError('协寻链接无效', 404, 'LINK_NOT_FOUND');
      if (link.isRevoked) throw new AppError('协寻链接已被撤销', 410, 'LINK_REVOKED');
      if (link.isOneTime && link.isUsed) throw new AppError('协寻链接已被使用', 410, 'LINK_USED');
      if (new Date(link.expiresAt) < new Date()) throw new AppError('协寻链接已过期', 410, 'LINK_EXPIRED');
      if (link.maxViews && link.viewCount >= link.maxViews) throw new AppError('协寻链接已达最大查看次数', 410, 'LINK_MAX_VIEWS');

      await link.increment('viewCount');

      if (link.isOneTime) {
        await link.update({
          isUsed: true,
          usedAt: new Date(),
          usedBy: req.ip
        });
      }

      let latestLocation: any = null;
      if (link.childId) {
        latestLocation = await Location.findOne({
          where: { childId: link.childId },
          order: [['reportedAt', 'DESC']],
          attributes: ['latitude', 'longitude', 'accuracy', 'reportedAt']
        });
      }

      return successResponse(res, {
        link: {
          id: link.id,
          shortCode: link.shortCode,
          description: link.description,
          expiresAt: link.expiresAt,
          createdAt: link.createdAt
        },
        child: (link as any).child,
        alert: (link as any).alert,
        latestLocation,
        creator: (link as any).creator,
        viewCount: link.viewCount + 1
      });
    } catch (error) {
      next(error);
    }
  }
);

router.use(authenticate);

router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }),
    query('pageSize').optional().isInt({ min: 1, max: 100 }),
    query('childId').optional().isUUID(),
    query('isActive').optional().isBoolean()
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = getPaginationParams(req);
      const { childId, isActive } = req.query;

      const where: any = {};
      if (childId) where.childId = childId;

      if (isActive === 'true') {
        where.isRevoked = false;
        where.isUsed = false;
        where.expiresAt = { [Op.gt]: new Date() };
      }

      if (req.user!.role === 'parent') {
        const guardianChildIds = (
          await Guardian.findAll({
            where: { userId: req.user!.userId, status: 'active' },
            attributes: ['childId']
          })
        ).map(g => g.childId);
        where.childId = {
          [Op.or]: [
            { [Op.in]: guardianChildIds.length > 0 ? guardianChildIds : [''] },
          ],
          ...(where.childId || {})
        };
        where.createdBy = req.user!.userId;
      }

      const { count, rows } = await RescueLink.findAndCountAll({
        where,
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'alert', attributes: ['id', 'type', 'title'] },
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
      const link = await RescueLink.findByPk(req.params.id, {
        include: [
          { association: 'child', attributes: ['id', 'name', 'avatar'] },
          { association: 'alert', attributes: ['id', 'type', 'title', 'content'] },
          { association: 'creator', attributes: ['id', 'realName', 'phone'] }
        ]
      });

      if (!link) throw new AppError('协寻链接不存在', 404);

      if (req.user!.role === 'parent' && link.createdBy !== req.user!.userId) {
        const isGuardian = await Guardian.findOne({
          where: { childId: link.childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限查看此协寻链接', 403);
      }

      return successResponse(res, link);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate([
    body('childId').isUUID().withMessage('儿童ID无效'),
    body('alertId').optional().isUUID(),
    body('description').optional().isLength({ max: 500 }),
    body('expiresInHours').optional().isInt({ min: 1, max: 720 }),
    body('isOneTime').optional().isBoolean(),
    body('maxViews').optional().isInt({ min: 1, max: 1000 })
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { childId, alertId, description, expiresInHours, isOneTime, maxViews } = req.body;

      const child = await Child.findByPk(childId);
      if (!child) throw new AppError('儿童不存在', 404);

      if (req.user!.role === 'parent') {
        const isGuardian = await Guardian.findOne({
          where: { childId, userId: req.user!.userId, status: 'active' }
        });
        if (!isGuardian) throw new AppError('无权限为此儿童创建协寻链接', 403);
      }

      if (alertId) {
        const alert = await Alert.findByPk(alertId);
        if (!alert || alert.childId !== childId) {
          throw new AppError('关联的告警不存在或不匹配', 400);
        }
      }

      let shortCode = '';
      let token = '';
      let attempts = 0;

      while (attempts < 10) {
        shortCode = generateShortCode(6);
        token = crypto.randomBytes(32).toString('hex');
        const existing = await RescueLink.findOne({
          where: { [Op.or]: [{ shortCode }, { token }] }
        });
        if (!existing) break;
        attempts++;
      }

      const expiresAt = new Date(Date.now() + (expiresInHours || 24) * 60 * 60 * 1000);

      const link = await RescueLink.create({
        childId,
        alertId,
        token,
        shortCode,
        createdBy: req.user!.userId,
        description,
        expiresAt,
        isOneTime: isOneTime !== false,
        maxViews: maxViews || 1,
        viewCount: 0,
        isRevoked: false,
        isUsed: false
      });

      const accessUrl = `/api/rescue/access/${token}`;
      const shortUrl = `/api/rescue/access/${shortCode}`;

      return successResponse(res, {
        ...link.toJSON(),
        accessUrl,
        shortUrl,
        shortCode
      }, '协寻链接创建成功', 201);
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
      const link = await RescueLink.findByPk(req.params.id);
      if (!link) throw new AppError('协寻链接不存在', 404);

      if (req.user!.role === 'parent' && link.createdBy !== req.user!.userId) {
        const isManager = await Guardian.findOne({
          where: { childId: link.childId, userId: req.user!.userId, status: 'active', canManage: true }
        });
        if (!isManager) throw new AppError('无权限撤销此协寻链接', 403);
      }

      await link.update({ isRevoked: true });
      return successResponse(res, null, '协寻链接已撤销');
    } catch (error) {
      next(error);
    }
  }
);

export default router;
