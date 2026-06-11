import bcrypt from 'bcryptjs';
import { sequelize, User, Organization } from './associations';

async function initDatabase() {
  try {
    console.log('正在连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功！');

    console.log('正在同步表结构...');
    await sequelize.sync({ force: true });
    console.log('表结构同步完成！');

    console.log('正在创建初始数据...');

    const adminPassword = await bcrypt.hash('admin123', 10);
    const parentPassword = await bcrypt.hash('parent123', 10);

    const [school, scenic] = await Organization.bulkCreate([
      {
        name: '阳光小学',
        type: 'school',
        address: '北京市朝阳区阳光路100号',
        contactPerson: '王校长',
        contactPhone: '010-12345678',
        latitude: 39.9042,
        longitude: 116.4074,
        radius: 300,
        status: 'active'
      },
      {
        name: '欢乐谷景区',
        type: 'scenic',
        address: '北京市东四环小武基北路',
        contactPerson: '李经理',
        contactPhone: '010-87654321',
        latitude: 39.8700,
        longitude: 116.4800,
        radius: 1000,
        status: 'active'
      }
    ]);

    await User.bulkCreate([
      {
        username: 'admin',
        password: adminPassword,
        realName: '系统管理员',
        phone: '13800000000',
        email: 'admin@example.com',
        role: 'system_admin',
        status: 'active'
      },
      {
        username: 'school_admin',
        password: adminPassword,
        realName: '学校管理员',
        phone: '13800000001',
        email: 'school@example.com',
        role: 'school_admin',
        organizationId: school.id,
        status: 'active'
      },
      {
        username: 'scenic_admin',
        password: adminPassword,
        realName: '景区管理员',
        phone: '13800000002',
        email: 'scenic@example.com',
        role: 'scenic_admin',
        organizationId: scenic.id,
        status: 'active'
      },
      {
        username: 'parent1',
        password: parentPassword,
        realName: '张伟爸爸',
        phone: '13900000001',
        email: 'zhangwei_dad@example.com',
        role: 'parent',
        status: 'active'
      },
      {
        username: 'parent2',
        password: parentPassword,
        realName: '张伟妈妈',
        phone: '13900000002',
        email: 'zhangwei_mom@example.com',
        role: 'parent',
        status: 'active'
      }
    ]);

    console.log('初始数据创建完成！');
    console.log('默认账号：');
    console.log('  系统管理员: admin / admin123');
    console.log('  学校管理员: school_admin / admin123');
    console.log('  景区管理员: scenic_admin / admin123');
    console.log('  家长账号: parent1 / parent123');
    console.log('  家长账号: parent2 / parent123');

    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initDatabase();
