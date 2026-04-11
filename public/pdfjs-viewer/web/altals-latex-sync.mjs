const CHANNEL = 'altals-latex-sync'

function postToParent(type, payload = {}) {
  try {
    window.parent?.postMessage({
      channel: CHANNEL,
      type,
      ...payload,
    }, '*')
  } catch {
    // Ignore parent bridge failures to keep the viewer usable.
  }
}

const webViewerLoaded = new Promise((resolve) => {
  document.addEventListener('webviewerloaded', () => resolve(), { once: true })
  try {
    parent.document.addEventListener('webviewerloaded', () => resolve(), { once: true })
  } catch {
    // Ignore cross-frame access issues.
  }
})

async function getViewerApp() {
  await webViewerLoaded
  await window.PDFViewerApplication.initializedPromise
  return window.PDFViewerApplication
}

async function getViewerEventBus() {
  const app = await getViewerApp()
  return app.eventBus
}

function onPDFViewerEvent(eventName, callback, options = {}) {
  const wrapped = (event) => {
    callback(event)
    if (options.once) {
      window.PDFViewerApplication.eventBus.off(eventName, wrapped)
    }
  }
  void getViewerEventBus().then(eventBus => eventBus.on(eventName, wrapped))
}

function getSelectionContext() {
  const selection = window.getSelection()
  if (!selection?.anchorNode || selection.anchorNode.nodeName !== '#text') {
    return { textBeforeSelection: '', textAfterSelection: '' }
  }

  const text = String(selection.anchorNode.textContent || '')
  const offset = Math.max(0, Math.min(Number(selection.anchorOffset || 0), text.length))
  return {
    textBeforeSelection: text.slice(0, offset),
    textAfterSelection: text.slice(offset),
  }
}

function clampToRange(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function resolveMouseClientPoint(event) {
  const clientX = Number(event?.clientX)
  const clientY = Number(event?.clientY)
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    return { clientX, clientY }
  }

  const pageX = Number(event?.pageX)
  const pageY = Number(event?.pageY)
  if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
    return { clientX: pageX, clientY: pageY }
  }

  return null
}

function rectContainsPoint(rect, point) {
  return !!rect
    && !!point
    && point.clientX >= rect.left
    && point.clientX <= rect.left + rect.width
    && point.clientY >= rect.top
    && point.clientY <= rect.top + rect.height
}

function rectHasArea(rect) {
  return !!rect
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0
}

function resolveRectCenterPoint(rect) {
  if (!rectHasArea(rect)) return null
  return {
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }
}

function resolveEventTargetClientPoint(target, pageRect) {
  const rect = target?.getBoundingClientRect?.()
  const centerPoint = resolveRectCenterPoint(rect)
  if (rectContainsPoint(pageRect, centerPoint)) {
    return centerPoint
  }
  return null
}

function resolveSelectionClientPoint(pageRect, fallbackPoint) {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return fallbackPoint

  let rect = null
  try {
    rect = selection.getRangeAt(0)?.getBoundingClientRect?.() || null
  } catch {
    rect = null
  }

  if (!rectHasArea(rect)) {
    return fallbackPoint
  }

  const centerPoint = resolveRectCenterPoint(rect)
  if (rectContainsPoint(pageRect, centerPoint)) {
    return centerPoint
  }
  return fallbackPoint
}

function resolvePdfPageClientRect(pageView, pageDom, canvasWrapper) {
  const textLayerRect = pageView?.textLayer?.div?.getBoundingClientRect?.()
  if (textLayerRect) return textLayerRect

  const canvasRect = canvasWrapper?.getBoundingClientRect?.()
  if (canvasRect) return canvasRect

  return pageDom?.getBoundingClientRect?.() || null
}

function resolvePdfPageHeight(pageView) {
  const rawPageHeight = Number(pageView?.viewport?.rawDims?.pageHeight)
  if (Number.isFinite(rawPageHeight) && rawPageHeight > 0) {
    return rawPageHeight
  }

  const viewBox = pageView?.viewport?.viewBox
  if (Array.isArray(viewBox) && viewBox.length >= 4) {
    const viewBoxHeight = Number(viewBox[3]) - Number(viewBox[1])
    if (Number.isFinite(viewBoxHeight) && viewBoxHeight > 0) {
      return viewBoxHeight
    }
  }

  return null
}

function callReverseSynctex(event, pageNumber, pageDom, viewerContainer) {
  const canvasWrapper = pageDom.getElementsByClassName('canvasWrapper')[0]
  if (!canvasWrapper || !viewerContainer) return

  const pageView = window.PDFViewerApplication.pdfViewer?._pages?.[pageNumber - 1]
  const pageRect = resolvePdfPageClientRect(pageView, pageDom, canvasWrapper)
  const rawPointer = resolveMouseClientPoint(event)
  const targetPointer = resolveEventTargetClientPoint(event.target, pageRect)
  const pointer = resolveSelectionClientPoint(pageRect, targetPointer || rawPointer)
  if (
    !pageView?.getPagePoint
    || !pageRect
    || !pointer
    || !Number.isFinite(pageRect.width)
    || !Number.isFinite(pageRect.height)
    || pageRect.width <= 0
    || pageRect.height <= 0
  ) {
    return
  }

  const left = clampToRange(pointer.clientX - pageRect.left, 0, pageRect.width)
  const top = clampToRange(pointer.clientY - pageRect.top, 0, pageRect.height)
  const pos = pageView.getPagePoint(left, top)
  if (!Array.isArray(pos) || pos.length < 2) return

  const pageHeight = resolvePdfPageHeight(pageView)
  const pdfX = Number(pos[0])
  const pdfY = Number(pos[1])
  if (!Number.isFinite(pdfX) || !Number.isFinite(pdfY)) return

  const normalizedPos = Number.isFinite(pageHeight)
    ? [pdfX, pageHeight - pdfY]
    : [pdfX, pdfY]

  const { textBeforeSelection, textAfterSelection } = getSelectionContext()
  postToParent('reverse_synctex', {
    page: pageNumber,
    pos: normalizedPos,
    textBeforeSelection,
    textAfterSelection,
  })
}

function registerSyncTeX() {
  const viewerDom = document.getElementById('viewer')
  const viewerContainer = document.getElementById('viewerContainer')
  if (!viewerDom || !viewerContainer) return

  const pageDomList = viewerDom.firstElementChild?.classList.contains('spread')
    ? [...viewerDom.children].flatMap(node => [...node.children])
    : [...viewerDom.children]

  for (const pageDom of pageDomList) {
    const pageNumber = Number(pageDom?.dataset?.pageNumber || 0)
    if (!pageNumber) continue
    pageDom.ondblclick = (event) => {
      window.requestAnimationFrame(() => {
        callReverseSynctex(event, pageNumber, pageDom, viewerContainer)
      })
    }
  }
}

function ensureIndicatorRoot() {
  let indicator = document.getElementById('synctex-indicator')
  if (indicator) return indicator

  const container = document.getElementById('viewerContainer')
  if (!container) return null
  indicator = document.createElement('div')
  indicator.id = 'synctex-indicator'
  indicator.setAttribute('aria-hidden', 'true')
  container.appendChild(indicator)
  return indicator
}

function createIndicator(type, scrollX, scrollY, widthPx, heightPx) {
  let indicator = ensureIndicatorRoot()
  if (!indicator) return

  if (type === 'rect') {
    const parent = indicator.parentNode
    indicator = indicator.cloneNode(true)
    indicator.id = ''
    indicator.classList.add('synctex-indicator-rect')
    indicator.style.width = `${widthPx}px`
    indicator.style.height = `${heightPx}px`
    indicator.addEventListener('animationend', () => {
      indicator.style.display = 'none'
      parent?.removeChild(indicator)
    }, { once: true })
    parent?.appendChild(indicator)
  } else {
    indicator.className = 'show'
    window.setTimeout(() => {
      indicator.className = 'hide'
    }, 10)
  }

  indicator.style.left = `${scrollX}px`
  indicator.style.top = `${scrollY}px`
}

function scrollToPosition(page, posX, posY, isCircle = false) {
  const container = document.getElementById('viewerContainer')
  if (!container) return

  const maxScrollX = window.innerWidth * (isCircle ? 0.9 : 1)
  const minScrollX = window.innerWidth * (isCircle ? 0.1 : 0)
  let scrollX = page.offsetLeft + posX
  scrollX = Math.min(scrollX, maxScrollX)
  scrollX = Math.max(scrollX, minScrollX)
  const scrollY = page.offsetTop + page.offsetHeight - posY

  if (window.PDFViewerApplication.pdfViewer.scrollMode === 1) {
    container.scrollLeft = page.offsetLeft
  } else {
    container.scrollTop = scrollY - document.body.offsetHeight * 0.4
  }

  return { scrollX, scrollY }
}

function forwardSynctex(data) {
  if (!data) return
  const records = Array.isArray(data) ? data : [data]

  for (const record of records) {
    const page = document.getElementsByClassName('page')[record.page - 1]
    const pageView = window.PDFViewerApplication.pdfViewer?._pages?.[record.page - 1]
    if (!page || !pageView?.viewport) continue

    const position = Array.isArray(data)
      ? pageView.viewport.convertToViewportPoint(record.h, record.v - record.H)
      : pageView.viewport.convertToViewportPoint(record.x, record.y)

    const { scrollX, scrollY } = scrollToPosition(page, position[0], position[1], !Array.isArray(data)) || {}
    if (!Number.isFinite(scrollX) || !Number.isFinite(scrollY)) continue

    if (Array.isArray(data)) {
      const bottomRight = pageView.viewport.convertToViewportPoint(record.h + record.W, record.v)
      const widthPx = Math.max(0, bottomRight[0] - position[0])
      const heightPx = Math.max(0, position[1] - bottomRight[1])
      createIndicator('rect', scrollX, scrollY, widthPx, heightPx)
    } else {
      createIndicator('circ', scrollX, scrollY)
    }
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return
  const data = event.data
  if (!data || data.channel !== CHANNEL) return

  if (data.type === 'synctex') {
    forwardSynctex(data.data)
  }
})

onPDFViewerEvent('pagesinit', () => {
  registerSyncTeX()
  postToParent('pagesinit')
})

onPDFViewerEvent('pagesloaded', () => {
  registerSyncTeX()
  postToParent('loaded')
})
