# GraphSpeak 数据库设计文档

## 数据库信息

| 项目 | 值 |
|------|-----|
| 数据库类型 | MySQL |
| 版本 | 8.x |
| 字符集 | utf8mb4 |
| 排序规则 | utf8mb4_unicode_ci |

---

## 表结构

### 1. project（项目表）

存储用户的绘图项目信息。

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 项目ID | PRIMARY KEY, AUTO_INCREMENT |
| name | VARCHAR(20) | 项目名称 | NOT NULL |
| xml | LONGTEXT | 图形XML数据（mxGraph格式） | NULL |
| json | JSON | 图形JSON数据 | NULL |
| created_at | DATETIME | 创建时间 | NOT NULL |
| updated_at | DATETIME | 更新时间 | NOT NULL |
| deleted_at | DATETIME | 删除时间（软删除） | NULL |

---

### 2. session（会话表）

存储AI对话会话信息。

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 会话ID | PRIMARY KEY, AUTO_INCREMENT |
| project_id | BIGINT | 关联项目ID | NOT NULL |
| name | VARCHAR(255) | 会话名称（AI基于第一条消息自动生成） | NOT NULL |
| created_at | DATETIME | 创建时间 | NOT NULL |
| updated_at | DATETIME | 更新时间 | NOT NULL |
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
| created_at | DATETIME | 创建时间 | NOT NULL |

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

## SQL 建表语句

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS graphspeak
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE graphspeak;

-- 项目表
CREATE TABLE project (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    xml LONGTEXT,
    json JSON,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会话表
CREATE TABLE session (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息表
CREATE TABLE message (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    role VARCHAR(10) NOT NULL,
    content VARCHAR(2000) NOT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 注意事项

- 无外键约束（应用层控制）
- 暂不考虑索引（后续按需添加）
- 所有时间字段使用 DATETIME 类型
- 字符集统一使用 utf8mb4