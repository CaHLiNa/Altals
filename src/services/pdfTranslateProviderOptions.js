const OPENAI_COMPATIBLE_OPTION_DEFS = [
  {
    key: 'timeout',
    requestKey: 'openai_timeout',
    type: 'number',
    min: 1,
    max: 3600,
    step: 1,
    defaultValue: '',
    labelKey: 'Request timeout (seconds)',
    hintKey: 'Leave empty to use the provider default timeout.',
  },
  {
    key: 'temperature',
    requestKey: 'openai_temperature',
    type: 'number',
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: '',
    labelKey: 'Temperature',
    hintKey: 'Use lower values for more stable academic translation.',
  },
  {
    key: 'reasoningEffort',
    requestKey: 'openai_reasoning_effort',
    type: 'select',
    defaultValue: '',
    labelKey: 'Reasoning effort',
    options: [
      { value: '', labelKey: 'Default' },
      { value: 'low', labelKey: 'Low' },
      { value: 'medium', labelKey: 'Medium' },
      { value: 'high', labelKey: 'High' },
    ],
  },
  {
    key: 'jsonMode',
    requestKey: 'openai_enable_json_mode',
    type: 'boolean',
    defaultValue: false,
    labelKey: 'Enable JSON mode',
    hintKey: 'Ask the provider for structured responses when supported.',
  },
  {
    key: 'sendTemperature',
    requestKey: 'openai_send_temprature',
    type: 'boolean',
    defaultValue: false,
    labelKey: 'Send temperature parameter',
    hintKey: 'Some OpenAI-compatible providers ignore temperature unless this flag is sent.',
  },
  {
    key: 'sendReasoningEffort',
    requestKey: 'openai_send_reasoning_effort',
    type: 'boolean',
    defaultValue: false,
    labelKey: 'Send reasoning effort parameter',
    hintKey: 'Some OpenAI-compatible providers require an explicit reasoning-effort flag.',
  },
]

const GEMINI_OPTION_DEFS = [
  {
    key: 'jsonMode',
    requestKey: 'gemini_enable_json_mode',
    type: 'boolean',
    defaultValue: false,
    labelKey: 'Enable JSON mode',
    hintKey: 'Ask Gemini for structured responses when supported.',
  },
]

const DEEPSEEK_OPTION_DEFS = [
  {
    key: 'jsonMode',
    requestKey: 'deepseek_enable_json_mode',
    type: 'boolean',
    defaultValue: false,
    labelKey: 'Enable JSON mode',
    hintKey: 'Ask DeepSeek for structured responses when supported.',
  },
]

const ZHIPU_OPTION_DEFS = [
  {
    key: 'jsonMode',
    requestKey: 'zhipu_enable_json_mode',
    type: 'boolean',
    defaultValue: false,
    labelKey: 'Enable JSON mode',
    hintKey: 'Ask GLM / Zhipu for structured responses when supported.',
  },
]

const PROVIDER_OPTION_DEFS = {
  openai: OPENAI_COMPATIBLE_OPTION_DEFS,
  qwen: OPENAI_COMPATIBLE_OPTION_DEFS,
  kimi: OPENAI_COMPATIBLE_OPTION_DEFS,
  minimax: OPENAI_COMPATIBLE_OPTION_DEFS,
  google: GEMINI_OPTION_DEFS,
  deepseek: DEEPSEEK_OPTION_DEFS,
  glm: ZHIPU_OPTION_DEFS,
}

function clampNumber(value, { min, max, defaultValue = '' }) {
  if (value === '' || value == null) return defaultValue
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return defaultValue
  return Math.max(min, Math.min(parsed, max))
}

function normalizeOptionValue(def, value) {
  if (def.type === 'boolean') return value === true
  if (def.type === 'select') {
    return def.options.some(option => option.value === value) ? value : def.defaultValue
  }
  if (def.type === 'number') {
    return clampNumber(value, {
      min: def.min,
      max: def.max,
      defaultValue: def.defaultValue,
    })
  }
  return def.defaultValue
}

function isMeaningfulOptionValue(def, value) {
  if (def.type === 'boolean') return value === true
  if (def.type === 'number') return value !== '' && value != null
  if (def.type === 'select') return value !== '' && value != null
  return value != null && value !== ''
}

export function getPdfTranslateProviderOptionDefs(provider = '') {
  return (PROVIDER_OPTION_DEFS[provider] || []).map(def => ({
    ...def,
    options: def.options?.map(option => ({ ...option })) || undefined,
  }))
}

export function providerHasPdfTranslateOptions(provider = '') {
  return getPdfTranslateProviderOptionDefs(provider).length > 0
}

export function createDefaultPdfTranslateProviderOptions(provider = '') {
  return Object.fromEntries(
    getPdfTranslateProviderOptionDefs(provider).map(def => [def.key, def.defaultValue]),
  )
}

export function normalizePdfTranslateProviderOptions(provider = '', raw = {}) {
  const defs = getPdfTranslateProviderOptionDefs(provider)
  const result = createDefaultPdfTranslateProviderOptions(provider)
  for (const def of defs) {
    result[def.key] = normalizeOptionValue(def, raw?.[def.key])
  }
  return result
}

export function compactPdfTranslateProviderOptions(provider = '', raw = {}) {
  const defs = getPdfTranslateProviderOptionDefs(provider)
  const normalized = normalizePdfTranslateProviderOptions(provider, raw)
  const compacted = {}
  for (const def of defs) {
    const value = normalized[def.key]
    if (!isMeaningfulOptionValue(def, value)) continue
    compacted[def.key] = value
  }
  return compacted
}

export function buildPdfTranslateProviderExtra(provider = '', providerConfig = {}) {
  const defs = getPdfTranslateProviderOptionDefs(provider)
  const compacted = compactPdfTranslateProviderOptions(provider, providerConfig?.pdfTranslateOptions)
  const extra = {}
  for (const def of defs) {
    if (!(def.key in compacted)) continue
    extra[def.requestKey] = compacted[def.key]
  }
  return extra
}
