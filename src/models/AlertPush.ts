import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface AlertPushAttributes {
  id: string;
  alertId: string;
  guardianId: string;
  userId: string;
  pushChannel: 'app' | 'sms' | 'wechat' | 'email' | 'phone';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  messageContent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AlertPushCreationAttributes extends Optional<AlertPushAttributes, 'id' | 'status' | 'retryCount'> {}

class AlertPush extends Model<AlertPushAttributes, AlertPushCreationAttributes> implements AlertPushAttributes {
  public id!: string;
  public alertId!: string;
  public guardianId!: string;
  public userId!: string;
  public pushChannel!: 'app' | 'sms' | 'wechat' | 'email' | 'phone';
  public status!: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  public sentAt?: Date;
  public deliveredAt?: Date;
  public readAt?: Date;
  public failureReason?: string;
  public retryCount!: number;
  public messageContent?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AlertPush.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    alertId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'alert_id',
      references: {
        model: 'alerts',
        key: 'id'
      }
    },
    guardianId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'guardian_id',
      references: {
        model: 'guardians',
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
    pushChannel: {
      type: DataTypes.ENUM('app', 'sms', 'wechat', 'email', 'phone'),
      allowNull: false,
      defaultValue: 'app',
      field: 'push_channel'
    },
    status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'read', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'sent_at'
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'delivered_at'
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'read_at'
    },
    failureReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'failure_reason'
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'retry_count'
    },
    messageContent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'message_content'
    }
  },
  {
    sequelize,
    modelName: 'AlertPush',
    tableName: 'alert_pushes',
    indexes: [
      { fields: ['alert_id'] },
      { fields: ['guardian_id'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
      { fields: ['alert_id', 'status'] }
    ]
  }
);

export default AlertPush;
