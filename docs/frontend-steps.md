# GraphSpeak 前端开发步骤

## 步骤1：项目初始化

### 1.1 创建 Vue3 项目

```bash
cd frontend
npm create vite@latest . -- --template vue
```

### 1.2 安装依赖

```bash
npm install
npm install mxgraph
```

### 1.3 配置 mxGraph

创建 `vite.config.js`，配置 mxGraph 的优化和别名。

---

## 步骤2：项目结构搭建

创建以下目录结构：

```
frontend/
├── src/
│   ├── components/
│   │   ├── Canvas.vue          # 画布组件
│   │   ├── ChatPanel.vue       # AI对话面板
│   │   ├── ProjectList.vue     # 项目列表
│   │   └── SessionList.vue     # 会话列表
│   ├── views/
│   │   └── Editor.vue          # 主编辑器页面
│   ├── api/
│   │   └── index.js            # API封装
│   └── App.vue
```

---

## 步骤3：画布组件开发

### 3.1 创建 Canvas.vue

实现以下功能：
- 初始化 mxGraph 画布
- 启用交互功能（拖拽、连线、编辑）
- 提供加载 XML 数据的方法
- 提供导出为 XML 的方法
- 提供导出为 PNG 的方法
- 监听画布变化事件

---

## 步骤4：项目列表组件开发

### 4.1 创建 ProjectList.vue

实现以下功能：
- 悬浮窗样式
- 展示项目列表
- 新建项目按钮
- 选择项目事件
- 切换显示/隐藏

---

## 步骤5：AI对话面板开发

### 5.1 创建 ChatPanel.vue

实现以下功能：
- 可折叠/展开的对话面板
- 会话列表选择
- 消息展示区域
- 输入框和发送按钮
- **SSE 流式接收 AI 响应**
- 流式消息实时渲染
- 消息滚动到底部
- 接收图形数据并更新画布

### 5.2 实现 SSE 流式接收

```javascript
async function sendMessage() {
  // 创建 SSE 连接
  const eventSource = new EventSource(
    `${BASE_URL}/api/messages/stream?sessionId=${currentSessionId.value}&content=${encodeURIComponent(inputText.value)}`
  )

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)
    // 根据数据类型处理
    if (data.type === 'content') {
      // 流式文本内容
      updateAiMessage(data.content)
    } else if (data.type === 'graph') {
      // 图形数据
      handleGraphUpdate(data.graphData)
    } else if (data.type === 'end') {
      // 结束
      eventSource.close()
    }
  }

  eventSource.onerror = () => {
    eventSource.close()
  }
}
```

---

## 步骤6：API 封装

### 6.1 创建 api/index.js

实现以下 API：
- `getProjects()` - 获取项目列表
- `createProject(data)` - 创建项目
- `updateProject(id, data)` - 更新项目
- `deleteProject(id)` - 删除项目
- `getSessions(projectId)` - 获取会话列表
- `createSession(data)` - 创建会话
- `getMessages(sessionId)` - 获取消息列表
- **SSE 流式消息处理** - 通过 EventSource 接收流式响应

---

## 步骤7：主编辑器页面开发

### 7.1 创建 views/Editor.vue

实现以下功能：
- 顶部工具栏（项目、保存、导出）
- 画布区域
- 集成项目列表组件
- 集成 AI 对话面板
- 处理画布变化事件
- 处理 AI 图形数据更新

---

## 步骤8：App.vue 配置

配置全局样式和路由。

---

## 步骤9：启动开发服务器

```bash
npm run dev
```

---

## 核心要点

### SSE 流式输出实现

1. **后端提供 SSE 接口**：`GET /api/messages/stream`
2. **前端使用 EventSource 连接**
3. **监听消息类型**：
   - `content`：文本内容流
   - `graph`：图形数据
   - `end`：结束标志

### 流式消息渲染

- 创建临时消息对象用于显示
- 追加流式内容到消息
- 实时滚动到最新消息