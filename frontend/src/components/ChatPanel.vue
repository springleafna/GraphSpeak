<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { messageApi, sessionApi } from '@/api'

const props = defineProps({
  projectId: {
    type: [Number, null],
    default: null,
  },
  sessionId: {
    type: [Number, null],
    default: null,
  },
})

const emit = defineEmits(['sessionChange', 'graphUpdate'])

const isCollapsed = ref(false)
const isSessionListVisible = ref(false)
const inputText = ref('')
const messages = ref([])
const sessions = ref([])
const loading = ref(false)
const currentAiMessage = ref(null)
const messageContainerRef = ref(null)
const isNewSessionMode = ref(false)
const isStreaming = ref(false)

watch(() => props.sessionId, async (newId) => {
  if (newId) {
    isNewSessionMode.value = false
    if (!isStreaming.value) {
      await loadMessages()
    }
    await loadSessions()
  } else {
    messages.value = []
  }
}, { immediate: true })

watch(() => props.projectId, async () => {
  if (props.projectId) {
    await loadSessions()
  }
}, { immediate: true })

async function loadMessages() {
  if (!props.sessionId) {
    messages.value = []
    return
  }
  loading.value = true
  try {
    messages.value = await messageApi.list(props.sessionId)
    await scrollToBottom()
  } catch (error) {
    console.error('Load messages error:', error)
  } finally {
    loading.value = false
  }
}

async function loadSessions() {
  if (!props.projectId) {
    sessions.value = []
    return
  }
  try {
    sessions.value = await sessionApi.list(props.projectId)
  } catch (error) {
    console.error('Load sessions error:', error)
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messageContainerRef.value) {
    messageContainerRef.value.scrollTop = messageContainerRef.value.scrollHeight
  }
}

async function handleCreateSession() {
  if (!props.projectId) {
    alert('请先选择项目')
    return
  }
  isNewSessionMode.value = true
  emit('sessionChange', null)
  messages.value = []
  isSessionListVisible.value = false
}

async function handleSessionChange(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    isNewSessionMode.value = false
    isStreaming.value = false
    currentAiMessage.value = null
    emit('sessionChange', session)
    isSessionListVisible.value = false
  }
}

function extractXmlFromContent(content) {
  // 同时支持 mxGraphModel 和 GraphDataModel 标签
  const xmlMatch = content.match(/<(mxGraphModel|GraphDataModel)[\s\S]*?<\/\1>/)
  if (xmlMatch) {
    return xmlMatch[0]
  }
  return null
}

async function handleSend() {
  if (!inputText.value.trim()) return
  if (!props.projectId) {
    alert('请先选择项目')
    return
  }

  let sessionId = props.sessionId
  const isNewSession = isNewSessionMode.value || !sessionId

  if (isNewSession) {
    try {
      const session = await sessionApi.create({ projectId: props.projectId })
      emit('sessionChange', session)
      sessionId = session.id
      isNewSessionMode.value = false
      await loadSessions()
    } catch (error) {
      console.error('Create session error:', error)
      alert('创建会话失败')
      return
    }
  }

  const content = inputText.value.trim()
  inputText.value = ''

  messages.value.push({
    role: 'user',
    content,
  })

  await scrollToBottom()

  currentAiMessage.value = {
    role: 'ai',
    content: '',
  }
  messages.value.push(currentAiMessage.value)

  loading.value = true
  isStreaming.value = true

  try {
    await messageApi.stream(sessionId, content, (data) => {
      if (data.type === 'content') {
        currentAiMessage.value.content += data.content

        scrollToBottom()
      } else if (data.type === 'end') {
        const xml = extractXmlFromContent(currentAiMessage.value.content)
        if (xml) {
          emit('graphUpdate', xml)
        }

        loading.value = false
        isStreaming.value = false
        currentAiMessage.value = null
        loadMessages().catch(console.error)
      }
    })
  } catch (error) {
    console.error('Send message error:', error)
    if (currentAiMessage.value) {
      currentAiMessage.value.content = '\n\n❌ 发送失败: ' + error.message
    }
    loading.value = false
    isStreaming.value = false
    currentAiMessage.value = null
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

const currentSessionName = computed(() => {
  if (isNewSessionMode.value) {
    return '新会话'
  }
  if (!props.sessionId) {
    return '点击发送创建新会话'
  }
  const session = sessions.value.find(s => s.id === props.sessionId)
  return session?.name || '新会话'
})

const sessionId = computed(() => isNewSessionMode.value ? null : props.sessionId)

defineExpose({
  refreshMessages: loadMessages,
})
</script>

<template>
  <div class="chat-panel" :class="{ collapsed: isCollapsed }">
    <div class="chat-header" @click="isCollapsed = !isCollapsed">
      <span class="chat-title">💬 AI 对话</span>
      <span class="toggle-icon">{{ isCollapsed ? '▶' : '▼' }}</span>
    </div>

    <div v-if="!isCollapsed" class="chat-body">
      <div class="session-selector">
        <div class="session-select" @click="isSessionListVisible = !isSessionListVisible">
          <span>{{ currentSessionName }}</span>
          <span class="arrow">▼</span>
        </div>
        <button class="new-session-btn" @click="handleCreateSession">新建会话</button>
      </div>

      <div class="session-list" v-if="isSessionListVisible">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-option"
          :class="{ active: session.id === sessionId }"
          @click="handleSessionChange(session.id)"
        >
          {{ session.name }}
        </div>
      </div>

      <div class="messages" ref="messageContainerRef">
        <div v-if="isNewSessionMode || !sessionId" class="empty">
          <p>发送消息将创建新会话</p>
          <p>尝试说："画一个用户注册流程图"</p>
        </div>
        <div v-else-if="messages.length === 0 && !loading" class="empty">
          <p>开始对话吧！</p>
          <p>尝试说："画一个用户注册流程图"</p>
        </div>
        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="message"
          :class="msg.role"
        >
          <div class="message-content">{{ msg.content }}</div>
        </div>
        <div v-if="loading && !currentAiMessage" class="message ai typing">
          <div class="message-content">思考中...</div>
        </div>
      </div>

      <div class="input-area">
        <textarea
          v-model="inputText"
          @keypress="handleKeyPress"
          placeholder="输入您的指令..."
          :disabled="loading"
          rows="2"
        ></textarea>
        <button
          class="send-btn"
          @click="handleSend"
          :disabled="loading || !inputText.trim()"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  position: fixed;
  bottom: 0;
  right: 20px;
  width: 400px;
  max-height: 500px;
  background: white;
  border: 1px solid #ccc;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.chat-panel.collapsed {
  height: auto;
}

.chat-header {
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header:hover {
  background: #eee;
}

.chat-title {
  font-weight: 500;
}

.toggle-icon {
  color: #999;
}

.chat-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.session-selector {
  padding: 10px;
  border-bottom: 1px solid #eee;
  display: flex;
  gap: 8px;
}

.session-select {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}

.session-select:hover {
  background: #f5f5f5;
}

.session-select .arrow {
  color: #999;
  font-size: 12px;
}

.new-session-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.new-session-btn:hover {
  background: #1976d2;
}

.session-list {
  position: absolute;
  bottom: 180px;
  right: 20px;
  width: 380px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1001;
}

.session-option {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.session-option:hover {
  background: #f5f5f5;
}

.session-option.active {
  background: #e3f2fd;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  min-height: 200px;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px 20px;
  font-size: 14px;
}

.message {
  margin-bottom: 8px;
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.message.ai {
  justify-content: flex-start;
}

.message-content {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 8px;
  word-wrap: break-word;
  white-space: pre-wrap;
  font-size: 14px;
}

.message.user .message-content {
  background: #e3f2fd;
}

.message.ai .message-content {
  background: #f5f5f5;
}

.message.typing .message-content {
  color: #999;
}

.input-area {
  padding: 10px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}

textarea {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  resize: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  font-family: inherit;
  font-size: 14px;
}

textarea:focus {
  outline: none;
  border-color: #2196f3;
}

textarea:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.send-btn:hover:not(:disabled) {
  background: #1976d2;
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>