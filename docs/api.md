# GraphSpeak API 接口文档

## 基础信息

- **Base URL**: `http://localhost:3000`
- **数据格式**: JSON
- **字符编码**: UTF-8

---

## 统一响应格式

所有接口返回统一的响应格式：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | int | 状态码，表示接口调用的执行情况 |
| message | string | 提示信息，对接口调用结果进行描述 |
| data | T | 泛型数据，表示接口调用返回的数据 |

---

## 业务状态码

| code | 说明 |
|------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 项目接口

### 1. 获取项目列表

**接口**: `GET /api/projects`

**请求参数**: 无

**响应**:
```json
{
  "code": 200,
  "message": "获取项目列表成功",
  "data": [
    {
      "id": 1,
      "name": "用户注册流程图",
      "xml": null,
      "json": null,
      "created_at": "2026-05-28T10:00:00Z",
      "updated_at": "2026-05-28T11:00:00Z",
      "deleted_at": null
    }
  ]
}
```

---

### 2. 创建项目

**接口**: `POST /api/projects`

**请求体**:
```json
{
  "name": "未命名项目"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "创建项目成功",
  "data": {
    "id": 2,
    "name": "未命名项目",
    "xml": null,
    "json": null,
    "created_at": "2026-05-28T12:00:00Z",
    "updated_at": "2026-05-28T12:00:00Z",
    "deleted_at": null
  }
}
```

---

### 3. 获取单个项目

**接口**: `GET /api/projects/:id`

**路径参数**:
- `id`: 项目ID

**响应**:
```json
{
  "code": 200,
  "message": "获取项目成功",
  "data": {
    "id": 1,
    "name": "用户注册流程图",
    "xml": "<mxGraphModel>...</mxGraphModel>",
    "json": { ... },
    "created_at": "2026-05-28T10:00:00Z",
    "updated_at": "2026-05-28T11:00:00Z",
    "deleted_at": null
  }
}
```

**失败响应**:
```json
{
  "code": 404,
  "message": "项目不存在",
  "data": null
}
```

---

### 4. 更新项目

**接口**: `PUT /api/projects/:id`

**路径参数**:
- `id`: 项目ID

**请求体**:
```json
{
  "name": "新项目名称",
  "xml": "<mxGraphModel>...</mxGraphModel>",
  "json": { ... }
}
```

**响应**:
```json
{
  "code": 200,
  "message": "更新项目成功",
  "data": {
    "id": 1,
    "name": "新项目名称",
    "xml": "<mxGraphModel>...</mxGraphModel>",
    "json": { ... },
    "created_at": "2026-05-28T10:00:00Z",
    "updated_at": "2026-05-28T13:00:00Z",
    "deleted_at": null
  }
}
```

---

### 5. 删除项目

**接口**: `DELETE /api/projects/:id`

**路径参数**:
- `id`: 项目ID

**响应**:
```json
{
  "code": 200,
  "message": "删除项目成功",
  "data": null
}
```

---

## 会话接口

### 6. 获取会话列表

**接口**: `GET /api/sessions`

**查询参数**:
- `projectId`: 项目ID（必填）

**响应**:
```json
{
  "code": 200,
  "message": "获取会话列表成功",
  "data": [
    {
      "id": 1,
      "project_id": 1,
      "name": "用户注册流程图",
      "created_at": "2026-05-28T10:00:00Z",
      "updated_at": "2026-05-28T11:00:00Z",
      "deleted_at": null
    }
  ]
}
```

---

### 7. 创建会话

**接口**: `POST /api/sessions`

**请求体**:
```json
{
  "projectId": 1
}
```

**响应**:
```json
{
  "code": 200,
  "message": "创建会话成功",
  "data": {
    "id": 2,
    "project_id": 1,
    "name": "新会话",
    "created_at": "2026-05-28T12:00:00Z",
    "updated_at": "2026-05-28T12:00:00Z",
    "deleted_at": null
  }
}
```

**注意**: 会话名称会由 AI 异步生成（基于第一条消息）

---

### 8. 删除会话

**接口**: `DELETE /api/sessions/:id`

**路径参数**:
- `id`: 会话ID

**响应**:
```json
{
  "code": 200,
  "message": "删除会话成功",
  "data": null
}
```

---

## 消息接口

### 9. 获取消息列表

**接口**: `GET /api/messages`

**查询参数**:
- `sessionId`: 会话ID（必填）

**响应**:
```json
{
  "code": 200,
  "message": "获取消息列表成功",
  "data": [
    {
      "id": 1,
      "session_id": 1,
      "role": "user",
      "content": "画一个用户注册流程图",
      "created_at": "2026-05-28T10:00:00Z"
    },
    {
      "id": 2,
      "session_id": 1,
      "role": "ai",
      "content": "好的，我来为您生成用户注册流程图...",
      "created_at": "2026-05-28T10:01:00Z"
    }
  ]
}
```

---

### 10. SSE 流式消息接口

**接口**: `POST /api/messages/stream`

**请求体**:
```json
{
  "sessionId": 1,
  "content": "画一个用户注册流程图"
}
```

**响应类型**: `text/event-stream`

**消息格式**:

```json
// 文本内容
{
  "type": "content",
  "content": "好的，我来"
}

{
  "type": "content",
  "content": "为您生成"
}

{
  "type": "content",
  "content": "用户注册流程图..."
}

// 图形数据
{
  "type": "graph",
  "graphData": {
    "xml": "<mxGraphModel>...</mxGraphModel>"
  }
}

// 结束标志
{
  "type": "end"
}
```

**使用方式**:
```javascript
fetch('/api/messages/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: sessionId,
    content: content
  })
}).then(response => {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  
  function readStream() {
    reader.read().then(({ done, value }) => {
      if (done) return
      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      lines.forEach(line => {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6))
          switch(data.type) {
            case 'content':
              // 处理流式文本
              break
            case 'graph':
              // 处理图形数据
              break
            case 'end':
              // 结束
              break
          }
        }
      })
      readStream()
    })
  }
  
  readStream()
})
```

---

## 导出接口

### 11. 导出为 PNG

**说明**: 导出功能由前端实现，后端不提供此接口。前端通过 mxGraph 将画布导出为 PNG。

---

## 错误响应示例

### 请求参数错误

```json
{
  "code": 400,
  "message": "项目ID不能为空",
  "data": null
}
```

### 资源不存在

```json
{
  "code": 404,
  "message": "项目不存在",
  "data": null
}
```

### 服务器错误

```json
{
  "code": 500,
  "message": "服务器内部错误",
  "data": null
}
```

---

## 注意事项

1. **软删除**: 删除操作仅设置 `deleted_at` 字段，不真正删除数据
2. **排序规则**:
   - 项目列表：按 `updated_at` 降序
   - 消息列表：按 `created_at` 降序
3. **异步会话名称**: 创建会话后，第一条消息会触发 AI 生成会话名称
4. **流式输出**: 使用 SSE 实时推送 AI 响应
5. **无认证**: 当前无用户系统，不需要鉴权
6. **CORS**: 后端需启用 CORS
7. **统一响应格式**: 所有接口返回 code、message、data 三个字段