/**
 * Centralized AI API client.
 *
 * Owns: local key resolution and provider URL selection.
 *
 * Main export:
 *   resolveApiAccess(options, workspace) — "who do I call and with what key?"
 */

const PROVIDER_URLS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/responses',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
}

// Fallback models for strategy-based resolution
export const GHOST_MODELS = [
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'google', model: 'gemini-3.1-flash-lite-preview', keyEnv: 'GOOGLE_API_KEY' },
  { provider: 'openai', model: 'gpt-5-nano-2025-08-07', keyEnv: 'OPENAI_API_KEY' },
]

const CHEAP_MODELS = [
  { provider: 'google', model: 'gemini-3.1-flash-lite-preview', keyEnv: 'GOOGLE_API_KEY' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'openai', model: 'gpt-5-nano-2025-08-07', keyEnv: 'OPENAI_API_KEY' },
]

/**
 * Synchronously determine the billing route for a given model.
 *
 * @param {string} modelId - Model ID from models.json
 * @param {object} workspace - Workspace store instance
 * @returns {{ route: 'direct', provider: string } | null}
 */
export function getBillingRoute(modelId, workspace) {
  const config = workspace.modelsConfig
  if (!config) {
    if (workspace.apiKey && workspace.apiKey !== 'your-api-key-here') {
      return { route: 'direct', provider: 'anthropic' }
    }
    return null
  }

  const model = config.models?.find(m => m.id === modelId) || config.models?.[0]
  if (!model) return null

  const providerConfig = config.providers?.[model.provider]
  if (!providerConfig) return null

  const apiKey = workspace.apiKeys?.[providerConfig.apiKeyEnv]
  const hasDirectKey = apiKey && !apiKey.includes('your-')

  return hasDirectKey ? { route: 'direct', provider: model.provider } : null
}

/**
 * Resolve API access for an AI call.
 *
 * @param {object} options
 * @param {string} [options.modelId] - Named model from models.json
 * @param {'ghost'|'cheapest'} [options.strategy] - Auto-select by strategy
 * @param {object} workspace - Workspace store instance
 * @returns {Promise<{ model: string, provider: string, apiKey: string, url: string } | null>}
 */
export async function resolveApiAccess(options, workspace) {
  if (options.strategy === 'ghost') {
    if (workspace.ghostModelId) {
      const preferred = GHOST_MODELS.find(m => m.model === workspace.ghostModelId)
      if (preferred) {
        const keys = workspace.apiKeys || {}
        const key = keys[preferred.keyEnv]
        if (key && !key.includes('your-')) {
          return {
            model: preferred.model,
            provider: preferred.provider,
            apiKey: key,
            url: PROVIDER_URLS[preferred.provider],
          }
        }
      }
    }
    return _resolveFromList(GHOST_MODELS, workspace)
  }

  if (options.strategy === 'cheapest') return _resolveFromList(CHEAP_MODELS, workspace)
  if (options.modelId) return _resolveModelAccess(options.modelId, workspace)
  return null
}

async function _resolveFromList(modelList, workspace) {
  const keys = workspace.apiKeys || {}
  for (const { provider, model, keyEnv } of modelList) {
    const key = keys[keyEnv]
    if (key && !key.includes('your-')) {
      return { model, provider, apiKey: key, url: PROVIDER_URLS[provider] }
    }
  }
  return null
}

async function _resolveModelAccess(modelId, workspace) {
  const config = workspace.modelsConfig
  if (!config) {
    if (workspace.apiKey && workspace.apiKey !== 'your-api-key-here') {
      return {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        apiKey: workspace.apiKey,
        url: PROVIDER_URLS.anthropic,
      }
    }
    return null
  }

  const model = config.models?.find(m => m.id === modelId) || config.models?.[0]
  if (!model) return null

  const providerConfig = config.providers?.[model.provider]
  if (!providerConfig) return null

  const apiKey = workspace.apiKeys?.[providerConfig.apiKeyEnv]
  const hasDirectKey = apiKey && !apiKey.includes('your-')
  if (!hasDirectKey) return null

  let url = providerConfig.url || PROVIDER_URLS[model.provider]
  if (model.provider === 'openai' && url?.includes('/v1/chat/completions')) {
    url = PROVIDER_URLS.openai
  }

  return {
    model: model.model,
    provider: model.provider,
    apiKey,
    url,
  }
}

export function hasAnyAccess(workspace) {
  const keys = workspace.apiKeys || {}
  for (const { keyEnv } of CHEAP_MODELS) {
    const key = keys[keyEnv]
    if (key && !key.includes('your-')) return true
  }
  return false
}
