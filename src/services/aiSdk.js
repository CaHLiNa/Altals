/**
 * AI SDK model factory and utilities.
 *
 * Central place to create AI SDK model instances from our access config,
 * build provider options for thinking/reasoning, and convert SDK usage
 * into our unified format.
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

/**
 * Create an AI SDK model from our access config.
 *
 * @param {object} access - Result from resolveApiAccess()
 * @param {string} access.model - Model ID (e.g. 'claude-sonnet-4-6')
 * @param {string} access.provider - Provider ('anthropic'|'openai'|'google')
 * @param {string} access.apiKey - API key
 * @param {string} [access.url] - Custom base URL
 * @param {Function} [customFetch] - Custom fetch for CORS bypass (tauriFetch)
 * @returns {object} AI SDK LanguageModel instance
 */
export function createModel(access, customFetch) {
  const provider = access.provider
  const opts = {}
  if (customFetch) opts.fetch = customFetch

  opts.apiKey = access.apiKey
  if (access.url) opts.baseURL = _providerBaseUrl(provider, access.url)

  switch (provider) {
    case 'anthropic':
      return createAnthropic(opts)(access.model)
    case 'openai':
      return createOpenAI(opts)(access.model)
    case 'google':
      return createGoogleGenerativeAI(opts)(access.model)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Build providerOptions for thinking/reasoning from our thinking config.
 *
 * @param {object|null} thinkingConfig - From getThinkingConfig()
 * @param {string} provider - Provider hint ('anthropic'|'openai'|'google')
 * @returns {object|undefined} providerOptions for streamText/generateText
 */
export function buildProviderOptions(thinkingConfig, provider) {
  if (!thinkingConfig) return undefined

  switch (thinkingConfig.mode) {
    case 'adaptive':
      // Anthropic claude-*-4-6: adaptive thinking
      return {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: _adaptiveBudget(thinkingConfig.effort) },
        },
      }
    case 'manual':
      // Anthropic claude-*-4: fixed budget
      return {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: thinkingConfig.budgetTokens },
        },
      }
    case 'openai':
      // OpenAI gpt-5/o-series
      return {
        openai: {
          reasoning: { effort: thinkingConfig.effort || 'medium', summary: 'auto' },
        },
      }
    case 'google':
      // Google Gemini 3.x (level-based)
      return {
        google: {
          thinkingConfig: {
            thinkingLevel: thinkingConfig.level || 'high',
            includeThoughts: true,
          },
        },
      }
    case 'google25':
      // Google Gemini 2.5 (budget-based)
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: thinkingConfig.budget ?? -1,
            includeThoughts: true,
          },
        },
      }
    default:
      return undefined
  }
}

/**
 * Map adaptive effort level to a token budget.
 */
function _adaptiveBudget(effort) {
  switch (effort) {
    case 'low': return 2000
    case 'medium': return 5000
    case 'high': return 16000
    default: return 5000
  }
}

/**
 * Convert AI SDK usage + providerMetadata into our unified usage format.
 *
 * AI SDK provides `usage: { promptTokens, completionTokens, totalTokens }`
 * and `providerMetadata` with cache-aware details per provider.
 *
 * @param {object} sdkUsage - AI SDK usage object
 * @param {object} [providerMetadata] - Provider-specific metadata
 * @param {string} provider - Provider hint
 * @returns {object} Unified usage in our format (without cost)
 */
export function convertSdkUsage(sdkUsage, providerMetadata, provider) {
  const usage = {
    input_cache_miss: 0,
    input_cache_hit: 0,
    input_cache_write: 0,
    input_total: 0,
    output: 0,
    thinking: 0,
    total: 0,
    cost: 0,
  }

  if (!sdkUsage) return usage

  // Try to extract cache-aware usage from providerMetadata
  if (providerMetadata?.anthropic?.usage) {
    const raw = providerMetadata.anthropic.usage
    usage.input_cache_miss = raw.input_tokens || 0
    usage.input_cache_hit = raw.cache_read_input_tokens || 0
    usage.input_cache_write = raw.cache_creation_input_tokens || 0
    usage.input_total = usage.input_cache_miss + usage.input_cache_hit + usage.input_cache_write
    usage.output = raw.output_tokens || 0
    usage.total = usage.input_total + usage.output
    return usage
  }

  if (providerMetadata?.google?.usageMetadata) {
    const raw = providerMetadata.google.usageMetadata
    const cached = raw.cachedContentTokenCount || 0
    usage.input_cache_miss = (raw.promptTokenCount || 0) - cached
    usage.input_cache_hit = cached
    usage.input_total = raw.promptTokenCount || 0
    const candidates = raw.candidatesTokenCount || 0
    const thoughts = raw.thoughtsTokenCount || 0
    usage.output = candidates + thoughts
    usage.thinking = thoughts
    usage.total = raw.totalTokenCount || (usage.input_total + usage.output)
    return usage
  }

  if (providerMetadata?.openai) {
    const raw = providerMetadata.openai.usage || providerMetadata.openai
    if (raw.inputTokens || raw.outputTokens) {
      const cached = raw.cachedInputTokens || 0
      usage.input_cache_miss = (raw.inputTokens || 0) - cached
      usage.input_cache_hit = cached
      usage.input_total = raw.inputTokens || 0
      usage.output = raw.outputTokens || 0
      usage.thinking = raw.reasoningTokens || 0
      usage.total = usage.input_total + usage.output
      return usage
    }
  }

  // Fallback: use SDK's basic usage (no cache breakdown)
  usage.input_total = sdkUsage.promptTokens || 0
  usage.input_cache_miss = usage.input_total
  usage.output = sdkUsage.completionTokens || 0
  usage.total = sdkUsage.totalTokens || (usage.input_total + usage.output)

  return usage
}

/**
 * Clean parts for persistence. Keeps providerMetadata — OpenAI Responses API
 * needs itemId on reasoning parts to pair them with function_call items.
 */
export function cleanPartsForStorage(parts) {
  if (!parts) return []
  return parts.map(part => ({ ...part }))
}


// ─── URL Helpers ──────────────────────────────────────────────────────

/**
 * Extract base URL for a provider from a full endpoint URL.
 */
function _providerBaseUrl(provider, fullUrl) {
  switch (provider) {
    case 'anthropic':
      // https://api.anthropic.com/v1/messages → https://api.anthropic.com/v1
      return fullUrl.replace(/\/messages$/, '')
    case 'openai':
      // https://api.openai.com/v1/responses → https://api.openai.com/v1
      return fullUrl.replace(/\/responses$/, '')
    case 'google':
      // https://generativelanguage.googleapis.com/v1beta/models → as-is
      return fullUrl.replace(/\/models$/, '')
    default:
      return fullUrl
  }
}
