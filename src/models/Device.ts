import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface DeviceAttributes {
  id: string;
  deviceId: string;
  deviceType: 'watch' | 'bracelet' | 'tag';
  model?: string;
  manufacturer?: string;
  firmwareVersion?: string;
  imei?: string;
  simNumber?: string;
  batteryLevel?: number;
  signalStrength?: number;
  isCharging?: boolean;
  lastOnlineAt?: Date;
  childId?: string;
  bindStatus: 'unbound' | 'bound' | 'merged';
  mergedToDeviceId?: string;
  status: 'online' | 'offline' | 'disabled' | 'tampered';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DeviceCreationAttributes extends Optional<DeviceAttributes, 'id' | 'bindStatus' | 'status'> {}

class Device extends Model<DeviceAttributes, DeviceCreationAttributes> implements DeviceAttributes {
  public id!: string;
  public deviceId!: string;
  public deviceType!: 'watch' | 'bracelet' | 'tag';
  public model?: string;
  public manufacturer?: string;
  public firmwareVersion?: string;
  public imei?: string;
  public simNumber?: string;
  public batteryLevel?: number;
  public signalStrength?: number;
  public isCharging?: boolean;
  public lastOnlineAt?: Date;
  public childId?: string;
  public bindStatus!: 'unbound' | 'bound' | 'merged';
  public mergedToDeviceId?: string;
  public status!: 'online' | 'offline' | 'disabled' | 'tampered';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Device.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    deviceId: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'device_id'
    },
    deviceType: {
      type: DataTypes.ENUM('watch', 'bracelet', 'tag'),
      allowNull: false,
      defaultValue: 'watch',
      field: 'device_type'
    },
    model: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    firmwareVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'firmware_version'
    },
    imei: {
      type: DataTypes.STRING(15),
      allowNull: true,
      unique: true
    },
    simNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'sim_number'
    },
    batteryLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 100,
      field: 'battery_level',
      comment: '0-100'
    },
    signalStrength: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'signal_strength',
      comment: '0-100'
    },
    isCharging: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      field: 'is_charging'
    },
    lastOnlineAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_online_at'
    },
    childId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'child_id',
      references: {
        model: 'children',
        key: 'id'
      }
    },
    bindStatus: {
      type: DataTypes.ENUM('unbound', 'bound', 'merged'),
      allowNull: false,
      defaultValue: 'unbound',
      field: 'bind_status'
    },
    mergedToDeviceId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'merged_to_device_id',
      references: {
        model: 'devices',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('online', 'offline', 'disabled', 'tampered'),
      allowNull: false,
      defaultValue: 'offline'
    }
  },
  {
    sequelize,
    modelName: 'Device',
    tableName: 'devices',
    indexes: [
      { fields: ['device_id'], unique: true },
      { fields: ['imei'], unique: true },
      { fields: ['child_id'] },
      { fields: ['bind_status'] },
      { fields: ['status'] }
    ]
  }
);

export default Device;
