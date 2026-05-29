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
const pendingActivePageInfo = ref(null)
const activePageSnapshot = ref(null)
const isSyncingXml = ref(false)
const uniquePageId = ref(`page-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`)

// draw.io embed URL parameters
// embed=1: enable embed mode
// ui=min: minimal UI
// proto=json: use JSON protocol for postMessage
// spin=1: show loading spinner
// configure=1: allow sending configuration before loading
const DRAWIO_URL = 'https://embed.diagrams.net/?embed=1&ui=min&proto=json&spin=1&configure=1'

const setCurrentPageInfo = (page) => {
  if (!page) return false
  const id = page.id || page.pageId
  const name = page.name || page.title
  if (id || name) {
    currentPageInfo.value = {
      id: id || currentPageInfo.value.id,
      name: name || currentPageInfo.value.name,
    }
    return true
  }
  return false
}

const extractPageInfoFromMessage = (msg) => {
  const candidates = [
    msg.currentPage,
    msg.page,
    msg.details?.currentPage,
    msg.details?.page,
    msg.pageId || msg.pageName ? { id: msg.pageId, name: msg.pageName } : null,
  ]
  return candidates.find(page => page && (page.id || page.pageId || page.name || page.title)) || null
}

const rememberCurrentPageFromMessage = (msg) => {
  return setCurrentPageInfo(extractPageInfoFromMessage(msg))
}

const getDiagramSnapshots = (xmlString) => {
  if (!xmlString) return []
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(normalizeGraphXml(xmlString), 'text/xml')
    return Array.from(xmlDoc.documentElement.children)
      .filter(child => child.tagName === 'diagram')
      .map(diagram => ({
        id: diagram.getAttribute('id'),
        name: diagram.getAttribute('name'),
        xml: new XMLSerializer().serializeToString(diagram),
      }))
  } catch (e) {
    return []
  }
}

const updateCurrentPageByXmlChange = (previousXml, nextXml) => {
  const previousDiagrams = getDiagramSnapshots(previousXml)
  const nextDiagrams = getDiagramSnapshots(nextXml)
  if (nextDiagrams.length === 0) return null

  const previousMap = new Map(previousDiagrams.map(diagram => [diagram.id || diagram.name, diagram.xml]))
  const changedDiagram = nextDiagrams.find(diagram => previousMap.get(diagram.id || diagram.name) !== diagram.xml)
  const targetDiagram = changedDiagram || nextDiagrams.find(diagram => diagram.id === currentPageInfo.value.id) || nextDiagrams[0]
  setCurrentPageInfo(targetDiagram)
  return targetDiagram
}

const isMultiPageXml = (xmlString) => {
  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(normalizeGraphXml(xmlString), 'text/xml')
    return Array.from(xmlDoc.documentElement.children).filter(child => child.tagName === 'diagram').length > 1
  } catch (e) {
    return false
  }
}

// Listen for messages from draw.io iframe
const handleMessage = (event) => {
  if (!event.data || typeof event.data !== 'string') return
  
  try {
    const msg = JSON.parse(event.data)
    rememberCurrentPageFromMessage(msg)
    
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
          const previousXml = currentXml.value
          currentXml.value = msg.xml
          updateCurrentPageByXmlChange(previousXml, msg.xml)
          
          // Try to extract page info from the XML itself if msg.details is missing
          if (msg.xml.includes('<mxfile')) {
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
        if (msg.event === 'save' && !isSyncingXml.value) {
          // Notify parent that save was requested
          emit('save-request', msg.xml)
        }
        break
      case 'page':
      case 'pages':
      case 'pageChanged':
        rememberCurrentPageFromMessage(msg)
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
  return `<mxfile host="GraphSpeak"><diagram id="${uniquePageId.value}" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`
}

const serializeNodeChildren = (node) => {
  return Array.from(node.childNodes).map(child => new XMLSerializer().serializeToString(child)).join('')
}

const createDiagramXml = (modelXml, id, name) => {
  return `<diagram id="${id || `page-${Math.random().toString(36).substr(2, 5)}`}" name="${name || 'Page'}">${modelXml}</diagram>`
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

  const rootElement = xmlDoc.documentElement
  const serializer = new XMLSerializer()

  if (rootElement?.tagName === 'mxfile') {
    const diagrams = Array.from(rootElement.children).filter(child => child.tagName === 'diagram')
    if (diagrams.length === 0) {
      processedXml = createEmptyMxFile()
    } else {
      const normalizedDiagrams = diagrams.map((diagram, index) => {
        const nestedMxfile = diagram.querySelector(':scope > mxfile')
        const model = diagram.querySelector(':scope > mxGraphModel') || nestedMxfile?.querySelector('mxGraphModel')
        const diagramId = diagram.getAttribute('id') || `page-${index + 1}`
        const diagramName = diagram.getAttribute('name') || `Page-${index + 1}`
        if (model) {
          return createDiagramXml(serializer.serializeToString(model), diagramId, diagramName)
        }
        return createDiagramXml(serializeNodeChildren(diagram), diagramId, diagramName)
      })
      processedXml = `<mxfile host="${rootElement.getAttribute('host') || 'GraphSpeak'}">${normalizedDiagrams.join('')}</mxfile>`
    }
    xmlDoc = parser.parseFromString(processedXml, 'text/xml')
  } else {
    const model = xmlDoc.querySelector('mxGraphModel')
    processedXml = model
      ? `<mxfile host="GraphSpeak">${createDiagramXml(serializer.serializeToString(model), uniquePageId.value, 'Page-1')}</mxfile>`
      : createEmptyMxFile()
    xmlDoc = parser.parseFromString(processedXml, 'text/xml')
  }

  xmlDoc.querySelectorAll('mxfile mxfile').forEach(nestedMxfile => {
    const parentDiagram = nestedMxfile.parentElement
    const nestedModel = nestedMxfile.querySelector('mxGraphModel')
    if (parentDiagram?.tagName === 'diagram' && nestedModel) {
      parentDiagram.replaceChildren(xmlDoc.importNode(nestedModel, true))
    }
  })

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

const requestCurrentXml = () => {
  return new Promise((resolve) => {
    if (!isReady.value) return resolve({ xml: currentXml.value, pageInfo: currentPageInfo.value, hasReliablePageInfo: Boolean(currentPageInfo.value.id || currentPageInfo.value.name) })

    const previousSnapshot = currentXml.value
    let resolved = false
    let hasReliablePageInfo = false
    const cleanup = () => {
      window.removeEventListener('message', handleSyncMessage)
    }
    const done = (xml) => {
      if (resolved) return
      resolved = true
      isSyncingXml.value = false
      cleanup()
      resolve({
        xml: xml || currentXml.value,
        pageInfo: currentPageInfo.value,
        hasReliablePageInfo: hasReliablePageInfo || Boolean(currentPageInfo.value.id || currentPageInfo.value.name),
      })
    }
    const handleSyncMessage = (event) => {
      if (!event.data || typeof event.data !== 'string') return
      try {
        const msg = JSON.parse(event.data)
        if ((msg.event === 'autosave' || msg.event === 'save' || msg.event === 'change') && msg.xml) {
          currentXml.value = msg.xml
          const explicitPageInfo = rememberCurrentPageFromMessage(msg)
          if (explicitPageInfo) {
            hasReliablePageInfo = true
          } else {
            const changedPage = updateCurrentPageByXmlChange(previousSnapshot, msg.xml)
            hasReliablePageInfo = Boolean(changedPage)
          }
          done(msg.xml)
        }
      } catch (e) {
      }
    }

    window.addEventListener('message', handleSyncMessage)
    isSyncingXml.value = true
    postMessage({ action: 'status' })
    postMessage({ action: 'save', exit: 0 })
    setTimeout(() => done(currentXml.value), 500)
  })
}

const getSyncedActivePageData = async () => {
  const syncResult = await requestCurrentXml()
  const activePage = getActivePageData(syncResult.pageInfo, false)
  const hasMultiplePages = isMultiPageXml(syncResult.xml)
  const hasReliablePageInfo = syncResult.hasReliablePageInfo && Boolean(activePage.id || activePage.name)
  activePageSnapshot.value = {
    id: activePage.id,
    name: activePage.name,
  }
  return {
    ...activePage,
    isReliable: !hasMultiplePages || hasReliablePageInfo,
    isMultiPage: hasMultiplePages,
  }
}

/**
 * Extracts the XML of the currently active page from the full mxfile.
 * If the XML is not a multi-page mxfile, returns the whole XML.
 */
const getActivePageData = (preferredPageInfo = null, allowFallback = true) => {
  const fullXml = currentXml.value
  if (!fullXml) return { xml: '', id: null, name: null }

  try {
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(fullXml, 'text/xml')
    const mxfile = xmlDoc.querySelector('mxfile')
    const preferredPageId = preferredPageInfo?.id || currentPageInfo.value.id
    const preferredPageName = preferredPageInfo?.name || currentPageInfo.value.name
    
    if (!mxfile) {
      return { xml: fullXml, id: preferredPageId || null, name: preferredPageName || null, isMultiPage: false }
    }

    const diagrams = Array.from(xmlDoc.documentElement.children).filter(child => child.tagName === 'diagram')
    const isMultiPage = diagrams.length > 1
    let activeDiagram = diagrams.find(d => d.getAttribute('id') === preferredPageId)
    
    if (!activeDiagram && preferredPageName) {
      activeDiagram = diagrams.find(d => d.getAttribute('name') === preferredPageName)
    }

    if (!activeDiagram && allowFallback && diagrams.length > 0) {
      activeDiagram = diagrams[0]
    }

    if (activeDiagram) {
      const model = activeDiagram.querySelector('mxGraphModel')
      const pageInfo = {
        id: activeDiagram.getAttribute('id'),
        name: activeDiagram.getAttribute('name')
      }
      currentPageInfo.value = pageInfo
      return {
        xml: model ? new XMLSerializer().serializeToString(model) : '',
        ...pageInfo,
        isMultiPage,
      }
    }
  } catch (e) {
    console.error('Error extracting active page data:', e)
  }

  return { xml: fullXml, id: currentPageInfo.value.id, name: currentPageInfo.value.name, isMultiPage: false }
}

/**
 * Merges a single page's mxGraphModel XML back into the full mxfile.
 */
const setActivePageInfo = (pageInfo) => {
  setCurrentPageInfo(pageInfo)
  pendingActivePageInfo.value = pageInfo
}

const mergePageXml = (pageXml, pageId) => {
  let fullXml = currentXml.value

  try {
    const parser = new DOMParser()
    const serializer = new XMLSerializer()
    fullXml = normalizeGraphXml(fullXml)
    const xmlDoc = parser.parseFromString(fullXml, 'text/xml')
    const diagrams = Array.from(xmlDoc.documentElement.children).filter(child => child.tagName === 'diagram')
    const isMultiPage = diagrams.length > 1
    const targetPageId = pageId || pendingActivePageInfo.value?.id || currentPageInfo.value.id
    const targetPageName = pendingActivePageInfo.value?.name || currentPageInfo.value.name
    
    let targetDiagram = diagrams.find(d => d.getAttribute('id') === targetPageId)
    if (!targetDiagram && targetPageName) {
      targetDiagram = diagrams.find(d => d.getAttribute('name') === targetPageName)
    }
    if (!targetDiagram && !isMultiPage && diagrams.length === 1) {
      targetDiagram = diagrams[0]
    }
    if (!targetDiagram) {
      throw new Error('未能定位当前编辑页面')
    }

    const normalizedIncomingXml = normalizeGraphXml(pageXml)
    const incomingDoc = parser.parseFromString(normalizedIncomingXml, 'text/xml')
    const incomingDiagrams = Array.from(incomingDoc.documentElement.children).filter(child => child.tagName === 'diagram')
    const incomingModel = incomingDiagrams[0]?.querySelector('mxGraphModel')
    
    if (incomingModel) {
      targetDiagram.replaceChildren(xmlDoc.importNode(incomingModel, true))
    } else {
      throw new Error('AI 未返回有效的 mxGraphModel')
    }

    const updatedFullXml = serializer.serializeToString(xmlDoc)
    loadXml(updatedFullXml)
    currentXml.value = updatedFullXml
    currentPageInfo.value = {
      id: targetDiagram.getAttribute('id'),
      name: targetDiagram.getAttribute('name'),
    }
    pendingActivePageInfo.value = null
    emit('change', updatedFullXml)
    return updatedFullXml
  } catch (e) {
    console.error('Error merging page XML:', e)
    throw e
  }
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
  getSyncedActivePageData,
  getActivePageData,
  setActivePageInfo,
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
