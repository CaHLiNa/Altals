/**
 * Centralized AI API client.
 *
 * Owns: local key resolution and provider URL selection.
 *
 * Main export:
 *   resolveApiAccess(options, workspace) — "who do I call and with what key?"
 */

import {
  getDefaultModelsConfig,
  getProviderDefaultUrl,
  getProviderDefinitions,
  getProviderSdkFamily,
  getProviderSdkMode,
} from './modelCatalog'

const PROVIDER_URLS = Object.fromEntries(
  getProviderDefinitions().map(spec => [spec.id, spec.defaultUrl]),
)

// Fallback models for strategy-based resolution
export const GHOST_MODELS = [
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'google', model: 'gemini-3.1-flash-lite-preview', keyEnv: 'GOOGLE_API_KEY' },
  { provider: 'openai', model: 'gpt-5-nano-2025-08-07', keyEnv: 'OPENAI_API_KEY' },
  { provider: 'deepseek', model: 'deepseek-chat', keyEnv: 'DEEPSEEK_API_KEY' },
  { provider: 'qwen', model: 'qwen-turbo-latest', keyEnv: 'QWEN_API_KEY' },
  { provider: 'glm', model: 'glm-4-flash', keyEnv: 'GLM_API_KEY' },
  { provider: 'kimi', model: 'moonshot-v1-8k', keyEnv: 'KIMI_API_KEY' },
]

const CHEAP_MODELS = [
  { provider: 'google', model: 'gemini-3.1-flash-lite-preview', keyEnv: 'GOOGLE_API_KEY' },
  { provider: 'deepseek', model: 'deepseek-chat', keyEnv: 'DEEPSEEK_API_KEY' },
  { provider: 'qwen', model: 'qwen-turbo-latest', keyEnv: 'QWEN_API_KEY' },
  { provider: 'glm', model: 'glm-4-flash', keyEnv: 'GLM_API_KEY' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'openai', model: 'gpt-5-nano-2025-08-07', keyEnv: 'OPENAI_API_KEY' },
  { provider: 'kimi', model: 'moonshot-v1-8k', keyEnv: 'KIMI_API_KEY' },
]

function _accessForResolvedModel(model, providerConfig, apiKey) {
  return {
    model: model.model,
    provider: model.provider,
    apiKey,
    url: providerConfig?.customUrl || providerConfig?.url || getProviderDefaultUrl(model.provider),
    sdkProvider: getProviderSdkFamily(model.provider),
    sdkMode: getProviderSdkMode(model.provider),
  }
}

function _getConfig(workspace) {
  return workspace.modelsConfig || getDefaultModelsConfig()
}

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
      const preferred = await _resolveModelAccess(workspace.ghostModelId, workspace)
      if (preferred) return preferred
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
      return {
        model,
        provider,
        apiKey: key,
        url: PROVIDER_URLS[provider],
        sdkProvider: getProviderSdkFamily(provider),
        sdkMode: getProviderSdkMode(provider),
      }
    }
  }
  return _resolveFromConfiguredModels(workspace)
}

function _resolveFromConfiguredModels(workspace) {
  const config = _getConfig(workspace)
  const keys = workspace.apiKeys || {}
  const defaultModelId = config.models?.find(model => model.default)?.id
  const candidates = [
    ...(defaultModelId ? config.models.filter(model => model.id === defaultModelId) : []),
    ...(config.models || []).filter(model => model.id !== defaultModelId),
  ]

  for (const model of candidates) {
    const providerConfig = config.providers?.[model.provider]
    const keyEnv = providerConfig?.apiKeyEnv
    const apiKey = keyEnv ? keys[keyEnv] : ''
    if (!apiKey || apiKey.includes('your-')) continue
    return _accessForResolvedModel(model, providerConfig, apiKey)
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
        sdkProvider: 'anthropic',
        sdkMode: 'native',
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

  return _accessForResolvedModel(model, providerConfig, apiKey)
}

export function hasAnyAccess(workspace) {
  const config = workspace.modelsConfig
  if (config?.providers) {
    const keys = workspace.apiKeys || {}
    for (const providerConfig of Object.values(config.providers)) {
      const keyEnv = providerConfig?.apiKeyEnv
      const key = keyEnv ? keys[keyEnv] : ''
      if (key && !key.includes('your-')) return true
    }
    return false
  }

  const keys = workspace.apiKeys || {}
  for (const { keyEnv } of CHEAP_MODELS) {
    const key = keys[keyEnv]
    if (key && !key.includes('your-')) return true
  }
  return false
}
