# 儿童防丢后端服务

一个面向儿童安全场景的综合性后端服务，支持智能手表、家长 App、校园门禁系统和景区看板等多终端调用。

## 功能模块

### 1. 儿童档案管理
- 创建、查询、更新、删除儿童资料
- 支持学校/机构关联
- 健康信息、学籍信息管理

### 2. 设备绑定管理
- 设备注册与激活
- 儿童与设备绑定/解绑
- 重复设备合并（支持历史数据迁移）
- 设备状态在线监控

### 3. 位置上报服务
- 手表端 GPS/WiFi/LBS 定位上报
- 电量、信号强度同步上报
- 查询儿童最新位置
- 按时间段查询历史轨迹

### 4. 围栏规则引擎
- 家、学校、景区、自定义围栏
- 支持圆形和多边形围栏
- 进出围栏实时检测
- 按时间段和星期智能生效

### 5. 告警推送中心
- **越界告警**：儿童离开/进入安全区域
- **久停告警**：长时间停留可疑区域
- **拆卸告警**：设备被摘下/拆开
- **低电告警**：设备电量不足提醒
- 多监护人批量推送
- 告警处理流程（待处理→处理中→已解决/忽略）

### 6. 亲友授权体系
- 家长添加/移除监护人
- 精细化权限控制（查看位置、接收告警、接送、管理）
- 接送人身份校验（门禁系统集成）
- 授权撤销与过期

### 7. 应急协寻服务
- 生成一次性协寻分享链接
- 短码快速访问
- 可配置有效期和查看次数限制
- 协寻链接随时撤销

### 8. 记录查询与统计
- 入园/离园打卡记录
- 按机构查看当天在园、离园、异常儿童数量
- 告警类型和级别统计
- 多日趋势分析

## 技术架构

```
技术栈:
├── 框架: Express.js + TypeScript
├── 数据库: PostgreSQL 12+
├── ORM: Sequelize v6
├── 认证: JWT (JSON Web Token)
├── 密码加密: bcryptjs
└── 参数校验: express-validator

目录结构:
src/
├── app.ts                 # Express 应用配置
├── server.ts              # 服务启动入口
├── database/
│   ├── index.ts           # 数据库连接
│   ├── associations.ts    # 模型关联关系
│   └── init.ts            # 数据库初始化脚本
├── models/                # Sequelize 数据模型 (11个表)
│   ├── User.ts
│   ├── Organization.ts
│   ├── Child.ts
│   ├── Device.ts
│   ├── Location.ts
│   ├── Geofence.ts
│   ├── Alert.ts
│   ├── AlertPush.ts
│   ├── Guardian.ts
│   ├── RescueLink.ts
│   └── CheckInRecord.ts
├── routes/                # API 路由控制器
│   ├── auth.ts
│   ├── child.ts
│   ├── device.ts
│   ├── location.ts
│   ├── geofence.ts
│   ├── alert.ts
│   ├── guardian.ts
│   ├── rescue.ts
│   ├── checkIn.ts
│   └── stats.ts
├── services/              # 业务服务层
│   ├── AlertService.ts
│   └── LocationService.ts
├── middleware/            # 中间件
│   ├── auth.ts            # JWT 认证与权限
│   ├── errorHandler.ts    # 全局错误处理
│   └── validation.ts      # 参数校验
└── utils/                 # 工具函数
    ├── auth.ts
    ├── geo.ts             # 地理计算（距离、多边形）
    └── response.ts        # 统一响应格式
```

## 快速开始

### 1. 环境准备

- Node.js >= 16.x
- PostgreSQL >= 12.x

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env` 并根据实际情况修改：

```bash
cp .env.example .env
```

关键配置项：
```
PORT=3000                       # 服务端口
DB_HOST=localhost               # 数据库地址
DB_PORT=5432                    # 数据库端口
DB_NAME=child_safety            # 数据库名
DB_USER=postgres                # 数据库用户名
DB_PASSWORD=postgres            # 数据库密码
JWT_SECRET=your-secret-key      # JWT 密钥（生产环境必须修改）
LOW_BATTERY_THRESHOLD=20        # 低电量告警阈值
```

### 4. 创建数据库

在 PostgreSQL 中创建数据库：

```sql
CREATE DATABASE child_safety;
```

### 5. 初始化数据库（可选，创建示例数据）

```bash
npm run db:init
```

执行后将创建默认用户：
| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 系统管理员 |
| school_admin | admin123 | 学校管理员 |
| scenic_admin | admin123 | 景区管理员 |
| parent1 | parent123 | 家长 |
| parent2 | parent123 | 家长 |

### 6. 启动服务

开发模式（热更新）：
```bash
npm run dev
```

生产模式：
```bash
npm run build
npm start
```

### 7. 验证启动

访问健康检查接口：
```
GET http://localhost:3000/health
```

## API 接口一览

### 认证模块 `/api/auth`
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /login | 用户登录 | 公开 |
| POST | /register | 家长注册 | 公开 |
| GET | /me | 获取当前用户信息 | 已登录 |
| POST | /logout | 退出登录 | 已登录 |

### 儿童档案 `/api/children`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询儿童列表（按权限过滤） |
| GET | /:id | 查询儿童详情 |
| POST | / | 创建儿童档案 |
| PUT | /:id | 更新儿童档案 |
| DELETE | /:id | 删除儿童档案 |

### 设备管理 `/api/devices`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询设备列表 |
| GET | /:id | 查询设备详情 |
| POST | / | 注册新设备 |
| POST | /bind | 绑定儿童与设备 |
| POST | /unbind | 解绑设备 |
| POST | /merge | 合并重复设备 |
| PUT | /report-tamper | 上报拆卸告警 |
| PUT | /:id | 更新设备信息 |

### 位置服务 `/api/locations`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /report | 手表上报位置和电量 |
| GET | /latest/:childId | 查询儿童最新位置 |
| GET | /history/:childId | 按时间段查询历史轨迹 |
| GET | /batch-latest | 批量查询多名儿童最新位置 |

### 围栏规则 `/api/geofences`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询围栏列表 |
| GET | /:id | 查询围栏详情 |
| POST | / | 创建围栏 |
| PUT | /:id | 更新围栏 |
| DELETE | /:id | 删除围栏 |

### 告警中心 `/api/alerts`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询告警列表 |
| GET | /:id | 查询告警详情 |
| PUT | /:id/handle | 处理告警 |
| POST | /:id/re-push | 重新推送告警 |
| GET | /:id/pushes | 查询告警推送记录 |
| GET | /statistics/summary | 告警统计概览 |

### 亲友授权 `/api/guardians`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询授权关系列表 |
| GET | /:id | 查询授权详情 |
| POST | / | 添加授权关系 |
| POST | /verify-pickup | 门禁校验接送权限 |
| PUT | /:id | 更新授权信息 |
| POST | /:id/revoke | 撤销授权 |
| GET | /children/my | 家长查看自己监护的儿童列表 |

### 应急协寻 `/api/rescue`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /access/:token | 访问协寻链接（公开） |
| GET | / | 查询协寻链接列表 |
| GET | /:id | 查询协寻链接详情 |
| POST | / | 创建协寻链接 |
| POST | /:id/revoke | 撤销协寻链接 |

### 打卡记录 `/api/checkin`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询打卡记录 |
| GET | /:id | 查询打卡详情 |
| POST | / | 创建入园/离园记录 |
| PUT | /:id/verify | 人工审核待确认记录 |
| GET | /today/child/:childId | 查询儿童当天打卡情况 |

### 统计看板 `/api/stats`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /organization/daily | 机构当日儿童在园/离园/异常统计 |
| GET | /organization/children-details | 按状态筛选儿童明细 |
| GET | /organization/trend | 多日趋势统计 |
| GET | /dashboard/summary | 全局仪表盘摘要 |

## 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": 1700000000000
}
```

分页响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  },
  "timestamp": 1700000000000
}
```

## 角色权限矩阵

| 能力 | 系统管理员 | 学校/景区管理员 | 家长（主监护人） | 家长（普通授权） |
|------|:---:|:---:|:---:|:---:|
| 管理所有儿童档案 | ✅ | 本机构 | 自己监护的 | 仅查看 |
| 设备注册 | ✅ | ❌ | ❌ | ❌ |
| 绑定/解绑设备 | ✅ | 本机构 | 自己监护的 | ❌ |
| 合并设备 | ✅ | ❌ | ❌ | ❌ |
| 创建围栏 | ✅ | 本机构 | 自己监护的 | ❌ |
| 处理告警 | ✅ | 本机构 | 自己监护的 | 仅查看 |
| 接送授权管理 | ✅ | 本机构 | 自己监护的 | ❌ |
| 协寻链接管理 | ✅ | 本机构 | 自己监护的 | ❌ |
| 机构统计 | ❌ | 本机构 | ❌ | ❌ |

## 告警触发逻辑

### 围栏越界检测
- 每次位置上报时自动检测所有生效围栏
- 比较上一次位置判断是进入还是离开
- 根据围栏配置触发进入/离开告警

### 低电量告警
- 电量 <= 20%（可配置）时触发
- 1小时内不重复告警

### 拆卸告警
- 手表端主动上报 `report-tamper` 接口
- 触发最高级别告警，立即推送所有监护人

## 多终端对接说明

### 智能手表
```
POST /api/locations/report  -  定时上报位置（每30秒~5分钟）
PUT  /api/devices/report-tamper  -  拆卸/关机事件上报
请求头携带: x-device-token: {设备认证令牌}
```

### 家长 App
```
POST /api/auth/login  -  登录获取 Token
GET  /api/guardians/children/my  -  获取监护儿童列表
GET  /api/locations/latest/:childId  -  查看最新位置
WS   /ws/location/:childId  -  实时位置推送（需扩展）
GET  /api/alerts  -  查询告警
PUT  /api/alerts/:id/handle  -  处理告警
POST /api/guardians  -  添加授权亲友
POST /api/rescue  -  生成协寻链接
```

### 校园门禁系统
```
POST /api/guardians/verify-pickup  -  接送人权限校验
POST /api/checkin  -  记录入园/离园
GET  /api/stats/organization/daily  -  当日统计看板
```

### 景区电子看板
```
GET /api/stats/organization/daily  -  在园/离园/异常人数
GET /api/stats/organization/children-details  -  异常儿童明细
GET /api/locations/batch-latest  -  批量获取所有儿童位置
```

## 生产部署建议

1. **数据库配置**
   - 使用主从复制，读请求走从库
   - `locations` 表按月分表或分区
   - 为时间、子ID字段建立复合索引

2. **安全加固**
   - JWT 密钥使用强随机字符串
   - 接口增加速率限制（rate-limit）
   - 敏感操作记录审计日志
   - 启用 HTTPS

3. **高可用**
   - Node.js 使用 PM2 或 Kubernetes 多实例部署
   - 告警推送改用消息队列（RabbitMQ/Kafka）异步处理
   - Redis 缓存热点数据（最新位置、围栏配置）

4. **监控告警**
   - 监控设备在线率、API 响应时间
   - 数据库慢查询分析
   - 关键路径（告警推送）成功率监控

## License

MIT
