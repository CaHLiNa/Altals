export const DEFAULT_AGENT_ACTION_ID = 'workspace-agent'
export const LEGACY_GROUNDED_CHAT_ACTION_ID = 'grounded-chat'

const BUILT_IN_ACTION_ID_ALIASES = Object.freeze({
  [LEGACY_GROUNDED_CHAT_ACTION_ID]: DEFAULT_AGENT_ACTION_ID,
})

export function normalizeBuiltInAiActionId(value = '') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  if (!normalized) return ''
  return BUILT_IN_ACTION_ID_ALIASES[normalized] || normalized
}

export function isDefaultAgentActionId(value = '') {
  return normalizeBuiltInAiActionId(value) === DEFAULT_AGENT_ACTION_ID
}

export function matchesBuiltInAiActionId(candidate = '', expected = '') {
  return normalizeBuiltInAiActionId(candidate) === normalizeBuiltInAiActionId(expected)
}
