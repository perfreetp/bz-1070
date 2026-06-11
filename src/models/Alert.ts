import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export type AlertType = 'geofence_exit' | 'geofence_enter' | 'long_stay' | 'tamper' | 'low_battery' | 'offline' | 'missing' | 'sos';
export type AlertLevel = 'info' | 'warning' | 'danger';
export type AlertStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export interface AlertAttributes {
  id: string;
  childId: string;
  deviceId?: string;
  geofenceId?: string;
  type: AlertType;
  level: AlertLevel;
  title: string;
  content?: string;
  latitude?: number;
  longitude?: number;
  triggerValue?: string;
  thresholdValue?: string;
  status: AlertStatus;
  handledBy?: string;
  handledAt?: Date;
  handleNote?: string;
  pushStatus: 'pending' | 'sent' | 'failed' | 'partial';
  pushedGuardians?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AlertCreationAttributes extends Optional<AlertAttributes, 'id' | 'status' | 'pushStatus'> {}

class Alert extends Model<AlertAttributes, AlertCreationAttributes> implements AlertAttributes {
  public id!: string;
  public childId!: string;
  public deviceId?: string;
  public geofenceId?: string;
  public type!: AlertType;
  public level!: AlertLevel;
  public title!: string;
  public content?: string;
  public latitude?: number;
  public longitude?: number;
  public triggerValue?: string;
  public thresholdValue?: string;
  public status!: AlertStatus;
  public handledBy?: string;
  public handledAt?: Date;
  public handleNote?: string;
  public pushStatus!: 'pending' | 'sent' | 'failed' | 'partial';
  public pushedGuardians?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Alert.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    childId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'child_id',
      references: {
        model: 'children',
        key: 'id'
      }
    },
    deviceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'device_id',
      references: {
        model: 'devices',
        key: 'id'
      }
    },
    geofenceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'geofence_id',
      references: {
        model: 'geofences',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('geofence_exit', 'geofence_enter', 'long_stay', 'tamper', 'low_battery', 'offline', 'missing', 'sos'),
      allowNull: false
    },
    level: {
      type: DataTypes.ENUM('info', 'warning', 'danger'),
      allowNull: false,
      defaultValue: 'warning'
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    triggerValue: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'trigger_value'
    },
    thresholdValue: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'threshold_value'
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'resolved', 'ignored'),
      allowNull: false,
      defaultValue: 'pending'
    },
    handledBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'handled_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    handledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'handled_at'
    },
    handleNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'handle_note'
    },
    pushStatus: {
      type: DataTypes.ENUM('pending', 'sent', 'failed', 'partial'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'push_status'
    },
    pushedGuardians: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: 'pushed_guardians'
    }
  },
  {
    sequelize,
    modelName: 'Alert',
    tableName: 'alerts',
    indexes: [
      { fields: ['child_id'] },
      { fields: ['device_id'] },
      { fields: ['type'] },
      { fields: ['status'] },
      { fields: ['level'] },
      { fields: ['created_at'] },
      { fields: ['child_id', 'status'] }
    ]
  }
);

export default Alert;
