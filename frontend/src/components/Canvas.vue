<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  xml: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['change'])

const iframeRef = ref(null)
const isReady = ref(false)
const currentXml = ref(props.xml)

// draw.io embed URL parameters
// embed=1: enable embed mode
// ui=min: minimal UI
// proto=json: use JSON protocol for postMessage
// spin=1: show loading spinner
// configure=1: allow sending configuration before loading
const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&ui=min&proto=json&spin=1&configure=1'

// Listen for messages from draw.io iframe
const handleMessage = (event) => {
  if (!event.data || typeof event.data !== 'string') return
  
  try {
    const msg = JSON.parse(event.data)
    
    switch (msg.event) {
      case 'configure':
        // draw.io is asking for configuration
        sendConfig()
        break
      case 'init':
        // draw.io is ready after configuration
        isReady.value = true
        loadXml(props.xml || '')
        break
      case 'autosave':
      case 'change':
      case 'save':
        // XML updated in draw.io
        if (msg.xml) {
          currentXml.value = msg.xml
          emit('change', msg.xml)
        }
        // If it's a 'save' event, draw.io might expect an acknowledgment or just close
        if (msg.event === 'save') {
          // You can handle explicit save button click here
        }
        break
      case 'export':
        // Handle export result (e.g. PNG data)
        if (window._exportResolver) {
          window._exportResolver(msg.data)
          window._exportResolver = null
        }
        break
    }
  } catch (e) {
    // Not a JSON message or not from draw.io
  }
}

const postMessage = (action) => {
  if (iframeRef.value && iframeRef.value.contentWindow) {
    iframeRef.value.contentWindow.postMessage(JSON.stringify(action), '*')
  }
}

const sendConfig = () => {
  postMessage({
    action: 'configure',
    config: {
      defaultFonts: ['Humor Sans', 'Helvetica', 'Arial'],
    }
  })
}

const loadXml = (xmlString) => {
  if (!isReady.value) return
  
  let finalXml = xmlString
  
  // 1. Basic empty structure if nothing is provided
  if (!finalXml || finalXml.trim() === '') {
    finalXml = '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'
  }
  
  // 2. Comprehensive conversion from maxGraph to mxGraph (draw.io)
  let processedXml = finalXml
  processedXml = processedXml.replace(/<GraphDataModel/g, '<mxGraphModel').replace(/<\/GraphDataModel>/g, '</mxGraphModel>')
  processedXml = processedXml.replace(/<Cell\b/g, '<mxCell').replace(/<\/Cell>/g, '</mxCell>')
  processedXml = processedXml.replace(/<Geometry\b/g, '<mxGeometry').replace(/<\/Geometry>/g, '</mxGeometry>')
  processedXml = processedXml.replace(/<Point\b/g, '<mxPoint').replace(/<\/Point>/g, '</mxPoint>')
  processedXml = processedXml.replace(/\b_x=/g, 'x=').replace(/\b_y=/g, 'y=')

  // 3. Advanced Sanitization using DOMParser to fix dangling references
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(processedXml, 'text/xml')
    
    // Fix empty IDs first
    const allCells = xmlDoc.querySelectorAll('mxCell, Cell')
    allCells.forEach(cell => {
      if (!cell.getAttribute('id')) {
        cell.setAttribute('id', 'cell_' + Math.random().toString(36).substr(2, 5))
      }
      // CRITICAL FIX: If there's a nested mxCell inside a Cell/mxCell, remove the inner one
      const innerMxCell = cell.querySelector('mxCell')
      if (innerMxCell) {
        cell.removeChild(innerMxCell)
      }
    })

    // Collect all valid IDs
    const validIds = new Set()
    xmlDoc.querySelectorAll('[id]').forEach(el => validIds.add(el.getAttribute('id')))
    
    // Add mandatory IDs to valid set (we will ensure they exist below)
    validIds.add('0')
    validIds.add('1')

    // Check and fix dangling references (parent, source, target)
    xmlDoc.querySelectorAll('mxCell').forEach(cell => {
      ['parent', 'source', 'target'].forEach(attr => {
        const val = cell.getAttribute(attr)
        if (val && !validIds.has(val)) {
          console.warn(`Removing dangling reference ${attr}="${val}" from cell ${cell.getAttribute('id')}`)
          cell.removeAttribute(attr)
          // If parent is removed, default it to "1" (the default layer)
          if (attr === 'parent') {
            cell.setAttribute('parent', '1')
          }
        }
      })
    })

    // Ensure Root structure exists
    let root = xmlDoc.querySelector('root')
    if (!root) {
      const model = xmlDoc.querySelector('mxGraphModel')
      if (model) {
        root = xmlDoc.createElement('root')
        model.appendChild(root)
      }
    }

    if (root) {
      if (!xmlDoc.querySelector('mxCell[id="0"]')) {
        const cell0 = xmlDoc.createElement('mxCell')
        cell0.setAttribute('id', '0')
        root.insertBefore(cell0, root.firstChild)
      }
      if (!xmlDoc.querySelector('mxCell[id="1"]')) {
        const cell1 = xmlDoc.createElement('mxCell')
        cell1.setAttribute('id', '1')
        cell1.setAttribute('parent', '0')
        const cell0 = xmlDoc.querySelector('mxCell[id="0"]')
        cell0.after(cell1)
      }
    }

    processedXml = new XMLSerializer().serializeToString(xmlDoc)
  } catch (e) {
    console.error('XML Sanitization error:', e)
  }

  console.log('Final Sanitized XML to draw.io:', processedXml.substring(0, 200) + '...')
  
  postMessage({
    action: 'load',
    xml: processedXml,
    autosave: 1,
  })
}

const getXml = () => {
  return currentXml.value
}

// Watch for external XML changes (e.g. AI updates)
watch(() => props.xml, (newXml) => {
  if (newXml !== currentXml.value) {
    loadXml(newXml)
    currentXml.value = newXml
  }
})

onMounted(() => {
  window.addEventListener('message', handleMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleMessage)
})

// Export functionality
const exportAsPng = () => {
  return new Promise((resolve) => {
    if (!isReady.value) return resolve(null)
    
    window._exportResolver = resolve
    postMessage({
      action: 'export',
      format: 'png',
      spin: 'Exporting...',
    })
    
    // Timeout as fallback
    setTimeout(() => {
      if (window._exportResolver) {
        window._exportResolver(null)
        window._exportResolver = null
      }
    }, 10000)
  })
}

const clearCanvas = () => {
  loadXml('')
}

defineExpose({
  loadXml,
  getXml,
  exportAsPng,
  clearCanvas,
})
</script>

<template>
  <div class="canvas-wrapper">
    <iframe
      ref="iframeRef"
      :src="DRAWIO_URL"
      class="drawio-iframe"
      frameborder="0"
    ></iframe>
  </div>
</template>

<style scoped>
.canvas-wrapper {
  width: 100%;
  height: 100%;
  background: white;
  position: relative;
}

.drawio-iframe {
  width: 100%;
  height: 100%;
  border: none;
}
</style>
