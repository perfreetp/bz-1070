import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export type CheckInType = 'enter' | 'exit';
export type CheckInMethod = 'device' | 'gate' | 'manual' | 'face' | 'qr';
export type CheckInStatus = 'success' | 'failed' | 'pending_verification';

export interface CheckInRecordAttributes {
  id: string;
  childId: string;
  organizationId: string;
  deviceId?: string;
  guardianId?: string;
  type: CheckInType;
  method: CheckInMethod;
  status: CheckInStatus;
  latitude?: number;
  longitude?: number;
  gateName?: string;
  verifiedBy?: string;
  verificationNote?: string;
  photoUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CheckInRecordCreationAttributes extends Optional<CheckInRecordAttributes, 'id' | 'status'> {}

class CheckInRecord extends Model<CheckInRecordAttributes, CheckInRecordCreationAttributes> implements CheckInRecordAttributes {
  public id!: string;
  public childId!: string;
  public organizationId!: string;
  public deviceId?: string;
  public guardianId?: string;
  public type!: CheckInType;
  public method!: CheckInMethod;
  public status!: CheckInStatus;
  public latitude?: number;
  public longitude?: number;
  public gateName?: string;
  public verifiedBy?: string;
  public verificationNote?: string;
  public photoUrl?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CheckInRecord.init(
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
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'organization_id',
      references: {
        model: 'organizations',
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
    guardianId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'guardian_id',
      references: {
        model: 'guardians',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('enter', 'exit'),
      allowNull: false
    },
    method: {
      type: DataTypes.ENUM('device', 'gate', 'manual', 'face', 'qr'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'pending_verification'),
      allowNull: false,
      defaultValue: 'success'
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    gateName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'gate_name'
    },
    verifiedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'verified_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verificationNote: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'verification_note'
    },
    photoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'photo_url'
    }
  },
  {
    sequelize,
    modelName: 'CheckInRecord',
    tableName: 'check_in_records',
    indexes: [
      { fields: ['child_id'] },
      { fields: ['organization_id'] },
      { fields: ['type'] },
      { fields: ['created_at'] },
      { fields: ['child_id', 'organization_id', 'created_at'] }
    ]
  }
);

export default CheckInRecord;
