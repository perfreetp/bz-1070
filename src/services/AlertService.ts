import { Op, Transaction } from 'sequelize';
import sequelize from '../database';
import Alert, { AlertLevel, AlertType } from '../models/Alert';
import AlertPush from '../models/AlertPush';
import Guardian from '../models/Guardian';

export interface CreateAlertParams {
  childId: string;
  deviceId?: string;
  geofenceId?: string;
  type: AlertType;
  level?: AlertLevel;
  title: string;
  content?: string;
  latitude?: number;
  longitude?: number;
  triggerValue?: string;
  thresholdValue?: string;
}

export class AlertService {
  static async createAlert(params: CreateAlertParams, transaction?: Transaction): Promise<Alert> {
    const t = transaction || (await sequelize.transaction());

    try {
      const alert = await Alert.create(
        {
          childId: params.childId,
          deviceId: params.deviceId,
          geofenceId: params.geofenceId,
          type: params.type,
          level: params.level || 'warning',
          title: params.title,
          content: params.content,
          latitude: params.latitude,
          longitude: params.longitude,
          triggerValue: params.triggerValue,
          thresholdValue: params.thresholdValue,
          status: 'pending',
          pushStatus: 'pending'
        },
        { transaction: t }
      );

      await this.createAlertPushes(alert.id, params.childId, t);

      if (!transaction) await t.commit();

      return alert;
    } catch (error) {
      if (!transaction) await t.rollback();
      throw error;
    }
  }

  static async createAlertPushes(alertId: string, childId: string, transaction?: Transaction): Promise<AlertPush[]> {
    const guardians = await Guardian.findAll({
      where: {
        childId,
        status: 'active',
        canReceiveAlerts: true
      },
      transaction
    });

    const pushes: AlertPush[] = [];

    for (const guardian of guardians) {
      const push = await AlertPush.create(
        {
          alertId,
          guardianId: guardian.id,
          userId: guardian.userId,
          pushChannel: 'app',
          status: 'pending',
          retryCount: 0
        },
        { transaction }
      );
      pushes.push(push);

      const pushIdCopy = push.id;
      setTimeout(() => {
        this.simulatePush(pushIdCopy).catch(err => {
          console.error(`[AlertService] simulatePush failed for push ${pushIdCopy}:`, err?.message || err);
        });
      }, 100);
    }

    if (guardians.length > 0) {
      await Alert.update(
        {
          pushStatus: pushes.length === guardians.length ? 'sent' : 'partial',
          pushedGuardians: guardians.length
        },
        { where: { id: alertId }, transaction }
      );
    }

    return pushes;
  }

  static async simulatePush(pushId: string): Promise<void> {
    try {
      await AlertPush.update(
        {
          status: Math.random() > 0.1 ? 'sent' : 'failed',
          sentAt: new Date(),
          failureReason: Math.random() > 0.1 ? undefined : '模拟推送失败'
        },
        { where: { id: pushId } }
      );
    } catch (error) {
      console.error('模拟推送失败:', error);
    }
  }

  static async handleAlert(
    alertId: string,
    handledBy: string,
    status: 'processing' | 'resolved' | 'ignored',
    handleNote?: string
  ): Promise<Alert | null> {
    const alert = await Alert.findByPk(alertId);
    if (!alert) return null;

    await alert.update({
      status,
      handledBy,
      handledAt: new Date(),
      handleNote
    });

    return alert;
  }

  static async getUserAlerts(
    userId: string,
    options: { status?: string; type?: string; page: number; pageSize: number }
  ): Promise<{ rows: Alert[]; count: number }> {
    const guardianChildIds: string[] = (
      await Guardian.findAll({
        where: { userId, status: 'active', canReceiveAlerts: true },
        attributes: ['childId']
      })
    ).map((g: Guardian) => g.childId);

    const where: any = { childId: { [Op.in]: guardianChildIds } };
    if (options.status) where.status = options.status;
    if (options.type) where.type = options.type;

    const { count, rows } = await Alert.findAndCountAll({
      where,
      include: [
        { association: 'child', attributes: ['id', 'name', 'avatar'] },
        { association: 'device', attributes: ['id', 'deviceId', 'deviceType'] },
        { association: 'geofence', attributes: ['id', 'name', 'type'] },
        { association: 'handler', attributes: ['id', 'realName'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: options.pageSize,
      offset: (options.page - 1) * options.pageSize
    });

    return { rows, count };
  }
}
