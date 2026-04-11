import { requestTinymistExecuteCommand } from '../tinymist/session.js'

const PREVIEW_DOCUMENT_CACHE_VERSION = 4
const DEFAULT_TINYMIST_PREVIEW_MODE = 'Doc'
const TINYMIST_WS_PLACEHOLDER = 'ws://127.0.0.1:23625'
const TINYMIST_PREVIEW_MODE_PLACEHOLDER = 'preview-arg:previewMode:Doc'
const TINYMIST_PREVIEW_STATE_PLACEHOLDER = 'preview-arg:state:'
const previewDocumentUrlCache = new Map()
const previewDocumentDataUrlCache = new Map()

function normalizePreviewMode(previewMode = '') {
  return String(previewMode || '').trim().toLowerCase() === 'slide' ? 'Slide' : DEFAULT_TINYMIST_PREVIEW_MODE
}

function normalizeWorkspacePath(workspacePath = '') {
  return String(workspacePath || '').trim()
}

function normalizePreviewWebSocketUrl(value = '') {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  if (/^wss?:\/\//i.test(normalized)) return normalized
  if (/^https?:\/\//i.test(normalized)) {
    return normalized.replace(/^http/i, 'ws')
  }
  return `ws://${normalized.replace(/^\/+/, '')}`
}

function resolveSessionWebSocketUrl(session = {}) {
  const explicitUrl = normalizePreviewWebSocketUrl(
    session.dataPlaneWsUrl
      || session.dataPlaneUrl
      || session.websocketUrl
      || '',
  )
  if (explicitUrl) return explicitUrl

  const port = Number(session.dataPlanePort || 0)
  if (Number.isInteger(port) && port > 0) {
    return `ws://127.0.0.1:${port}`
  }

  return ''
}

export function patchTypstPreviewDocumentHtml(html, options = {}) {
  const source = String(html || '')
  const websocketUrl = normalizePreviewWebSocketUrl(options.websocketUrl || '')
  const previewMode = normalizePreviewMode(options.previewMode)
  const previewState = String(options.previewState ?? '')

  if (!source) {
    return { html: '', patched: false }
  }

  let nextHtml = source
  let patched = false

  if (websocketUrl && nextHtml.includes(TINYMIST_WS_PLACEHOLDER)) {
    nextHtml = nextHtml.split(TINYMIST_WS_PLACEHOLDER).join(websocketUrl)
    patched = true
  }

  const nextPreviewModePlaceholder = `preview-arg:previewMode:${previewMode}`
  if (
    previewMode !== DEFAULT_TINYMIST_PREVIEW_MODE
    && nextHtml.includes(TINYMIST_PREVIEW_MODE_PLACEHOLDER)
  ) {
    nextHtml = nextHtml.replaceAll(TINYMIST_PREVIEW_MODE_PLACEHOLDER, nextPreviewModePlaceholder)
    patched = true
  }

  const nextPreviewStatePlaceholder = `${TINYMIST_PREVIEW_STATE_PLACEHOLDER}${previewState}`
  if (
    previewState
    && nextHtml.includes(TINYMIST_PREVIEW_STATE_PLACEHOLDER)
  ) {
    nextHtml = nextHtml.replace(TINYMIST_PREVIEW_STATE_PLACEHOLDER, nextPreviewStatePlaceholder)
    patched = true
  }

  return {
    html: nextHtml,
    patched,
  }
}

export function buildPreviewDocumentCacheKey(session = {}, options = {}) {
  const websocketUrl = resolveSessionWebSocketUrl(session)
  if (!websocketUrl) return ''

  const workspacePath = normalizeWorkspacePath(options.workspacePath || session.workspacePath || '')
  const previewMode = normalizePreviewMode(options.previewMode || session.previewMode || '')
  return `${websocketUrl}::v${PREVIEW_DOCUMENT_CACHE_VERSION}::${previewMode}::${workspacePath}`
}

export async function fetchTypstPreviewDocumentHtml(options = {}) {
  const workspacePath = normalizeWorkspacePath(options.workspacePath || '')
  const html = await requestTinymistExecuteCommand(
    'tinymist.getResources',
    ['/preview/index.html'],
    { workspacePath },
  )
  return typeof html === 'string' ? html : ''
}

export async function createTypstPreviewDocumentUrl(session = {}, options = {}) {
  const cacheKey = buildPreviewDocumentCacheKey(session, options)
  if (cacheKey && previewDocumentUrlCache.has(cacheKey)) {
    return previewDocumentUrlCache.get(cacheKey) || ''
  }

  const rawHtml = await fetchTypstPreviewDocumentHtml({
    workspacePath: options.workspacePath || session.workspacePath || '',
  })
  if (!rawHtml) return ''

  const { html } = patchTypstPreviewDocumentHtml(rawHtml, {
    websocketUrl: options.websocketUrl || resolveSessionWebSocketUrl(session),
    previewMode: options.previewMode || session.previewMode || '',
    previewState: options.previewState || '',
  })

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  if (cacheKey) {
    previewDocumentUrlCache.set(cacheKey, objectUrl)
  }
  return objectUrl
}

export async function createTypstPreviewDocumentDataUrl(session = {}, options = {}) {
  const cacheKey = buildPreviewDocumentCacheKey(session, options)
  if (cacheKey && previewDocumentDataUrlCache.has(cacheKey)) {
    return previewDocumentDataUrlCache.get(cacheKey) || ''
  }

  const rawHtml = await fetchTypstPreviewDocumentHtml({
    workspacePath: options.workspacePath || session.workspacePath || '',
  })
  if (!rawHtml) return ''

  const { html } = patchTypstPreviewDocumentHtml(rawHtml, {
    websocketUrl: options.websocketUrl || resolveSessionWebSocketUrl(session),
    previewMode: options.previewMode || session.previewMode || '',
    previewState: options.previewState || '',
  })

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  if (cacheKey) {
    previewDocumentDataUrlCache.set(cacheKey, dataUrl)
  }
  return dataUrl
}

export function isManagedTypstPreviewDocumentUrl(url) {
  const value = String(url || '')
  if (!value) return false
  for (const cachedUrl of previewDocumentUrlCache.values()) {
    if (cachedUrl === value) return true
  }
  return false
}

export function clearTypstPreviewDocumentCache(session = null) {
  const normalizedCachePrefix = typeof session === 'string'
    ? normalizePreviewWebSocketUrl(session)
    : resolveSessionWebSocketUrl(session || {})

  for (const [cacheKey, objectUrl] of previewDocumentUrlCache.entries()) {
    if (normalizedCachePrefix && !cacheKey.startsWith(`${normalizedCachePrefix}::`)) continue
    if (typeof objectUrl === 'string' && objectUrl.startsWith('blob:')) {
      URL.revokeObjectURL(objectUrl)
    }
    previewDocumentUrlCache.delete(cacheKey)
  }

  for (const [cacheKey] of previewDocumentDataUrlCache.entries()) {
    if (normalizedCachePrefix && !cacheKey.startsWith(`${normalizedCachePrefix}::`)) continue
    previewDocumentDataUrlCache.delete(cacheKey)
  }
}

export {
  DEFAULT_TINYMIST_PREVIEW_MODE,
  PREVIEW_DOCUMENT_CACHE_VERSION,
  TINYMIST_PREVIEW_MODE_PLACEHOLDER,
  TINYMIST_PREVIEW_STATE_PLACEHOLDER,
  TINYMIST_WS_PLACEHOLDER,
  resolveSessionWebSocketUrl,
}
