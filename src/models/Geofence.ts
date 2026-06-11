import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface GeofenceAttributes {
  id: string;
  name: string;
  childId?: string;
  organizationId?: string;
  type: 'home' | 'school' | 'scenic' | 'custom';
  shape: 'circle' | 'polygon';
  latitude: number;
  longitude: number;
  radius?: number;
  polygonPoints?: string;
  address?: string;
  isActive: boolean;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
  scheduleStart?: string;
  scheduleEnd?: string;
  weekdays?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GeofenceCreationAttributes extends Optional<GeofenceAttributes, 'id' | 'isActive' | 'notifyOnEnter' | 'notifyOnExit'> {}

class Geofence extends Model<GeofenceAttributes, GeofenceCreationAttributes> implements GeofenceAttributes {
  public id!: string;
  public name!: string;
  public childId?: string;
  public organizationId?: string;
  public type!: 'home' | 'school' | 'scenic' | 'custom';
  public shape!: 'circle' | 'polygon';
  public latitude!: number;
  public longitude!: number;
  public radius?: number;
  public polygonPoints?: string;
  public address?: string;
  public isActive!: boolean;
  public notifyOnEnter!: boolean;
  public notifyOnExit!: boolean;
  public scheduleStart?: string;
  public scheduleEnd?: string;
  public weekdays?: string;
  public createdBy!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Geofence.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
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
    organizationId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'organization_id',
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('home', 'school', 'scenic', 'custom'),
      allowNull: false,
      defaultValue: 'custom'
    },
    shape: {
      type: DataTypes.ENUM('circle', 'polygon'),
      allowNull: false,
      defaultValue: 'circle'
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    radius: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 100,
      comment: '圆形围栏半径，米'
    },
    polygonPoints: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'polygon_points',
      comment: '多边形围栏坐标点JSON'
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    notifyOnEnter: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'notify_on_enter'
    },
    notifyOnExit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'notify_on_exit'
    },
    scheduleStart: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'schedule_start',
      comment: '生效开始时间 HH:mm'
    },
    scheduleEnd: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'schedule_end',
      comment: '生效结束时间 HH:mm'
    },
    weekdays: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '生效星期 1,2,3,4,5,6,7'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    sequelize,
    modelName: 'Geofence',
    tableName: 'geofences',
    indexes: [
      { fields: ['child_id'] },
      { fields: ['organization_id'] },
      { fields: ['type'] },
      { fields: ['is_active'] }
    ]
  }
);

export default Geofence;
