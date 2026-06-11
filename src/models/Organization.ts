import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface OrganizationAttributes {
  id: string;
  name: string;
  type: 'school' | 'scenic' | 'kindergarten';
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  status: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrganizationCreationAttributes extends Optional<OrganizationAttributes, 'id' | 'status'> {}

class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> implements OrganizationAttributes {
  public id!: string;
  public name!: string;
  public type!: 'school' | 'scenic' | 'kindergarten';
  public address?: string;
  public contactPerson?: string;
  public contactPhone?: string;
  public latitude?: number;
  public longitude?: number;
  public radius?: number;
  public status!: 'active' | 'inactive';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Organization.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('school', 'scenic', 'kindergarten'),
      allowNull: false
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    contactPerson: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'contact_person'
    },
    contactPhone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'contact_phone'
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    radius: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 200,
      comment: '单位：米'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active'
    }
  },
  {
    sequelize,
    modelName: 'Organization',
    tableName: 'organizations',
    indexes: [
      { fields: ['type'] },
      { fields: ['status'] }
    ]
  }
);

export default Organization;
