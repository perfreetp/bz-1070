import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export type GuardianRelation = 'father' | 'mother' | 'grandfather' | 'grandmother' | 'uncle' | 'aunt' | 'brother' | 'sister' | 'other';

export interface GuardianAttributes {
  id: string;
  childId: string;
  userId: string;
  relation: GuardianRelation;
  isPrimary: boolean;
  canReceiveAlerts: boolean;
  canViewLocation: boolean;
  canPickup: boolean;
  canManage: boolean;
  pickupQrCode?: string;
  pickupFaceImage?: string;
  status: 'active' | 'revoked' | 'pending';
  expiresAt?: Date;
  authorizedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GuardianCreationAttributes extends Optional<GuardianAttributes, 'id' | 'isPrimary' | 'canReceiveAlerts' | 'canViewLocation' | 'canPickup' | 'canManage' | 'status'> {}

class Guardian extends Model<GuardianAttributes, GuardianCreationAttributes> implements GuardianAttributes {
  public id!: string;
  public childId!: string;
  public userId!: string;
  public relation!: GuardianRelation;
  public isPrimary!: boolean;
  public canReceiveAlerts!: boolean;
  public canViewLocation!: boolean;
  public canPickup!: boolean;
  public canManage!: boolean;
  public pickupQrCode?: string;
  public pickupFaceImage?: string;
  public status!: 'active' | 'revoked' | 'pending';
  public expiresAt?: Date;
  public authorizedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Guardian.init(
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    relation: {
      type: DataTypes.ENUM('father', 'mother', 'grandfather', 'grandmother', 'uncle', 'aunt', 'brother', 'sister', 'other'),
      allowNull: false,
      defaultValue: 'other'
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_primary'
    },
    canReceiveAlerts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'can_receive_alerts'
    },
    canViewLocation: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'can_view_location'
    },
    canPickup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'can_pickup'
    },
    canManage: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'can_manage'
    },
    pickupQrCode: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'pickup_qr_code'
    },
    pickupFaceImage: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'pickup_face_image'
    },
    status: {
      type: DataTypes.ENUM('active', 'revoked', 'pending'),
      allowNull: false,
      defaultValue: 'active'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at'
    },
    authorizedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'authorized_by',
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    sequelize,
    modelName: 'Guardian',
    tableName: 'guardians',
    indexes: [
      { fields: ['child_id'] },
      { fields: ['user_id'] },
      { fields: ['child_id', 'user_id'], unique: true },
      { fields: ['status'] },
      { fields: ['is_primary'] }
    ]
  }
);

export default Guardian;
