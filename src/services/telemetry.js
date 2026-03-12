const STORAGE_KEY = 'altals_telemetry'
let enabled = false

export function initTelemetry() {
  try {
    const prefs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    enabled = prefs.enabled === true
  } catch { /* ignore */ }
}

export function setTelemetryEnabled(value) {
  enabled = value
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled }))
  } catch { /* ignore */ }
}

export function isTelemetryEnabled() {
  return enabled
}

export function trackEvent(eventType, eventData = null) {
  void eventType
  void eventData
}

export function setAppVersion(version) {
  void version
}

// Convenience event helpers
export const events = {
  appOpen: () => trackEvent('app_open'),
  workspaceOpen: () => trackEvent('workspace_open'),
  fileOpen: (ext) => trackEvent('file_open', { ext }),
  chatSend: (provider) => trackEvent('chat_send', { provider }),
  ghostTrigger: () => trackEvent('ghost_trigger'),
  ghostAccept: () => trackEvent('ghost_accept'),
  refImport: (method) => trackEvent('ref_import', { method }),
  themeChange: (theme) => trackEvent('theme_change', { theme }),
  exportPdf: () => trackEvent('export_pdf'),
  appError: (message) => trackEvent('error', { message }),
}
