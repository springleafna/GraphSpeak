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

const PANEL_WIDTH = 380
const PANEL_HEIGHT = 520
const PANEL_MARGIN = 20
const HEADER_HEIGHT = 38

const position = ref({
  x: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN,
  y: window.innerHeight - PANEL_HEIGHT - PANEL_MARGIN,
})
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

function startDrag(event) {
  if (event.target.closest('.chat-header')) {
    isDragging.value = true
    dragOffset.value = {
      x: event.clientX - position.value.x,
      y: event.clientY - position.value.y
    }
    window.addEventListener('mousemove', handleDrag)
    window.addEventListener('mouseup', stopDrag)
  }
}

function handleDrag(event) {
  if (isDragging.value) {
    const panelHeight = isCollapsed.value ? HEADER_HEIGHT : PANEL_HEIGHT
    position.value = {
      x: Math.min(Math.max(event.clientX - dragOffset.value.x, 0), window.innerWidth - PANEL_WIDTH),
      y: Math.min(Math.max(event.clientY - dragOffset.value.y, 0), window.innerHeight - panelHeight),
    }
  }
}

function stopDrag() {
  isDragging.value = false
  window.removeEventListener('mousemove', handleDrag)
  window.removeEventListener('mouseup', stopDrag)
}

function toggleCollapse() {
  if (!isDragging.value) {
    isCollapsed.value = !isCollapsed.value
    position.value = {
      ...position.value,
      y: isCollapsed.value
        ? position.value.y + PANEL_HEIGHT - HEADER_HEIGHT
        : position.value.y - PANEL_HEIGHT + HEADER_HEIGHT,
    }
  }
}

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
  <div 
    class="chat-panel" 
    :class="{ collapsed: isCollapsed, dragging: isDragging }"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <div class="chat-body" v-show="!isCollapsed">
      <div class="session-selector">
        <div class="session-select" @click.stop="isSessionListVisible = !isSessionListVisible">
          <span>{{ currentSessionName }}</span>
          <span class="arrow">▼</span>
        </div>
        <button class="new-session-btn" @click="handleCreateSession">新建会话</button>
      </div>

      <!-- Overlay for closing session list -->
      <div v-if="isSessionListVisible" class="session-list-overlay" @click="isSessionListVisible = false"></div>
      
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

    <div class="chat-header" @mousedown="startDrag" @click="toggleCollapse">
      <span class="chat-title">AI 对话</span>
      <span class="toggle-icon">{{ isCollapsed ? '▲' : '▼' }}</span>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  position: fixed;
  width: 380px;
  height: 520px;
  background: #ffffff;
  border: 1px solid #d5d5d5;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  font-family: Helvetica, Arial, sans-serif;
  user-select: none;
  overflow: hidden;
}

.chat-panel.dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.chat-panel.collapsed {
  height: 38px;
  border-radius: 12px;
}

.chat-header {
  height: 38px;
  background: #f5f5f5;
  border-top: 1px solid #d5d5d5;
  padding: 0 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.chat-header:hover {
  background: #ebebeb;
}

.chat-title {
  font-weight: bold;
  font-size: 13px;
  color: #333;
}

.toggle-icon {
  color: #666;
  font-size: 10px;
}

.chat-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.session-selector {
  padding: 8px;
  background: #ffffff;
  border-bottom: 1px solid #eeeeee;
  display: flex;
  gap: 6px;
  position: relative;
  z-index: 1002; /* Ensure buttons are above overlay */
}

.session-select {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid #d5d5d5;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  background: #ffffff;
}

.session-select:hover {
  background: #f5f5f5;
}

.session-select .arrow {
  color: #999;
  font-size: 10px;
}

.new-session-btn {
  padding: 5px 12px;
  background: #0050ef;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
}

.new-session-btn:hover {
  background: #0040c0;
}

.session-list-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1001;
  background: transparent;
}

.session-list {
  position: absolute;
  top: 45px;
  left: 8px;
  right: 8px;
  background: white;
  border: 1px solid #d5d5d5;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1002;
}

.session-option {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #eeeeee;
  font-size: 12px;
}

.session-option:hover {
  background: #f5f5f5;
}

.session-option.active {
  background: #e3f2fd;
  font-weight: bold;
}

.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  background: #fcfcfc;
}

.empty {
  text-align: center;
  color: #888;
  padding: 40px 20px;
  font-size: 12px;
}

.message {
  margin-bottom: 12px;
  display: flex;
}

.message.user {
  justify-content: flex-end;
}

.message.ai {
  justify-content: flex-start;
}

.message-content {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  word-wrap: break-word;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.message.user .message-content {
  background: #e3f2fd;
  border: 1px solid #c5e1f9;
  color: #0d47a1;
}

.message.ai .message-content {
  background: #ffffff;
  border: 1px solid #d5d5d5;
  color: #333;
}

.message.typing .message-content {
  color: #999;
  font-style: italic;
}

.input-area {
  padding: 10px;
  background: #f5f5f5;
  border-top: 1px solid #d5d5d5;
  display: flex;
  gap: 8px;
}

textarea {
  flex: 1;
  min-height: 36px;
  max-height: 100px;
  resize: none;
  border: 1px solid #d5d5d5;
  border-radius: 8px;
  padding: 8px 12px;
  font-family: inherit;
  font-size: 13px;
  background: #ffffff;
}

textarea:focus {
  outline: none;
  border-color: #0050ef;
}

textarea:disabled {
  background: #f9f9f9;
  cursor: not-allowed;
}

.send-btn {
  padding: 6px 16px;
  background: #0050ef;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
  align-self: flex-end;
}

.send-btn:hover:not(:disabled) {
  background: #0040c0;
}

.send-btn:disabled {
  background: #cccccc;
  color: #888;
  cursor: not-allowed;
}
</style>