import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface RescueLinkAttributes {
  id: string;
  childId: string;
  alertId?: string;
  token: string;
  shortCode: string;
  createdBy: string;
  description?: string;
  expiresAt: Date;
  maxViews?: number;
  viewCount: number;
  isOneTime: boolean;
  isRevoked: boolean;
  isUsed: boolean;
  usedAt?: Date;
  usedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RescueLinkCreationAttributes extends Optional<RescueLinkAttributes, 'id' | 'viewCount' | 'isOneTime' | 'isRevoked' | 'isUsed' | 'maxViews'> {}

class RescueLink extends Model<RescueLinkAttributes, RescueLinkCreationAttributes> implements RescueLinkAttributes {
  public id!: string;
  public childId!: string;
  public alertId?: string;
  public token!: string;
  public shortCode!: string;
  public createdBy!: string;
  public description?: string;
  public expiresAt!: Date;
  public maxViews?: number;
  public viewCount!: number;
  public isOneTime!: boolean;
  public isRevoked!: boolean;
  public isUsed!: boolean;
  public usedAt?: Date;
  public usedBy?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RescueLink.init(
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
    alertId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'alert_id',
      references: {
        model: 'alerts',
        key: 'id'
      }
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    shortCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      field: 'short_code'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    },
    maxViews: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
      field: 'max_views'
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'view_count'
    },
    isOneTime: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_one_time'
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_revoked'
    },
    isUsed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_used'
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at'
    },
    usedBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'used_by'
    }
  },
  {
    sequelize,
    modelName: 'RescueLink',
    tableName: 'rescue_links',
    indexes: [
      { fields: ['child_id'] },
      { fields: ['token'], unique: true },
      { fields: ['short_code'], unique: true },
      { fields: ['created_by'] },
      { fields: ['is_revoked', 'is_used', 'expires_at'] }
    ]
  }
);

export default RescueLink;
