import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface LocationAttributes {
  id: string;
  childId: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  locationType: 'gps' | 'wifi' | 'lbs' | 'cellular';
  batteryLevel?: number;
  signalStrength?: number;
  isCharging?: boolean;
  stepCount?: number;
  reportedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LocationCreationAttributes extends Optional<LocationAttributes, 'id'> {}

class Location extends Model<LocationAttributes, LocationCreationAttributes> implements LocationAttributes {
  public id!: string;
  public childId!: string;
  public deviceId!: string;
  public latitude!: number;
  public longitude!: number;
  public altitude?: number;
  public accuracy?: number;
  public speed?: number;
  public heading?: number;
  public locationType!: 'gps' | 'wifi' | 'lbs' | 'cellular';
  public batteryLevel?: number;
  public signalStrength?: number;
  public isCharging?: boolean;
  public stepCount?: number;
  public reportedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Location.init(
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
      allowNull: false,
      field: 'device_id',
      references: {
        model: 'devices',
        key: 'id'
      }
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: false
    },
    altitude: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: '海拔，米'
    },
    accuracy: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      comment: '定位精度，米'
    },
    speed: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
      comment: '速度，km/h'
    },
    heading: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: '方向，0-360度'
    },
    locationType: {
      type: DataTypes.ENUM('gps', 'wifi', 'lbs', 'cellular'),
      allowNull: false,
      defaultValue: 'gps',
      field: 'location_type'
    },
    batteryLevel: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'battery_level'
    },
    signalStrength: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'signal_strength'
    },
    isCharging: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      field: 'is_charging'
    },
    stepCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'step_count'
    },
    reportedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'reported_at'
    }
  },
  {
    sequelize,
    modelName: 'Location',
    tableName: 'locations',
    indexes: [
      { fields: ['child_id'] },
      { fields: ['device_id'] },
      { fields: ['reported_at'] },
      { fields: ['child_id', 'reported_at'] }
    ]
  }
);

export default Location;
