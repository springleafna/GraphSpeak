<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
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
const isRenaming = ref(false)
const renamingName = ref('')
const nameInputRef = ref(null)

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

function handleSessionSelect(session) {
  currentSession.value = session
}

async function handleGraphUpdate(xml) {
  if (!canvasRef.value || !currentProject.value) return

  const hasModel = xml.includes('<mxGraphModel')
  const hasGraphDataModel = xml.includes('<GraphDataModel')
  const hasFileWrapper = xml.includes('<mxfile')
  const isCurrentMultiPage = currentProject.value?.xml?.includes('<mxfile')
  
  let finalXml = xml

  try {
    if ((hasModel || hasGraphDataModel) && (isCurrentMultiPage || !hasFileWrapper)) {
      const activePage = canvasRef.value.getActivePageData()
      let modelToMerge = xml
      if (hasFileWrapper) {
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, 'text/xml')
        const model = doc.querySelector('mxGraphModel')
        if (model) {
          modelToMerge = new XMLSerializer().serializeToString(model)
        }
      }
      finalXml = canvasRef.value.mergePageXml(modelToMerge, activePage.id)
    } else {
      canvasRef.value.loadXml(xml)
      await nextTick()
      finalXml = canvasRef.value.getXml()
    }

    currentProject.value.xml = finalXml
    await saveProjectXml(finalXml)
  } catch (error) {
    console.error('Graph update error:', error)
    alert('图形更新或保存失败')
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

async function saveProjectXml(xml) {
  if (!currentProject.value) return

  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value)
    autoSaveTimer.value = null
  }

  isSaving.value = true
  try {
    await projectApi.update(currentProject.value.id, { xml })
  } catch (error) {
    console.error('Save project XML error:', error)
    throw error
  } finally {
    isSaving.value = false
  }
}

async function autoSave() {
  if (!currentProject.value || !canvasRef.value) return

  try {
    const xml = canvasRef.value.getXml()
    currentProject.value.xml = xml
    await saveProjectXml(xml)
  } catch (error) {
    console.error('Auto save error:', error)
  }
}

async function handleSave() {
  if (!currentProject.value || !canvasRef.value) return

  isSaving.value = true
  try {
    const xml = canvasRef.value.getXml()
    currentProject.value.xml = xml
    await saveProjectXml(xml)
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

async function startRename() {
  if (!currentProject.value) return
  renamingName.value = currentProject.value.name
  isRenaming.value = true
  await nextTick()
  nameInputRef.value?.focus()
}

async function submitRename() {
  const newName = renamingName.value.trim()
  if (!newName || !currentProject.value || newName === currentProject.value.name) {
    isRenaming.value = false
    return
  }

  try {
    await projectApi.update(currentProject.value.id, { name: newName })
    currentProject.value.name = newName
    projectListRef.value?.refresh()
  } catch (error) {
    console.error('Rename error:', error)
    alert('重命名失败')
  } finally {
    isRenaming.value = false
  }
}

function handleProjectRename(updatedProject) {
  if (currentProject.value?.id === updatedProject.id) {
    currentProject.value.name = updatedProject.name
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
function handleChatContext(response) {
  if (canvasRef.value) {
    response.activePage = canvasRef.value.getActivePageData()
  }
}
</script>

<template>
  <div class="editor">
    <div class="toolbar">
      <button class="toolbar-btn" @click="toggleProjectList">
        项目 ▼
      </button>
      <div class="project-info" v-if="currentProject">
        <div v-if="isRenaming" class="rename-container">
          <input
            ref="nameInputRef"
            v-model="renamingName"
            class="rename-input"
            @blur="submitRename"
            @keypress.enter="submitRename"
          />
        </div>
        <div v-else class="project-name" @click="startRename" title="点击重命名">
          {{ currentProject.name }}
          <span class="edit-icon">✎</span>
        </div>
      </div>
    </div>

    <div class="canvas-container">
      <Canvas
        ref="canvasRef"
        :xml="currentProject?.xml"
        @change="handleCanvasChange"
        @save-request="handleSave"
      />
    </div>

    <ProjectList
      ref="projectListRef"
      @select="handleProjectSelect"
      @create="createNewProject"
      @rename="handleProjectRename"
    />

    <ChatPanel
      ref="chatPanelRef"
      :project-id="currentProject?.id"
      :session-id="currentSession?.id"
      @session-change="handleSessionSelect"
      @graph-update="handleGraphUpdate"
      @get-context="handleChatContext"
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
  padding: 6px 14px;
  background: white;
  border: 1px solid #d5d5d5;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
  color: #333;
}

.toolbar-btn.primary-btn {
  background: #0050ef;
  color: white;
  border-color: #0040c0;
}

.toolbar-btn.primary-btn:hover:not(:disabled) {
  background: #0040c0;
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

.project-name {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.project-name:hover {
  background: #eee;
  color: #333;
}

.edit-icon {
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.project-name:hover .edit-icon {
  opacity: 1;
}

.rename-container {
  display: flex;
  align-items: center;
}

.rename-input {
  padding: 4px 8px;
  border: 1px solid #0050ef;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  width: 200px;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
}
</style>