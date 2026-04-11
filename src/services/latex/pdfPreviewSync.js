function isElementNode(node) {
  return !!node && Number(node.nodeType) === 1
}

function isTextNode(node) {
  return !!node && Number(node.nodeType) === 3
}

export function resolvePdfPreviewEventTarget(target) {
  if (isElementNode(target)) return target
  if (isTextNode(target)) return target.parentElement || null
  return null
}

export function capturePdfPreviewSelectionContext(selection) {
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

export function scrollPdfPreviewToPoint({ app, doc, point = {} }) {
  const page = Number(point.page || 0)
  const x = Number(point.x)
  const y = Number(point.y)
  if (!app?.pdfViewer || !Number.isInteger(page) || page < 1) return false

  if (Number.isFinite(x) && Number.isFinite(y)) {
    const pageDom = doc?.getElementsByClassName?.('page')?.[page - 1]
    const pageView = app.pdfViewer?._pages?.[page - 1]
    const viewerContainer = doc?.getElementById?.('viewerContainer')
    if (pageDom && pageView?.viewport && viewerContainer) {
      const [viewportX, viewportY] = pageView.viewport.convertToViewportPoint(x, y)
      const scrollY = pageDom.offsetTop + pageDom.offsetHeight - viewportY
      if (app.pdfViewer.scrollMode === 1) {
        viewerContainer.scrollLeft = pageDom.offsetLeft
      } else {
        viewerContainer.scrollTop = scrollY - viewerContainer.clientHeight * 0.4
      }
      return true
    }

    app.pdfViewer.scrollPageIntoView({
      pageNumber: page,
      destArray: [null, { name: 'XYZ' }, x, y, null],
      allowNegativeOffset: true,
    })
    return true
  }

  app.pdfViewer.scrollPageIntoView({ pageNumber: page })
  return true
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

function resolveSelectionClientPoint(frameWindow, pageRect, fallbackPoint) {
  const selection = frameWindow?.getSelection?.()
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

export function resolveLatexPdfReverseSyncPayload({ event, frameWindow }) {
  const eventTarget = resolvePdfPreviewEventTarget(event?.target)
  const currentTarget = resolvePdfPreviewEventTarget(event?.currentTarget)
  const pageDom = currentTarget?.classList?.contains('page')
    ? currentTarget
    : eventTarget?.closest?.('.page') || null
  const page = Number(pageDom?.dataset?.pageNumber || 0)
  if (!pageDom || !Number.isInteger(page) || page < 1) return null

  const app = frameWindow?.PDFViewerApplication
  const pageView = app?.pdfViewer?._pages?.[page - 1]
  const canvasWrapper = pageDom.getElementsByClassName?.('canvasWrapper')?.[0]
  const pageRect = resolvePdfPageClientRect(pageView, pageDom, canvasWrapper)
  const rawPointer = resolveMouseClientPoint(event)
  const targetPointer = resolveEventTargetClientPoint(eventTarget, pageRect)
  const pointer = resolveSelectionClientPoint(frameWindow, pageRect, targetPointer || rawPointer)
  if (
    !pageView?.getPagePoint
    || !pageRect
    || !pointer
    || !Number.isFinite(pageRect.width)
    || !Number.isFinite(pageRect.height)
    || pageRect.width <= 0
    || pageRect.height <= 0
  ) {
    return null
  }

  const left = clampToRange(pointer.clientX - pageRect.left, 0, pageRect.width)
  const top = clampToRange(pointer.clientY - pageRect.top, 0, pageRect.height)
  const pos = pageView.getPagePoint(left, top)
  if (!Array.isArray(pos) || pos.length < 2) return null

  const pageHeight = resolvePdfPageHeight(pageView)
  const pdfX = Number(pos[0])
  const pdfY = Number(pos[1])
  if (!Number.isFinite(pdfX) || !Number.isFinite(pdfY)) return null

  const normalizedPos = Number.isFinite(pageHeight)
    ? [pdfX, pageHeight - pdfY]
    : [pdfX, pdfY]

  return {
    page,
    pos: normalizedPos,
    ...capturePdfPreviewSelectionContext(frameWindow?.getSelection?.()),
  }
}

export function dispatchLatexBackwardSync(windowTarget, detail = {}) {
  windowTarget?.dispatchEvent?.(new CustomEvent('latex-backward-sync', { detail }))
}
