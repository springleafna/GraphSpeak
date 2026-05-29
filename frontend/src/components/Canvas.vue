<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  xml: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['change', 'save-request'])

const iframeRef = ref(null)
const isReady = ref(false)
const currentXml = ref(props.xml)
const currentPageInfo = ref({ id: null, name: null })
const uniquePageId = ref(`page-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`)

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
          
          // Try to extract page info from the XML itself if msg.details is missing
          if (msg.xml.includes('<mxfile>')) {
            try {
              const parser = new DOMParser()
              const xmlDoc = parser.parseFromString(msg.xml, 'text/xml')
              // The active page in draw.io is usually the one without a hidden="1" attribute
              // or just the first one if we can't tell. 
              // But draw.io usually sends the current page in 'details' for change events.
              if (msg.details && msg.details.currentPage) {
                currentPageInfo.value = {
                  id: msg.details.currentPage.id,
                  name: msg.details.currentPage.name
                }
              }
            } catch (e) {
              console.error('Error parsing XML for page info:', e)
            }
          }
          
          emit('change', msg.xml)
        }
        // Handle explicit save button click
        if (msg.event === 'save') {
          // Notify parent that save was requested
          emit('save-request', msg.xml)
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

const createEmptyMxFile = () => {
  return `<mxfile><diagram id="${uniquePageId.value}" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
}

const normalizeGraphXml = (xmlString) => {
  let processedXml = xmlString && xmlString.trim() !== '' ? xmlString : createEmptyMxFile()

  processedXml = processedXml.replace(/<GraphDataModel/g, '<mxGraphModel').replace(/<\/GraphDataModel>/g, '</mxGraphModel>')
  processedXml = processedXml.replace(/<Cell\b/g, '<mxCell').replace(/<\/Cell>/g, '</mxCell>')
  processedXml = processedXml.replace(/<Geometry\b/g, '<mxGeometry').replace(/<\/Geometry>/g, '</mxGeometry>')
  processedXml = processedXml.replace(/<Point\b/g, '<mxPoint').replace(/<\/Point>/g, '</mxPoint>')
  processedXml = processedXml.replace(/\b_x=/g, 'x=').replace(/\b_y=/g, 'y=')

  const parser = new DOMParser()
  let xmlDoc = parser.parseFromString(processedXml, 'text/xml')

  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('Invalid XML')
  }

  if (!xmlDoc.querySelector('mxfile')) {
    const model = xmlDoc.querySelector('mxGraphModel')
    processedXml = model
      ? `<mxfile><diagram id="${uniquePageId.value}" name="Page-1">${new XMLSerializer().serializeToString(model)}</diagram></mxfile>`
      : createEmptyMxFile()
    xmlDoc = parser.parseFromString(processedXml, 'text/xml')
  }

  xmlDoc.querySelectorAll('[id]').forEach(el => {
    if (!['mxCell', 'diagram'].includes(el.tagName)) {
      el.removeAttribute('id')
    }
  })

  xmlDoc.querySelectorAll('mxGeometry').forEach(geometry => {
    if (!geometry.getAttribute('as')) {
      geometry.setAttribute('as', 'geometry')
    }
  })

  xmlDoc.querySelectorAll('mxCell').forEach(cell => {
    if (!cell.getAttribute('id')) {
      cell.setAttribute('id', 'cell_' + Math.random().toString(36).substr(2, 5))
    }
    Array.from(cell.children).forEach(child => {
      if (child.tagName === 'mxCell') {
        cell.removeChild(child)
      }
    })
  })

  const validIds = new Set(['0', '1'])
  xmlDoc.querySelectorAll('mxCell[id]').forEach(cell => validIds.add(cell.getAttribute('id')))

  xmlDoc.querySelectorAll('mxCell').forEach(cell => {
    ['parent', 'source', 'target'].forEach(attr => {
      const val = cell.getAttribute(attr)
      if (val && !validIds.has(val)) {
        cell.removeAttribute(attr)
        if (attr === 'parent') {
          cell.setAttribute('parent', '1')
        }
      }
    })
  })

  xmlDoc.querySelectorAll('mxGraphModel').forEach(model => {
    let root = model.querySelector('root')
    if (!root) {
      root = xmlDoc.createElement('root')
      model.appendChild(root)
    }

    if (!root.querySelector('mxCell[id="0"]')) {
      const cell0 = xmlDoc.createElement('mxCell')
      cell0.setAttribute('id', '0')
      root.insertBefore(cell0, root.firstChild)
    }
    if (!root.querySelector('mxCell[id="1"]')) {
      const cell1 = xmlDoc.createElement('mxCell')
      cell1.setAttribute('id', '1')
      cell1.setAttribute('parent', '0')
      const cell0 = root.querySelector('mxCell[id="0"]')
      cell0.after(cell1)
    }
  })

  return new XMLSerializer().serializeToString(xmlDoc)
}

const loadXml = (xmlString) => {
  if (!isReady.value) return
  
  let processedXml = createEmptyMxFile()

  try {
    processedXml = normalizeGraphXml(xmlString)
    currentXml.value = processedXml
  } catch (e) {
    console.error('XML Sanitization error:', e)
  }

  postMessage({
    action: 'load',
    xml: processedXml,
    autosave: 1,
  })
}

const getXml = () => {
  return currentXml.value
}

/**
 * Extracts the XML of the currently active page from the full mxfile.
 * If the XML is not a multi-page mxfile, returns the whole XML.
 */
const getActivePageData = () => {
  const fullXml = currentXml.value
  if (!fullXml) return { xml: '', id: null, name: null }

  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(fullXml, 'text/xml')
    const mxfile = xmlDoc.querySelector('mxfile')
    
    if (!mxfile) {
      return { xml: fullXml, id: null, name: null }
    }

    // Try to find the active diagram. 
    // In draw.io XML, the active diagram is usually the one without a hidden attribute 
    // or we can use the one tracked by currentPageInfo
    const diagrams = Array.from(xmlDoc.querySelectorAll('diagram'))
    let activeDiagram = diagrams.find(d => d.getAttribute('id') === currentPageInfo.value.id)
    
    if (!activeDiagram && diagrams.length > 0) {
      activeDiagram = diagrams[0] // Fallback to first page
    }

    if (activeDiagram) {
      const model = activeDiagram.querySelector('mxGraphModel')
      return {
        xml: model ? new XMLSerializer().serializeToString(model) : '',
        id: activeDiagram.getAttribute('id'),
        name: activeDiagram.getAttribute('name')
      }
    }
  } catch (e) {
    console.error('Error extracting active page data:', e)
  }

  return { xml: fullXml, id: null, name: null }
}

/**
 * Merges a single page's mxGraphModel XML back into the full mxfile.
 */
const mergePageXml = (pageXml, pageId) => {
  let fullXml = currentXml.value
  
  // If the incoming XML is already a full mxfile, we should try to merge its diagrams
  // instead of just replacing the whole thing, but for now let's assume pageXml 
  // is just the mxGraphModel part.
  const isIncomingFull = pageXml.includes('<mxfile>')
  const isCurrentFull = fullXml && fullXml.includes('<mxfile>')

  try {
    const parser = new DOMParser()
    
    // 1. Ensure we have a working fullXml base
    if (!isCurrentFull) {
      // If current is not full, wrap it now to create a multi-page structure
      const baseXml = fullXml && fullXml.trim() !== '' ? fullXml : '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'
      fullXml = `<mxfile><diagram id="page-1" name="Page-1">${baseXml}</diagram></mxfile>`
    }

    const xmlDoc = parser.parseFromString(fullXml, 'text/xml')
    const diagrams = Array.from(xmlDoc.querySelectorAll('diagram'))
    
    // 2. Identify target diagram
    let targetDiagram = diagrams.find(d => d.getAttribute('id') === pageId)
    if (!targetDiagram && currentPageInfo.value.id) {
      targetDiagram = diagrams.find(d => d.getAttribute('id') === currentPageInfo.value.id)
    }
    if (!targetDiagram && diagrams.length > 0) {
      targetDiagram = diagrams[0] // Default to first page
    }

    // 3. Extract the model to insert
    const incomingDoc = parser.parseFromString(pageXml, 'text/xml')
    const incomingModel = incomingDoc.querySelector('mxGraphModel')
    
    if (incomingModel && targetDiagram) {
      const oldModel = targetDiagram.querySelector('mxGraphModel')
      if (oldModel) {
        targetDiagram.replaceChild(xmlDoc.importNode(incomingModel, true), oldModel)
      } else {
        targetDiagram.appendChild(xmlDoc.importNode(incomingModel, true))
      }
      
      const updatedFullXml = new XMLSerializer().serializeToString(xmlDoc)
      loadXml(updatedFullXml)
      currentXml.value = updatedFullXml
      emit('change', updatedFullXml)
      return updatedFullXml
    }
  } catch (e) {
    console.error('Error merging page XML:', e)
  }
  return fullXml
}

// Watch for external XML changes (e.g. AI updates)
watch(() => props.xml, (newXml) => {
  if (newXml !== currentXml.value) {
    loadXml(newXml)
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
  getActivePageData,
  mergePageXml,
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
