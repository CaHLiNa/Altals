const PROVIDER_SPECS = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    defaultUrl: 'https://api.anthropic.com/v1/messages',
    placeholder: 'https://api.anthropic.com/v1/messages',
    sdkFamily: 'anthropic',
    sdkMode: 'native',
    supportsModelSync: false,
    pdfEngine: null,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultUrl: 'https://api.openai.com/v1/responses',
    placeholder: 'https://api.openai.com/v1/responses',
    sdkFamily: 'openai',
    sdkMode: 'responses',
    supportsModelSync: true,
    pdfEngine: 'openai',
  },
  {
    id: 'google',
    label: 'Google',
    apiKeyEnv: 'GOOGLE_API_KEY',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    placeholder: 'https://generativelanguage.googleapis.com/v1beta/models',
    sdkFamily: 'google',
    sdkMode: 'native',
    supportsModelSync: false,
    pdfEngine: 'gemini',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultUrl: 'https://api.deepseek.com/v1',
    placeholder: 'https://api.deepseek.com/v1',
    sdkFamily: 'openai',
    sdkMode: 'chat',
    supportsModelSync: true,
    pdfEngine: 'deepseek',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    apiKeyEnv: 'KIMI_API_KEY',
    defaultUrl: 'https://api.moonshot.cn/v1',
    placeholder: 'https://api.moonshot.cn/v1',
    sdkFamily: 'openai',
    sdkMode: 'chat',
    supportsModelSync: true,
    pdfEngine: 'kimi',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    apiKeyEnv: 'QWEN_API_KEY',
    defaultUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    sdkFamily: 'openai',
    sdkMode: 'chat',
    supportsModelSync: true,
    pdfEngine: 'openai',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    apiKeyEnv: 'MINIMAX_API_KEY',
    defaultUrl: 'https://api.minimaxi.com/v1',
    placeholder: 'https://api.minimaxi.com/v1',
    sdkFamily: 'openai',
    sdkMode: 'chat',
    supportsModelSync: true,
    pdfEngine: 'openai',
  },
  {
    id: 'glm',
    label: 'GLM',
    apiKeyEnv: 'GLM_API_KEY',
    defaultUrl: 'https://open.bigmodel.cn/api/paas/v4',
    placeholder: 'https://open.bigmodel.cn/api/paas/v4',
    sdkFamily: 'openai',
    sdkMode: 'chat',
    supportsModelSync: true,
    pdfEngine: 'zhipu',
  },
]

const PROVIDER_SPEC_BY_ID = Object.fromEntries(
  PROVIDER_SPECS.map(spec => [spec.id, spec]),
)

const DEFAULT_MODELS = [
  { id: 'opus', name: 'Opus 4.6', provider: 'anthropic', model: 'claude-opus-4-6', default: false },
  { id: 'sonnet', name: 'Sonnet 4.6', provider: 'anthropic', model: 'claude-sonnet-4-6', default: true },
  { id: 'haiku', name: 'Haiku 4.5', provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai', model: 'gpt-5.2-2025-12-11' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', model: 'gpt-5-mini-2025-08-07' },
  { id: 'gemini-3.1-pro-fast', name: 'Gemini 3.1 Pro (Low)', provider: 'google', model: 'gemini-3.1-pro-preview', thinking: 'low' },
  { id: 'gemini-3.1-pro-deep', name: 'Gemini 3.1 Pro (High)', provider: 'google', model: 'gemini-3.1-pro-preview', thinking: 'high' },
  { id: 'gemini-flash', name: 'Gemini 3 Flash', provider: 'google', model: 'gemini-3-flash-preview', thinking: 'medium' },
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', model: 'deepseek-chat' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'deepseek', model: 'deepseek-reasoner' },
  { id: 'moonshot-v1-8k', name: 'Kimi 8K', provider: 'kimi', model: 'moonshot-v1-8k' },
  { id: 'qwen-plus-latest', name: 'Qwen Plus', provider: 'qwen', model: 'qwen-plus-latest' },
  { id: 'qwen-turbo-latest', name: 'Qwen Turbo', provider: 'qwen', model: 'qwen-turbo-latest' },
  { id: 'glm-4-flash', name: 'GLM Flash', provider: 'glm', model: 'glm-4-flash' },
]

function cloneModel(model) {
  return { ...model }
}

function cloneProviderConfig(spec) {
  return {
    url: spec.defaultUrl,
    apiKeyEnv: spec.apiKeyEnv,
  }
}

export function getProviderDefinitions() {
  return PROVIDER_SPECS.map(spec => ({ ...spec }))
}

export function getProviderSpec(provider) {
  return PROVIDER_SPEC_BY_ID[provider] || null
}

export function providerLabel(provider) {
  return getProviderSpec(provider)?.label || provider
}

export function getProviderDefaultUrl(provider) {
  return getProviderSpec(provider)?.defaultUrl || ''
}

export function getProviderPlaceholder(provider) {
  return getProviderSpec(provider)?.placeholder || getProviderDefaultUrl(provider)
}

export function getProviderSdkFamily(provider) {
  return getProviderSpec(provider)?.sdkFamily || provider
}

export function getProviderSdkMode(provider) {
  return getProviderSpec(provider)?.sdkMode || 'native'
}

export function providerSupportsModelSync(provider) {
  return getProviderSpec(provider)?.supportsModelSync === true
}

export function isOpenAiCompatibleProvider(provider) {
  return getProviderSdkFamily(provider) === 'openai'
}

export function getPdfTranslationEngine(provider) {
  return getProviderSpec(provider)?.pdfEngine || null
}

export function providerSupportsPdfTranslation(provider) {
  return !!getPdfTranslationEngine(provider)
}

export function getDefaultModelsConfig() {
  return {
    models: DEFAULT_MODELS.map(cloneModel),
    providers: Object.fromEntries(
      PROVIDER_SPECS.map(spec => [spec.id, cloneProviderConfig(spec)]),
    ),
  }
}

function normalizeModelConfig(raw = {}) {
  const models = Array.isArray(raw?.models)
    ? raw.models
        .filter(Boolean)
        .map(model => ({ ...model }))
    : []

  const providers = raw?.providers && typeof raw.providers === 'object'
    ? Object.fromEntries(
        Object.entries(raw.providers)
          .filter(([, config]) => config && typeof config === 'object')
          .map(([id, config]) => [id, { ...config }]),
      )
    : {}

  return { ...raw, models, providers }
}

export function mergeWithDefaultModelsConfig(raw = {}) {
  const next = normalizeModelConfig(raw)
  let changed = false

  for (const spec of PROVIDER_SPECS) {
    const existing = next.providers?.[spec.id]
    if (!existing) {
      next.providers[spec.id] = cloneProviderConfig(spec)
      changed = true
      continue
    }

    if (!existing.apiKeyEnv) {
      existing.apiKeyEnv = spec.apiKeyEnv
      changed = true
    }

    if (!existing.url) {
      existing.url = spec.defaultUrl
      changed = true
    }
  }

  const existingIds = new Set(next.models.map(model => model.id))
  for (const model of DEFAULT_MODELS) {
    if (existingIds.has(model.id)) continue
    next.models.push(cloneModel(model))
    changed = true
  }

  if (next.models.length > 0 && !next.models.some(model => model.default)) {
    const fallback = next.models.find(model => model.id === 'sonnet') || next.models[0]
    if (fallback && !fallback.default) {
      fallback.default = true
      changed = true
    }
  }

  return { config: next, changed }
}

export function isLikelyChatModel(modelId = '') {
  const value = String(modelId || '').toLowerCase()
  if (!value) return false
  if (/embedding|rerank|tts|speech|audio|transcription|image|vision|whisper|moderation/.test(value)) {
    return false
  }
  return true
}

export function buildSyncedModelId(provider, remoteModelId, existingIds = new Set()) {
  const preferred = `${provider}:${remoteModelId}`
  if (!existingIds.has(preferred)) return preferred

  let n = 2
  while (existingIds.has(`${preferred}-${n}`)) n += 1
  return `${preferred}-${n}`
}

export function mergeRemoteModelsIntoConfig(rawConfig, provider, remoteModelIds = []) {
  const { config } = mergeWithDefaultModelsConfig(rawConfig)
  const existingIds = new Set(config.models.map(model => model.id))
  const existingProviderModels = new Set(
    config.models
      .filter(model => model.provider === provider)
      .map(model => String(model.model || model.id)),
  )

  let addedCount = 0
  for (const remoteModelId of remoteModelIds) {
    const normalizedId = String(remoteModelId || '').trim()
    if (!normalizedId || !isLikelyChatModel(normalizedId)) continue
    if (existingProviderModels.has(normalizedId)) continue

    const localId = buildSyncedModelId(provider, normalizedId, existingIds)
    existingIds.add(localId)
    existingProviderModels.add(normalizedId)
    config.models.push({
      id: localId,
      name: normalizedId,
      provider,
      model: normalizedId,
      discovered: true,
    })
    addedCount += 1
  }

  return { config, addedCount }
}
