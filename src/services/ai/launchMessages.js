import { shouldPreserveAiSessionLabel } from './sessionLabeling.js'

function hasPayloadContent(payload = {}) {
  if (String(payload.text || '').trim()) return true
  if (Array.isArray(payload.fileRefs) && payload.fileRefs.length > 0) return true
  if (payload.richHtml) return true
  return Boolean(payload.context?.text)
}

export function buildTaskSendPayload({ ai = null, text = '', fileRefs = [], context = null, richHtml = null } = {}) {
  return {
    text,
    fileRefs,
    context,
    richHtml,
    preserveLabel: shouldPreserveAiSessionLabel(ai),
  }
}

export function buildWorkflowSendPayload({ task = {}, workflow = null } = {}) {
  const launchContext = workflow?.run?.context || {}
  return {
    text: launchContext.prompt || task.prompt || '',
    fileRefs: launchContext.fileRefs || [],
    context: task.context || null,
    richHtml: task.richHtml || launchContext.richHtml || null,
    preserveLabel: true,
  }
}

export async function autoSendWorkflowMessage({ chatStore, sessionId, task, workflow } = {}) {
  if (!sessionId || typeof chatStore?.sendMessage !== 'function') return false
  if (!workflow?.run?.context) return false

  const payload = buildWorkflowSendPayload({ task, workflow })
  if (!hasPayloadContent(payload)) return false

  await chatStore.sendMessage(sessionId, payload)
  return true
}
