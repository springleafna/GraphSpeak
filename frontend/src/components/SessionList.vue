<script setup>
import { ref, watch } from 'vue'
import { sessionApi } from '@/api'

const props = defineProps({
  projectId: {
    type: [Number, null],
    default: null,
  },
  currentSessionId: {
    type: [Number, null],
    default: null,
  },
})

const emit = defineEmits(['select', 'create', 'delete'])

const isVisible = ref(false)
const sessions = ref([])
const loading = ref(false)

watch(() => props.projectId, () => {
  if (isVisible.value) {
    loadSessions()
  }
}, { immediate: true })

async function loadSessions() {
  if (!props.projectId) {
    sessions.value = []
    return
  }
  loading.value = true
  try {
    sessions.value = await sessionApi.list(props.projectId)
  } catch (error) {
    console.error('Load sessions error:', error)
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!props.projectId) {
    alert('请先选择项目')
    return
  }
  try {
    await sessionApi.create({ projectId: props.projectId })
    await loadSessions()
    emit('create')
  } catch (error) {
    console.error('Create session error:', error)
    alert('创建会话失败')
  }
}

async function handleSelect(session) {
  emit('select', session)
  isVisible.value = false
}

async function handleDelete(session, event) {
  event.stopPropagation()
  if (!confirm(`确定要删除会话 "${session.name}" 吗？`)) return

  try {
    await sessionApi.delete(session.id)
    await loadSessions()
    emit('delete', session)
  } catch (error) {
    console.error('Delete session error:', error)
    alert('删除会话失败')
  }
}

function toggle() {
  isVisible.value = !isVisible.value
  if (isVisible.value) {
    loadSessions()
  }
}

function close() {
  isVisible.value = false
}

defineExpose({
  toggle,
  close,
  refresh: loadSessions,
})
</script>

<template>
  <div v-if="isVisible" class="session-list-overlay" @click="close">
    <div class="session-list" @click.stop>
      <div class="session-list-header">
        <span>会话列表</span>
        <button class="close-btn" @click="close">×</button>
      </div>
      <div class="session-list-content">
        <button class="create-btn" @click="handleCreate" :disabled="loading">
          {{ loading ? '加载中...' : '+ 新建会话' }}
        </button>
        <div v-if="sessions.length === 0 && !loading" class="empty">
          暂无会话
        </div>
        <div
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: session.id === currentSessionId }"
          @click="handleSelect(session)"
        >
          <span class="session-name">{{ session.name }}</span>
          <button class="delete-btn" @click="handleDelete(session, $event)" title="删除">×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.session-list {
  position: absolute;
  bottom: 80px;
  right: 20px;
  width: 200px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 300px;
  overflow: hidden;
}

.session-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
  font-weight: 500;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  line-height: 1;
}

.close-btn:hover {
  color: #f44336;
}

.session-list-content {
  max-height: 240px;
  overflow-y: auto;
}

.create-btn {
  width: 100%;
  padding: 10px 16px;
  background: #2196f3;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.create-btn:hover:not(:disabled) {
  background: #1976d2;
}

.create-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.empty {
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.session-item:hover {
  background: #f5f5f5;
}

.session-item.active {
  background: #e3f2fd;
}

.session-name {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  line-height: 1;
  margin-left: 8px;
  color: #999;
}

.delete-btn:hover {
  color: #f44336;
}
</style>