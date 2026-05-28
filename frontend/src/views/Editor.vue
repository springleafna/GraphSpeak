<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import Canvas from '@/components/Canvas.vue'
import ProjectList from '@/components/ProjectList.vue'
import SessionList from '@/components/SessionList.vue'
import ChatPanel from '@/components/ChatPanel.vue'
import { projectApi, sessionApi } from '@/api'

const router = useRouter()

const currentProject = ref(null)
const currentSession = ref(null)
const projectListRef = ref(null)
const sessionListRef = ref(null)
const canvasRef = ref(null)
const chatPanelRef = ref(null)
const isSaving = ref(false)
const autoSaveTimer = ref(null)

onMounted(async () => {
  await loadProjects()
  if (!currentProject.value) {
    await createNewProject()
  }
})

watch(() => currentProject.value?.id, async () => {
  if (currentProject.value?.id) {
    await loadProjectData()
  }
}, { immediate: true })

async function loadProjects() {
  try {
    const projects = await projectApi.list()
    if (projects.length > 0) {
      currentProject.value = projects[0]
    }
  } catch (error) {
    console.error('Load projects error:', error)
  }
}

async function createNewProject() {
  try {
    const project = await projectApi.create({ name: '未命名项目' })
    currentProject.value = project
  } catch (error) {
    console.error('Create project error:', error)
    alert('创建项目失败')
  }
}

async function loadProjectData() {
  try {
    const project = await projectApi.get(currentProject.value.id)
    currentProject.value = project
  } catch (error) {
    console.error('Load project data error:', error)
  }
}

async function createNewSession() {
  try {
    const session = await sessionApi.create({ projectId: currentProject.value.id })
    currentSession.value = session
  } catch (error) {
    console.error('Create session error:', error)
    alert('创建会话失败')
  }
}

async function handleProjectSelect(project) {
  currentProject.value = project
}

async function handleSessionSelect(session) {
  currentSession.value = session
  if (chatPanelRef.value) {
    chatPanelRef.value.refreshMessages()
  }
}

async function handleGraphUpdate(xml) {
  if (canvasRef.value) {
    canvasRef.value.loadXml(xml)
    // 同步更新本地项目数据，确保 UI 状态一致
    if (currentProject.value) {
      currentProject.value.xml = xml
    }
    scheduleAutoSave()
  }
}

function handleCanvasChange() {
  scheduleAutoSave()
}

function scheduleAutoSave() {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
  }
  autoSaveTimer.value = setTimeout(() => {
    autoSave()
  }, 2000)
}

async function autoSave() {
  if (!currentProject.value || !canvasRef.value) return

  isSaving.value = true
  try {
    const xml = canvasRef.value.getXml()
    await projectApi.update(currentProject.value.id, { xml })
  } catch (error) {
    console.error('Auto save error:', error)
  } finally {
    isSaving.value = false
  }
}

async function handleSave() {
  if (!currentProject.value || !canvasRef.value) return

  isSaving.value = true
  try {
    const xml = canvasRef.value.getXml()
    await projectApi.update(currentProject.value.id, { xml })
    alert('保存成功')
  } catch (error) {
    console.error('Save error:', error)
    alert('保存失败')
  } finally {
    isSaving.value = false
  }
}

async function handleExport() {
  if (!canvasRef.value) return

  try {
    const dataUrl = await canvasRef.value.exportAsPng()
    if (dataUrl) {
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${currentProject.value?.name || 'graph'}.png`
      link.click()
    } else {
      alert('导出失败')
    }
  } catch (error) {
    console.error('Export error:', error)
    alert('导出失败')
  }
}

function handleKeyPress(event) {
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault()
    handleSave()
  }
}

document.addEventListener('keydown', handleKeyPress)

onBeforeUnmount(() => {
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
  }
  document.removeEventListener('keydown', handleKeyPress)
})

function toggleProjectList() {
  projectListRef.value?.toggle()
}

function toggleSessionList() {
  sessionListRef.value?.toggle()
}
</script>

<template>
  <div class="editor">
    <div class="toolbar">
      <button class="toolbar-btn" @click="toggleProjectList">
        项目 ▼
      </button>
      <button class="toolbar-btn" @click="handleSave" :disabled="isSaving">
        {{ isSaving ? '保存中...' : '保存' }}
      </button>
      <button class="toolbar-btn" @click="handleExport">
        导出
      </button>
      <div class="project-info" v-if="currentProject">
        {{ currentProject.name }}
      </div>
    </div>

    <div class="canvas-container">
      <Canvas
        ref="canvasRef"
        :xml="currentProject?.xml"
        @change="handleCanvasChange"
      />
    </div>

    <ProjectList
      ref="projectListRef"
      @select="handleProjectSelect"
      @create="createNewProject"
    />

    <ChatPanel
      ref="chatPanelRef"
      :project-id="currentProject?.id"
      :session-id="currentSession?.id"
      @session-change="handleSessionSelect"
      @graph-update="handleGraphUpdate"
    />
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.toolbar {
  height: 50px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 8px;
}

.toolbar-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.toolbar-btn:hover:not(:disabled) {
  background: #e9e9e9;
}

.toolbar-btn:disabled {
  color: #999;
  cursor: not-allowed;
}

.project-info {
  margin-left: auto;
  font-size: 14px;
  color: #666;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
}
</style>