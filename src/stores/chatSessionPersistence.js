import { hydrateSessionWorkflow, serializeSessionWorkflow } from './aiWorkflowRuns.js'

export function buildPersistedChatSessionData(session = {}, messages = []) {
  return {
    id: session.id,
    label: session.label,
    _aiTitle: session._aiTitle || false,
    _keywords: session._keywords || [],
    _ai: session._ai || null,
    _workflow: serializeSessionWorkflow(session._workflow || null),
    modelId: session.modelId,
    messages: Array.isArray(messages) ? messages : [],
    status: 'idle',
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

export function hydratePersistedChatSession(data = {}) {
  const messages = Array.isArray(data.messages) ? data.messages : []
  return {
    id: data.id,
    label: data.label,
    modelId: data.modelId,
    messages: [],
    status: 'idle',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    _ai: data._ai || null,
    _workflow: hydrateSessionWorkflow(data._workflow || null),
    _savedMessages: messages,
  }
}

export function buildPersistedChatSessionMeta(data = {}, untitledLabel = 'Untitled') {
  return {
    id: data.id,
    label: data.label || untitledLabel,
    updatedAt: data.updatedAt || data.createdAt,
    messageCount: Array.isArray(data.messages) ? data.messages.length : 0,
    _aiTitle: data._aiTitle || false,
    _keywords: data._keywords || [],
    _ai: data._ai || null,
    _workflow: hydrateSessionWorkflow(data._workflow || null),
  }
}
