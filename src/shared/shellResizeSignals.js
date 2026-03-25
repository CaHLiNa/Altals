export const SHELL_RESIZE_BODY_CLASS = 'altals-shell-resizing'
export const SHELL_RESIZE_START_EVENT = 'altals-shell-resize-start'
export const SHELL_RESIZE_END_EVENT = 'altals-shell-resize-end'

const activeShellResizeSources = new Set()

function resolveBodyClassList() {
  return globalThis?.document?.body?.classList || null
}

function toggleBodyClass(active) {
  const classList = resolveBodyClassList()
  if (!classList) return
  if (typeof classList.toggle === 'function') {
    classList.toggle(SHELL_RESIZE_BODY_CLASS, !!active)
    return
  }
  if (active && typeof classList.add === 'function') {
    classList.add(SHELL_RESIZE_BODY_CLASS)
    return
  }
  if (!active && typeof classList.remove === 'function') {
    classList.remove(SHELL_RESIZE_BODY_CLASS)
  }
}

function dispatchResizeEvent(type, detail) {
  const targetWindow = globalThis?.window
  if (!targetWindow || typeof targetWindow.dispatchEvent !== 'function') return

  const EventCtor = globalThis?.CustomEvent
  if (typeof EventCtor === 'function') {
    targetWindow.dispatchEvent(new EventCtor(type, { detail }))
    return
  }

  targetWindow.dispatchEvent({ type, detail })
}

function resolveSourceKey(detail = {}) {
  const source = String(detail?.source || 'default').trim() || 'default'
  const direction = String(detail?.direction || '').trim()
  const side = String(detail?.side || '').trim()
  return [source, direction, side].filter(Boolean).join(':')
}

export function setShellResizeActive(active, detail = {}) {
  const sourceKey = resolveSourceKey(detail)
  const wasActive = activeShellResizeSources.size > 0

  if (active) {
    activeShellResizeSources.add(sourceKey)
  } else {
    activeShellResizeSources.delete(sourceKey)
  }

  const nextActive = activeShellResizeSources.size > 0
  toggleBodyClass(nextActive)

  if (wasActive === nextActive) return
  dispatchResizeEvent(nextActive ? SHELL_RESIZE_START_EVENT : SHELL_RESIZE_END_EVENT, detail)
}

export function isShellResizeActive() {
  const classList = resolveBodyClassList()
  return !!classList?.contains?.(SHELL_RESIZE_BODY_CLASS)
}

export function __resetShellResizeSignalsForTests() {
  activeShellResizeSources.clear()
  toggleBodyClass(false)
}
