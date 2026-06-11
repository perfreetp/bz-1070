import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database/index';

export interface ChildAttributes {
  id: string;
  name: string;
  gender: 'male' | 'female';
  birthDate: Date;
  idCardNumber?: string;
  avatar?: string;
  height?: number;
  weight?: number;
  bloodType?: 'A' | 'B' | 'AB' | 'O';
  healthInfo?: string;
  address?: string;
  organizationId?: string;
  studentId?: string;
  class?: string;
  grade?: string;
  status: 'normal' | 'missing' | 'rescued';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChildCreationAttributes extends Optional<ChildAttributes, 'id' | 'status'> {}

class Child extends Model<ChildAttributes, ChildCreationAttributes> implements ChildAttributes {
  public id!: string;
  public name!: string;
  public gender!: 'male' | 'female';
  public birthDate!: Date;
  public idCardNumber?: string;
  public avatar?: string;
  public height?: number;
  public weight?: number;
  public bloodType?: 'A' | 'B' | 'AB' | 'O';
  public healthInfo?: string;
  public address?: string;
  public organizationId?: string;
  public studentId?: string;
  public class?: string;
  public grade?: string;
  public status!: 'normal' | 'missing' | 'rescued';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Child.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    gender: {
      type: DataTypes.ENUM('male', 'female'),
      allowNull: false
    },
    birthDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'birth_date'
    },
    idCardNumber: {
      type: DataTypes.STRING(18),
      allowNull: true,
      field: 'id_card_number'
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    height: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: '身高cm'
    },
    weight: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment: '体重kg'
    },
    bloodType: {
      type: DataTypes.ENUM('A', 'B', 'AB', 'O'),
      allowNull: true,
      field: 'blood_type'
    },
    healthInfo: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'health_info'
    },
    address: {
      type: DataTypes.STRING(500),
      allowNull: true
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
    studentId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'student_id'
    },
    class: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'class_name'
    },
    grade: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('normal', 'missing', 'rescued'),
      allowNull: false,
      defaultValue: 'normal'
    }
  },
  {
    sequelize,
    modelName: 'Child',
    tableName: 'children',
    indexes: [
      { fields: ['name'] },
      { fields: ['organization_id'] },
      { fields: ['status'] },
      { fields: ['student_id'] }
    ]
  }
);

export default Child;
