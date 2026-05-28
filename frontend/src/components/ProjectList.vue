<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { projectApi } from '@/api'

const emit = defineEmits(['select', 'create', 'delete', 'rename'])

const isVisible = ref(false)
const projects = ref([])
const loading = ref(false)
const editingProjectId = ref(null)
const editingName = ref('')
const editInputRef = ref(null)

onMounted(() => {
  loadProjects()
})

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await projectApi.list()
  } catch (error) {
    console.error('Load projects error:', error)
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  try {
    await projectApi.create({ name: '未命名项目' })
    await loadProjects()
    emit('create')
  } catch (error) {
    console.error('Create project error:', error)
    alert('创建项目失败')
  }
}

async function handleSelect(project) {
  if (editingProjectId.value === project.id) return
  emit('select', project)
  isVisible.value = false
}

async function handleRename(project, event) {
  event.stopPropagation()
  editingProjectId.value = project.id
  editingName.value = project.name
  await nextTick()
  editInputRef.value?.[0]?.focus()
}

async function submitRename(project) {
  const newName = editingName.value.trim()
  if (!newName || newName === project.name) {
    editingProjectId.value = null
    return
  }

  try {
    await projectApi.update(project.id, { name: newName })
    project.name = newName
    emit('rename', project)
  } catch (error) {
    console.error('Rename project error:', error)
    alert('重命名失败')
  } finally {
    editingProjectId.value = null
  }
}

async function handleDelete(project, event) {
  event.stopPropagation()
  if (editingProjectId.value === project.id) return

  try {
    await projectApi.delete(project.id)
    await loadProjects()
    emit('delete', project)
  } catch (error) {
    console.error('Delete project error:', error)
    alert('删除项目失败')
  }
}

function toggle() {
  isVisible.value = !isVisible.value
  if (isVisible.value) {
    loadProjects()
  }
}

function close() {
  isVisible.value = false
}

defineExpose({
  toggle,
  close,
  refresh: loadProjects,
})
</script>

<template>
  <div v-if="isVisible" class="project-list-overlay" @click="close">
    <div class="project-list" @click.stop>
      <div class="project-list-header">
        <span>项目列表</span>
        <button class="close-btn" @click="close">×</button>
      </div>
      <div class="project-list-content">
        <button class="create-btn" @click="handleCreate" :disabled="loading">
          {{ loading ? '加载中...' : '+ 新建项目' }}
        </button>
        <div v-if="projects.length === 0 && !loading" class="empty">
          暂无项目
        </div>
        <div
          v-for="project in projects"
          :key="project.id"
          class="project-item"
          @click="handleSelect(project)"
        >
          <div v-if="editingProjectId === project.id" class="edit-wrapper" @click.stop>
            <input
              ref="editInputRef"
              v-model="editingName"
              class="edit-input"
              @blur="submitRename(project)"
              @keypress.enter="submitRename(project)"
              @click.stop
            />
          </div>
          <template v-else>
            <span class="project-name" :title="project.name">{{ project.name }}</span>
            <div class="project-actions">
              <button class="action-btn rename-btn" @click="handleRename(project, $event)" title="重命名">✎</button>
              <button class="action-btn delete-btn" @click="handleDelete(project, $event)" title="删除">×</button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.project-list-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.project-list {
  position: absolute;
  top: 60px;
  left: 20px;
  width: 240px;
  background: #ffffff;
  border: 1px solid #d5d5d5;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  max-height: 500px;
  overflow: hidden;
  font-family: Helvetica, Arial, sans-serif;
}

.project-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #f5f5f5;
  border-bottom: 1px solid #d5d5d5;
  font-weight: bold;
  font-size: 13px;
  color: #333;
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
  color: #666;
}

.close-btn:hover {
  color: #f44336;
}

.project-list-content {
  max-height: 440px;
  overflow-y: auto;
  background: #ffffff;
}

.create-btn {
  width: calc(100% - 20px);
  margin: 10px;
  padding: 8px 12px;
  background: #0050ef;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
}

.create-btn:hover:not(:disabled) {
  background: #0040c0;
}

.create-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

.empty {
  padding: 30px 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 14px;
  cursor: pointer;
  border-bottom: 1px solid #eeeeee;
  transition: background 0.1s;
  height: 40px;
}

.project-item:hover {
  background: #f9f9f9;
}

.edit-wrapper {
  flex: 1;
  display: flex;
}

.edit-input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #0050ef;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.project-name {
  flex: 1;
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
}

.project-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.project-item:hover .project-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.action-btn:hover {
  background: #eee;
  color: #333;
}

.rename-btn:hover {
  color: #0050ef;
}

.delete-btn:hover {
  color: #f44336;
}
</style>