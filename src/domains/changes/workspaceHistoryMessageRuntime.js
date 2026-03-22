const TIMESTAMP_MARKER = '__ALTALS_WORKSPACE_HISTORY_TS__'

export function formatWorkspaceHistoryTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 16)
}

function normalizeMessageTemplate(template = '') {
  return String(template || '').trim()
}

function splitTimestampTemplate(template = '') {
  const normalizedTemplate = normalizeMessageTemplate(template)
  const markerIndex = normalizedTemplate.indexOf(TIMESTAMP_MARKER)
  if (markerIndex < 0) {
    return null
  }

  return {
    prefix: normalizedTemplate.slice(0, markerIndex),
    suffix: normalizedTemplate.slice(markerIndex + TIMESTAMP_MARKER.length),
  }
}

function matchesTimestampTemplate(message = '', template = '') {
  const normalizedMessage = String(message || '').trim()
  const parts = splitTimestampTemplate(template)
  if (!normalizedMessage || !parts) {
    return false
  }

  if (!normalizedMessage.startsWith(parts.prefix)) {
    return false
  }
  if (!normalizedMessage.endsWith(parts.suffix)) {
    return false
  }

  const middle = normalizedMessage.slice(
    parts.prefix.length,
    normalizedMessage.length - parts.suffix.length,
  )
  return Boolean(middle.trim())
}

function buildTimestampTemplateVariants({
  templateKey = '',
  defaultTemplate = '',
  t,
} = {}) {
  const templates = new Set()
  const fallbackTemplate = defaultTemplate.replace('{ts}', TIMESTAMP_MARKER)
  templates.add(fallbackTemplate)

  if (typeof t === 'function' && templateKey) {
    const translatedTemplate = normalizeMessageTemplate(
      t(templateKey, { ts: TIMESTAMP_MARKER }),
    )
    if (translatedTemplate) {
      templates.add(translatedTemplate)
    }
  }

  return Array.from(templates)
}

export function buildWorkspaceHistorySaveMessage({
  t,
  now = new Date(),
} = {}) {
  const ts = formatWorkspaceHistoryTimestamp(now)
  if (typeof t === 'function') {
    return t('Save: {ts}', { ts })
  }
  return `Save: ${ts}`
}

export function buildWorkspaceHistoryAutoMessage({
  now = new Date(),
} = {}) {
  return `Auto: ${formatWorkspaceHistoryTimestamp(now)}`
}

export function getWorkspaceHistoryMessageKind({
  message = '',
  t,
} = {}) {
  const normalizedMessage = String(message || '').trim()
  if (!normalizedMessage) {
    return 'empty'
  }

  const autoTemplates = buildTimestampTemplateVariants({
    defaultTemplate: 'Auto: {ts}',
  })
  if (autoTemplates.some((template) => matchesTimestampTemplate(normalizedMessage, template))) {
    return 'auto'
  }

  const saveTemplates = buildTimestampTemplateVariants({
    templateKey: 'Save: {ts}',
    defaultTemplate: 'Save: {ts}',
    t,
  })
  if (saveTemplates.some((template) => matchesTimestampTemplate(normalizedMessage, template))) {
    return 'save'
  }

  return 'named'
}

export function isNamedWorkspaceHistoryMessage({
  message = '',
  t,
} = {}) {
  return getWorkspaceHistoryMessageKind({ message, t }) === 'named'
}
