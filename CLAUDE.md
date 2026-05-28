# GraphSpeak 项目说明

## 项目概述

GraphSpeak 是一个 AI 驱动的绘图工具，用户通过自然语言对话生成流程图、架构图、时序图、类图、ER图等图表，并支持手动编辑。

## 项目结构

```
GraphSpeak/
├── frontend/          # Vue3 前端项目
├── backend/           # NestJS 后端项目
├── docs/              # 项目文档
│   ├── tech-stack.md       # 技术栈
│   ├── requirements.md     # 需求说明
│   ├── database-design.md  # 数据库设计
│   ├── frontend-steps.md   # 前端开发步骤
│   └── backend-steps.md    # 后端开发步骤
└── CLAUDE.md          # 本文档
```

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue3 + Vite + JavaScript + mxGraph |
| 后端 | NestJS + TypeScript + Prisma + MySQL |
| AI | LangChain.js + OpenAI/Claude API |

## 核心功能

- AI 对话生成图形
- 手动编辑图形（拖拽、连线、修改）
- 多项目管理
- 多会话支持
- SSE 流式输出
- 图形导出（PNG）

## 关键特性

### 布局设计

Draw.io 风格：
- 左上角：项目按钮（点击展开项目列表）
- 中心：绘图区域
- 右下角：AI 对话面板（可折叠）
- AI 对话面板内：会话列表

### AI 提示词文件

后端提示词文件位置：`src/common/prompts/`
- `graph.txt` - 图形绘制提示词
- `session.txt` - 会话标题提示词

调用 AI 时需读取这些提示词文件。

### SSE 流式输出

- 后端接口：`GET /api/messages/stream`
- 前端使用 EventSource 连接
- 数据类型：
  - `{ type: 'content', content: '...' }` - 文本内容
  - `{ type: 'graph', graphData: { xml: '...' } }` - 图形数据
  - `{ type: 'end' }` - 结束标志

### 数据库设计

三张表：
- `project` - 项目表
- `session` - 会话表
- `message` - 消息表

使用 Prisma 管理数据库，所有表支持软删除（deletedAt 字段）。

## 开发指南

### 前端开发步骤

参考 `docs/frontend-steps.md`，重点关注：
- mxGraph 集成
- SSE 流式消息接收
- 流式消息实时渲染

### 后端开发步骤

参考 `docs/backend-steps.md`，重点关注：
- AI 提示词文件读取
- SSE 流式输出实现
- 异步会话名称生成

## 数据库初始化

执行 `docs/database-design.md` 中的 SQL 建表语句。

## 环境变量

后端 `.env` 文件：
```
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=graphspeak
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

## 开发模式

```bash
# 前端
cd frontend
npm run dev

# 后端
cd backend
npm run start:dev
```

## 注意事项

1. 无用户系统，单用户使用
2. 项目名称限制 20 字符
3. 消息内容限制 2000 字符
4. 会话名称由 AI 异步生成（基于第一条消息）
5. 无数据库外键约束
6. 暂不考虑索引

## 文档说明

- `tech-stack.md` - 技术选型详情
- `requirements.md` - 完整需求说明
- `database-design.md` - 数据库表结构和 SQL
- `frontend-steps.md` - 前端开发步骤（步骤导向）
- `backend-steps.md` - 后端开发步骤（步骤导向）