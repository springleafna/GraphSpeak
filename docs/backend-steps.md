# GraphSpeak 后端开发步骤

## 步骤1：项目初始化

### 1.1 创建 NestJS 项目

```bash
cd backend
npm init -y
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
npm install -D @nestjs/cli @nestjs/schematics
npm install -D typescript @types/node @types/express
```

### 1.2 配置 TypeScript

创建 `tsconfig.json`，配置编译选项。

### 1.3 安装 MySQL 驱动和 ORM

```bash
npm install mysql2
npm install typeorm
```

### 1.4 安装 LangChain.js

```bash
npm install @langchain/openai @langchain/anthropic @langchain/core
```

### 1.5 安装配置模块

```bash
npm install @nestjs/config
```

### 1.6 配置环境变量

创建 `.env` 文件，配置数据库和 AI API 密钥。

---

## 步骤2：项目结构搭建

创建以下目录结构：

```
backend/
├── src/
│   ├── main.ts              # 应用入口
│   ├── app.module.ts        # 根模块
│   ├── common/
│   │   ├── database/        # 数据库配置
│   │   │   └── database.module.ts
│   │   └── prompts/         # AI提示词文件目录
│   │       ├── graph.txt    # 图形绘制提示词
│   │       └── session.txt  # 会话标题提示词
│   ├── modules/
│   │   ├── project/         # 项目模块
│   │   ├── session/         # 会话模块
│   │   ├── message/         # 消息模块
│   │   └── ai/              # AI模块
│   └── entities/            # 数据库实体
```

---

## 步骤3：创建 AI 提示词文件

### 3.1 创建图形绘制提示词

创建 `src/common/prompts/graph.txt`，编写 AI 绘图的系统提示词，包括：
- 角色定义
- 支持的图形类型（流程图、架构图、时序图、类图、ER图等）
- 输出格式要求（mxGraph XML 格式）
- 错误处理规则

### 3.2 创建会话标题提示词

创建 `src/common/prompts/session.txt`，编写生成会话名称的系统提示词，包括：
- 任务说明
- 字数限制（不超过10个字）
- 语言要求

---

## 步骤4：数据库配置

### 4.1 创建数据库模块

创建 `src/common/database/database.module.ts`，配置 TypeORM 连接 MySQL。

---

## 步骤5：创建实体

### 5.1 项目实体

创建 `src/entities/project.entity.ts`，定义 Project 实体结构。

### 5.2 会话实体

创建 `src/entities/session.entity.ts`，定义 Session 实体结构。

### 5.3 消息实体

创建 `src/entities/message.entity.ts`，定义 Message 实体结构。

---

## 步骤6：项目模块开发

### 6.1 创建项目服务

创建 `src/modules/project/project.service.ts`，实现以下功能：
- 查找所有项目（按更新时间倒序，过滤已删除）
- 查找单个项目
- 创建项目
- 更新项目
- 软删除项目

### 6.2 创建项目控制器

创建 `src/modules/project/project.controller.ts`，定义 API 端点。

### 6.3 创建项目模块

创建 `src/modules/project/project.module.ts`。

---

## 步骤7：会话模块开发

### 7.1 创建会话服务

创建 `src/modules/session/session.service.ts`，实现以下功能：
- 按项目ID查找会话
- 查找单个会话
- 创建会话
- 更新会话名称
- 软删除会话
- **异步更新会话名称**（调用 AI 生成）

### 7.2 创建会话控制器

创建 `src/modules/session/session.controller.ts`。

### 7.3 创建会话模块

创建 `src/modules/session/session.module.ts`。

---

## 步骤8：消息模块开发

### 8.1 创建消息服务

创建 `src/modules/message/message.service.ts`，实现以下功能：
- 按会话ID查找消息（按创建时间倒序）
- 创建消息

### 8.2 创建消息控制器

创建 `src/modules/message/message.controller.ts`，实现以下端点：
- GET `/api/messages` - 获取消息列表
- POST `/api/messages` - 发送消息
- **GET `/api/messages/stream` - SSE 流式消息接口**

### 8.3 创建消息模块

创建 `src/modules/message/message.module.ts`。

---

## 步骤9：AI 模块开发

### 9.1 创建 AI 服务

创建 `src/modules/ai/ai.service.ts`，实现以下功能：
- 初始化 ChatOpenAI 实例
- **读取提示词文件**：
  - 读取 `src/common/prompts/graph.txt`
  - 读取 `src/common/prompts/session.txt`
- **生成会话名称**：使用会话标题提示词
- **处理用户消息并返回流式响应**：使用图形绘制提示词
- **SSE 流式输出**：逐步推送文本内容和图形数据

### 9.2 创建 AI 模块

创建 `src/modules/ai/ai.module.ts`。

---

## 步骤10：实现 SSE 流式输出

### 10.1 在消息控制器中添加 SSE 端点

实现 `GET /api/messages/stream` 接口：
- 接收查询参数：sessionId, content
- 返回 `text/event-stream` 响应
- 流式推送以下类型的数据：
  ```typescript
  // 文本内容
  { type: 'content', content: '...' }
  
  // 图形数据
  { type: 'graph', graphData: { xml: '...' } }
  
  // 结束标志
  { type: 'end' }
  ```

### 10.2 流式消息保存

在流式输出过程中：
- 收到第一条用户消息时保存到数据库
- 流式输出完成后保存完整 AI 消息

---

## 步骤11：实现异步会话名称生成

### 11.1 创建会话名称生成任务

在创建会话后：
- 检查是否是第一条消息
- 如果是，调用 AI 服务生成会话名称
- 异步更新会话名称

---

## 步骤12：根模块配置

创建 `src/app.module.ts`，导入所有模块。

---

## 步骤13：应用入口

创建 `src/main.ts`，配置：
- 启用 CORS
- 配置全局管道
- 监听端口 3000

---

## 步骤14：启动应用

```bash
npm run build
npm run start:prod
```

或开发模式：

```bash
npm run start:dev
```

---

## 核心要点

### SSE 流式输出实现

1. **响应类型**：`text/event-stream`
2. **数据格式**：JSON 字符串
3. **消息类型**：content（文本）、graph（图形）、end（结束）

### AI 提示词管理

1. **提示词文件位置**：`src/common/prompts/`
2. **文件格式**：纯文本
3. **读取方式**：服务启动时读取或每次调用时读取
4. **文件分离**：
   - `graph.txt` - 图形绘制提示词
   - `session.txt` - 会话标题提示词

### 异步会话名称生成

1. **触发时机**：创建会话后的第一条消息
2. **生成方式**：调用 AI 服务
3. **更新方式**：异步更新数据库