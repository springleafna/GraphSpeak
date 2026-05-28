<script setup>
import { ref, onMounted } from 'vue'
import { projectApi } from '@/api'

const emit = defineEmits(['select', 'create', 'delete'])

const isVisible = ref(false)
const projects = ref([])
const loading = ref(false)

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
  emit('select', project)
  isVisible.value = false
}

async function handleDelete(project, event) {
  event.stopPropagation()
  if (!confirm(`确定要删除项目 "${project.name}" 吗？`)) return

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
          <span class="project-name">{{ project.name }}</span>
          <button class="delete-btn" @click="handleDelete(project, $event)" title="删除">×</button>
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
  background: rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.project-list {
  position: absolute;
  top: 60px;
  left: 20px;
  width: 200px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 400px;
  overflow: hidden;
}

.project-list-header {
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

.project-list-content {
  max-height: 340px;
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

.project-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}

.project-item:hover {
  background: #f5f5f5;
}

.project-name {
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