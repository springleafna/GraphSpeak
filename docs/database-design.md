# GraphSpeak 数据库设计文档

## 数据库信息

| 项目 | 值 |
|------|-----|
| 数据库类型 | MySQL |
| 版本 | 8.x |
| ORM 框架 | Prisma |
| 字符集 | utf8mb4 |
| 排序规则 | utf8mb4_unicode_ci |

---

## Prisma Schema

### 数据模型定义

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Project {
  id        BigInt   @id @default(autoincrement())
  name      String   @db.VarChar(20)
  xml       String?  @db.LongText
  json      Json?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  sessions Session[]

  @@map("project")
}

model Session {
  id        BigInt   @id @default(autoincrement())
  projectId BigInt   @map("project_id")
  name      String   @default("新会话") @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  project  Project  @relation(fields: [projectId], references: [id])
  messages Message[]

  @@map("session")
}

model Message {
  id        BigInt   @id @default(autoincrement())
  sessionId BigInt   @map("session_id")
  role      String   @db.VarChar(10)
  content   String   @db.LongText
  createdAt DateTime @default(now()) @map("created_at")
  deletedAt DateTime? @map("deleted_at")

  session   Session  @relation(fields: [sessionId], references: [id])

  @@map("message")
}
```

---

## 表结构说明

### 1. project（项目表）

存储用户的绘图项目信息。

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 项目ID | PRIMARY KEY, AUTO_INCREMENT |
| name | VARCHAR(20) | 项目名称 | NOT NULL |
| xml | LONGTEXT | 图形XML数据（mxGraph格式） | NULL |
| json | JSON | 图形JSON数据 | NULL |
| created_at | DATETIME | 创建时间 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |
| deleted_at | DATETIME | 删除时间（软删除） | NULL |

---

### 2. session（会话表）

存储AI对话会话信息。

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 会话ID | PRIMARY KEY, AUTO_INCREMENT |
| project_id | BIGINT | 关联项目ID | NOT NULL |
| name | VARCHAR(255) | 会话名称（默认"新会话"，AI基于第一条消息异步生成） | NOT NULL, DEFAULT '新会话' |
| created_at | DATETIME | 创建时间 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP |
| deleted_at | DATETIME | 删除时间（软删除） | NULL |

---

### 3. message（消息表）

存储对话消息记录。

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 消息ID | PRIMARY KEY, AUTO_INCREMENT |
| session_id | BIGINT | 关联合会话ID | NOT NULL |
| role | VARCHAR(10) | 角色（user/ai） | NOT NULL |
| content | VARCHAR(2000) | 消息内容 | NOT NULL |
| created_at | DATETIME | 创建时间 | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| deleted_at | DATETIME | 删除时间（软删除） | NULL |

---

## 数据关系

```
project (1) ──────< (n) session (1) ──────< (n) message
```

- 一个项目可以有多个会话
- 一个会话属于一个项目
- 一个会话可以有多个消息
- 一个消息属于一个会话

---

## 字段说明

### 软删除

- `deleted_at` 字段为 NULL 表示未删除
- `deleted_at` 字段有值表示已删除，值为删除时间
- 查询时需过滤 `deleted_at IS NULL`

### 排序规则

- 项目列表：按 `updated_at` 降序（最近修改在前）
- 消息查询：按 `created_at` 降序（新消息在前）

### 会话名称

会话名称由 AI 基于第一条用户消息异步生成。

---

## 使用 Prisma 初始化数据库

### 1. 初始化 Prisma

```bash
npx prisma init
```

### 2. 配置数据库连接

编辑 `.env` 文件：
```
DATABASE_URL="mysql://root:password@localhost:3306/graphspeakspeak"
```

### 3. 定义 Schema

将上述 Prisma Schema 内容写入 `prisma/schema.prisma`。

### 4. 生成 Prisma Client

```bash
npx prisma generate
```

### 5. 执行数据库迁移

```bash
npx prisma migrate dev --name init
```

---

## SQL 建表语句（参考）

Prisma 会自动生成以下 SQL：

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS graphspeak
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 项目表
CREATE TABLE project (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    xml LONGTEXT,
    json JSON,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表
CREATE TABLE session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '新会话',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息表
CREATE TABLE message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    role VARCHAR(10) NOT NULL,
    content LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 注意事项

- 使用 Prisma 管理数据库
- Prisma 会自动处理类型转换和查询
- 软删除通过 `deletedAt` 字段实现
- 所有时间字段自动管理
- 字符集统一使用 utf8mb4
- 关系通过 Prisma Schema 定义