import { Op, Transaction } from 'sequelize';
import sequelize from '../database';
import Location from '../models/Location';
import Device from '../models/Device';
import Geofence from '../models/Geofence';
import Alert from '../models/Alert';
import { isPointInCircle, isPointInPolygon } from '../utils/geo';
import { AlertService } from './AlertService';

export interface ReportLocationParams {
  deviceId: string;
  childId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  locationType?: 'gps' | 'wifi' | 'lbs' | 'cellular';
  batteryLevel?: number;
  signalStrength?: number;
  isCharging?: boolean;
  stepCount?: number;
  reportedAt?: Date;
}

export class LocationService {
  private static async resolveDevice(deviceIdentifier: string): Promise<Device> {
    const device = await Device.findOne({
      where: {
        [Op.or]: [
          { id: deviceIdentifier },
          { deviceId: deviceIdentifier }
        ]
      }
    });

    if (!device) {
      throw new Error(`设备不存在: ${deviceIdentifier}`);
    }

    if (device.bindStatus === 'merged' && device.mergedToDeviceId) {
      const targetDevice = await Device.findByPk(device.mergedToDeviceId);
      if (targetDevice) return targetDevice;
    }

    return device;
  }

  static async reportLocation(params: ReportLocationParams): Promise<Location> {
    const t = await sequelize.transaction();

    try {
      const reportedAt = params.reportedAt || new Date();

      const device = await this.resolveDevice(params.deviceId);
      const deviceInternalId = device.id;
      const childId = params.childId || device.childId;

      if (!childId) {
        throw new Error('设备未绑定儿童，无法上报位置');
      }

      const location = await Location.create(
        {
          deviceId: deviceInternalId,
          childId,
          latitude: params.latitude,
          longitude: params.longitude,
          altitude: params.altitude,
          accuracy: params.accuracy,
          speed: params.speed,
          heading: params.heading,
          locationType: params.locationType || 'gps',
          batteryLevel: params.batteryLevel,
          signalStrength: params.signalStrength,
          isCharging: params.isCharging,
          stepCount: params.stepCount,
          reportedAt
        },
        { transaction: t }
      );

      await Device.update(
        {
          lastOnlineAt: reportedAt,
          batteryLevel: params.batteryLevel,
          signalStrength: params.signalStrength,
          isCharging: params.isCharging,
          status: 'online',
          childId: device.childId || childId
        },
        { where: { id: deviceInternalId }, transaction: t }
      );

      await this.checkGeofences(childId, deviceInternalId, params.latitude, params.longitude, reportedAt, t);
      await this.checkLowBattery(childId, deviceInternalId, params.batteryLevel, t);

      await t.commit();
      return location;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async getLatestLocationWithStatus(childId: string): Promise<{
    status: 'no_device' | 'no_data' | 'ok';
    message: string;
    location: Location | null;
    device?: Device | null;
  }> {
    const boundDevice = await Device.findOne({
      where: {
        childId,
        bindStatus: 'bound'
      },
      order: [['createdAt', 'DESC']]
    });

    if (!boundDevice) {
      return {
        status: 'no_device',
        message: '该儿童还未绑定设备，请先绑定手表或定位终端',
        location: null,
        device: null
      };
    }

    const location = await Location.findOne({
      where: { childId },
      include: [
        { association: 'device', attributes: ['id', 'deviceId', 'deviceType', 'status', 'batteryLevel', 'lastOnlineAt'] }
      ],
      order: [['reportedAt', 'DESC']]
    });

    if (!location) {
      return {
        status: 'no_data',
        message: '设备已绑定，但暂未回传位置数据，请确认手表已开机并有网络信号',
        location: null,
        device: boundDevice
      };
    }

    return {
      status: 'ok',
      message: 'success',
      location,
      device: boundDevice
    };
  }

  static async getLatestLocation(childId: string): Promise<Location | null> {
    return Location.findOne({
      where: { childId },
      include: [
        { association: 'device', attributes: ['id', 'deviceId', 'deviceType', 'status', 'batteryLevel'] }
      ],
      order: [['reportedAt', 'DESC']]
    });
  }

  static async getLocationHistory(
    childId: string,
    startTime: Date,
    endTime: Date,
    options: { page: number; pageSize: number }
  ): Promise<{ rows: Location[]; count: number }> {
    return Location.findAndCountAll({
      where: {
        childId,
        reportedAt: { [Op.between]: [startTime, endTime] }
      },
      order: [['reportedAt', 'ASC']],
      limit: options.pageSize,
      offset: (options.page - 1) * options.pageSize
    });
  }

  private static parseFloatSafe(value: any): number {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) return value;
    if (typeof value === 'string') {
      const n = parseFloat(value);
      if (!isNaN(n) && isFinite(n)) return n;
    }
    return 0;
  }

  private static async checkGeofences(
    childId: string,
    deviceId: string,
    latitude: number,
    longitude: number,
    reportedAt: Date,
    transaction: Transaction
  ): Promise<void> {
    const geofences = await Geofence.findAll({
      where: {
        [Op.or]: [{ childId }, { childId: { [Op.is]: null } }],
        isActive: true
      } as any,
      transaction
    });

    let lastLocation: Location | null | undefined;

    for (const geofence of geofences) {
      if (!this.isScheduleActive(geofence, reportedAt)) continue;

      const gfLat = this.parseFloatSafe(geofence.latitude);
      const gfLon = this.parseFloatSafe(geofence.longitude);
      const gfRadius = this.parseFloatSafe(geofence.radius) || 100;

      let isInside: boolean;
      if (geofence.shape === 'circle') {
        isInside = isPointInCircle(latitude, longitude, gfLat, gfLon, gfRadius);
      } else {
        try {
          const points = JSON.parse(geofence.polygonPoints || '[]');
          isInside = isPointInPolygon(latitude, longitude, points);
        } catch {
          continue;
        }
      }

      if (lastLocation === undefined) {
        lastLocation = await Location.findOne({
          where: { childId, reportedAt: { [Op.lt]: reportedAt } },
          order: [['reportedAt', 'DESC']],
          transaction
        });
      }

      let wasInside = false;
      if (lastLocation) {
        const lastLat = this.parseFloatSafe(lastLocation.latitude);
        const lastLon = this.parseFloatSafe(lastLocation.longitude);
        if (geofence.shape === 'circle') {
          wasInside = isPointInCircle(lastLat, lastLon, gfLat, gfLon, gfRadius);
        } else {
          try {
            const points = JSON.parse(geofence.polygonPoints || '[]');
            wasInside = isPointInPolygon(lastLat, lastLon, points);
          } catch {
            wasInside = false;
          }
        }
      }

      const safeName = String(geofence.name || '未命名围栏').slice(0, 100);

      if (geofence.notifyOnExit && wasInside && !isInside) {
        await AlertService.createAlert({
          childId,
          deviceId,
          geofenceId: geofence.id,
          type: 'geofence_exit',
          level: 'danger',
          title: `儿童离开${safeName}`,
          content: `儿童已离开安全区域「${safeName}」，请注意查看位置`,
          latitude,
          longitude,
          triggerValue: 'outside',
          thresholdValue: `radius:${gfRadius}m`
        }, transaction);
      }

      if (geofence.notifyOnEnter && !wasInside && isInside) {
        await AlertService.createAlert({
          childId,
          deviceId,
          geofenceId: geofence.id,
          type: 'geofence_enter',
          level: 'info',
          title: `儿童进入${safeName}`,
          content: `儿童已进入安全区域「${safeName}」`,
          latitude,
          longitude,
          triggerValue: 'inside',
          thresholdValue: `radius:${gfRadius}m`
        }, transaction);
      }
    }
  }

  private static isScheduleActive(geofence: Geofence, now: Date): boolean {
    if (geofence.weekdays && typeof geofence.weekdays === 'string' && geofence.weekdays.trim().length > 0) {
      const currentDay = now.getDay() === 0 ? 7 : now.getDay();
      try {
        const days = geofence.weekdays.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (days.length > 0 && !days.includes(currentDay)) return false;
      } catch {
      }
    }

    if (geofence.scheduleStart && geofence.scheduleEnd) {
      const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (nowStr < geofence.scheduleStart || nowStr > geofence.scheduleEnd) return false;
    }

    return true;
  }

  private static async checkLowBattery(
    childId: string,
    deviceId: string,
    batteryLevel: number | undefined,
    transaction: Transaction
  ): Promise<void> {
    if (batteryLevel === undefined || batteryLevel === null) return;
    if (typeof batteryLevel !== 'number' || isNaN(batteryLevel)) return;

    const threshold = parseInt(process.env.LOW_BATTERY_THRESHOLD || '20', 10);
    const safeThreshold = isNaN(threshold) ? 20 : threshold;

    if (batteryLevel <= safeThreshold) {
      const lastHour = new Date(Date.now() - 60 * 60 * 1000);
      const existingAlert = await Alert.findOne({
        where: {
          childId,
          deviceId,
          type: 'low_battery',
          createdAt: { [Op.gt]: lastHour }
        },
        transaction
      });

      if (!existingAlert) {
        const safeBattery = Math.max(0, Math.min(100, Math.round(batteryLevel)));
        await AlertService.createAlert({
          childId,
          deviceId,
          type: 'low_battery',
          level: 'warning',
          title: '设备电量不足',
          content: `设备当前电量为 ${safeBattery}%，请及时充电`,
          triggerValue: `${safeBattery}%`,
          thresholdValue: `${safeThreshold}%`
        }, transaction);
      }
    }
  }
}
