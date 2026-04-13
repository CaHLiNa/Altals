import { emit, listen } from '@tauri-apps/api/event'

export const TRANSIENT_OVERLAY_DISMISS_EVENT = 'app:transient-overlay-dismiss'

function isTauriDesktopRuntime() {
  return typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__
}

export function createTransientOverlaySource(prefix = 'overlay') {
  const randomId = Math.random().toString(36).slice(2, 10)
  return `${prefix}:${randomId}`
}

export async function broadcastTransientOverlayDismiss(sourceId = '') {
  const payload = { sourceId: String(sourceId || '') }

  if (isTauriDesktopRuntime()) {
    await emit(TRANSIENT_OVERLAY_DISMISS_EVENT, payload).catch(() => {})
    return
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TRANSIENT_OVERLAY_DISMISS_EVENT, { detail: payload }))
  }
}

export async function listenForTransientOverlayDismiss(sourceId = '', handler = () => {}) {
  const normalizedSourceId = String(sourceId || '')

  if (isTauriDesktopRuntime()) {
    return listen(TRANSIENT_OVERLAY_DISMISS_EVENT, (event) => {
      if (String(event.payload?.sourceId || '') === normalizedSourceId) return
      handler(event.payload || {})
    }).catch(() => () => {})
  }

  if (typeof window !== 'undefined') {
    const listener = (event) => {
      if (String(event.detail?.sourceId || '') === normalizedSourceId) return
      handler(event.detail || {})
    }
    window.addEventListener(TRANSIENT_OVERLAY_DISMISS_EVENT, listener)
    return () => {
      window.removeEventListener(TRANSIENT_OVERLAY_DISMISS_EVENT, listener)
    }
  }

  return () => {}
}
