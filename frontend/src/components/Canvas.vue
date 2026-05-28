<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  Graph,
  InternalEvent,
  ImageExport,
  PanningHandler,
  RubberBandHandler,
  xmlUtils,
  Codec,
  GraphDataModel,
  registerModelCodecs,
} from '@maxgraph/core'

// 初始化 maxGraph 解码器，确保支持 XML 解析
registerModelCodecs()

import '@maxgraph/core/css/common.css'

const props = defineProps({
  xml: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['change'])

const canvasRef = ref(null)
const graphRef = ref(null)
let graph = null
let isEmittingChange = false

// 监听 xml 属性变化，自动加载图形
watch(() => props.xml, (newXml) => {
  if (newXml && graph) {
    // 只有当新 XML 与当前图形不同时才加载，避免循环更新
    const currentXml = getXml()
    if (newXml !== currentXml) {
      loadXml(newXml)
    }
  }
})

onMounted(() => {
  initGraph()
  if (props.xml) {
    loadXml(props.xml)
  }
})

onBeforeUnmount(() => {
  if (graph) {
    graph.getDataModel().removeAllListeners()
  }
})

function initGraph() {
  const container = canvasRef.value
  if (!container) return

  try {
    graph = new Graph(container)
    graphRef.value = graph

    const style = graph.getStylesheet().getDefaultEdgeStyle()
    style.rounded = true
    style.strokeWidth = 2
    graph.getStylesheet().putDefaultEdgeStyle(style)

    graph.setPanning(true)
    graph.setTooltips(true)
    graph.setConnectable(true)
    graph.setEnabled(true)

    new PanningHandler(graph)
    new RubberBandHandler(graph)

    graph.getView().setTranslate(0, 0)
    graph.center()

    graph.getDataModel().addListener(InternalEvent.CHANGE, () => {
      if (!isEmittingChange) {
        emit('change')
      }
    })
  } catch (error) {
    console.error('maxGraph initialization error:', error)
  }
}

function loadXml(xmlString) {
  if (!graph || !xmlString) return

  console.log('Loading XML into graph...')
  try {
    isEmittingChange = true
    const doc = xmlUtils.parseXml(xmlString)
    
    // 使用临时模型解码，避免直接操作主模型可能导致的递归问题
    const tempModel = new GraphDataModel()
    const codec = new Codec(doc)
    codec.decode(doc.documentElement, tempModel)
    
    const newRoot = tempModel.getRoot()
    if (!newRoot) {
      console.warn('No root cell found in decoded XML')
      return
    }

    graph.getDataModel().beginUpdate()
    try {
      graph.getDataModel().setRoot(newRoot)
      
      // 强制刷新视图
      graph.view.revalidate()
      graph.refresh()
      
      // 延迟居中，确保容器尺寸已就绪
      setTimeout(() => {
        graph.center()
      }, 0)
    } finally {
      graph.getDataModel().endUpdate()
    }
    console.log('XML loaded successfully')
  } catch (error) {
    console.error('Load XML error:', error)
  } finally {
    isEmittingChange = false
  }
}

function getXml() {
  if (!graph) return ''
  try {
    const model = graph.getDataModel()
    const codec = new Codec()
    const node = codec.encode(model)
    if (node) {
      return xmlUtils.getXml(node)
    }
    return ''
  } catch (error) {
    console.error('Get XML error:', error)
    return ''
  }
}

function exportAsPng() {
  if (!graph) return Promise.resolve(null)

  try {
    const bounds = graph.getGraphBounds()
    const scale = graph.getView().getScale()

    const width = Math.ceil(bounds.width * scale) + 20
    const height = Math.ceil(bounds.height * scale) + 20

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    const imgExport = new ImageExport()
    imgExport.drawState(graph.getView(), canvas)

    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const dataUrl = canvas.toDataURL('image/png')
          resolve(dataUrl)
        } catch (e) {
          resolve(null)
        }
      }, 100)
    })
  } catch (error) {
    console.error('Export PNG error:', error)
    return Promise.resolve(null)
  }
}

function clearCanvas() {
  if (!graph) return
  try {
    graph.getDataModel().beginUpdate()
    try {
      graph.getDataModel().clear()
    } finally {
      graph.getDataModel().endUpdate()
    }
  } catch (error) {
    console.error('Clear canvas error:', error)
  }
}

defineExpose({
  loadXml,
  getXml,
  exportAsPng,
  clearCanvas,
})
</script>

<template>
  <div ref="canvasRef" class="graph-container"></div>
</template>

<style scoped>
.graph-container {
  width: 100%;
  height: 100%;
  background: white;
}
</style>