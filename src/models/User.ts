import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface UserAttributes {
  id: string;
  username: string;
  password: string;
  realName: string;
  phone: string;
  email?: string;
  role: 'parent' | 'school_admin' | 'scenic_admin' | 'system_admin';
  organizationId?: string;
  avatar?: string;
  status: 'active' | 'disabled';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'status' | 'avatar' | 'email'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public password!: string;
  public realName!: string;
  public phone!: string;
  public email?: string;
  public role!: 'parent' | 'school_admin' | 'scenic_admin' | 'system_admin';
  public organizationId?: string;
  public avatar?: string;
  public status!: 'active' | 'disabled';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    realName: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'real_name'
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('parent', 'school_admin', 'scenic_admin', 'system_admin'),
      allowNull: false,
      defaultValue: 'parent'
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
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'disabled'),
      allowNull: false,
      defaultValue: 'active'
    }
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    indexes: [
      { fields: ['username'] },
      { fields: ['phone'] },
      { fields: ['organization_id'] },
      { fields: ['role'] }
    ]
  }
);

export default User;
