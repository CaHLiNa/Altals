function normalizeSource(source) {
  return String(source || '').trim()
}

export function shouldPreserveAiSessionLabel(ai = null) {
  const taskId = String(ai?.taskId || '').trim()
  if (!taskId) return false
  return normalizeSource(ai?.source) !== 'launcher-input'
}

export function shouldSkipAutoTitleForSession(session = null) {
  if (session?._workflow?.run?.id) return true
  return shouldPreserveAiSessionLabel(session?._ai)
}
