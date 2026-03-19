import { generateText } from 'ai'
import { resolveApiAccess } from '../apiClient'
import { createModel, convertSdkUsage } from '../aiSdk'
import { createTauriFetch } from '../tauriFetch'
import { calculateCost } from '../tokenUsage'
import { recordUsageEntry } from '../usageAccess'

export async function resolveTextAccess({ workspace, access, strategy, modelId } = {}) {
  if (access) return access
  if (!workspace) return null

  if (modelId) {
    return await resolveApiAccess({ modelId }, workspace)
  }

  if (strategy) {
    return await resolveApiAccess({ strategy }, workspace)
  }

  return null
}

export async function generateWorkspaceText({
  workspace,
  access,
  strategy,
  modelId,
  system,
  prompt,
  messages,
  feature = null,
  maxTokens,
  maxOutputTokens,
  ...rest
} = {}) {
  const resolvedAccess = await resolveTextAccess({ workspace, access, strategy, modelId })
  if (!resolvedAccess) {
    return {
      access: null,
      provider: null,
      usage: null,
      text: null,
      result: null,
    }
  }

  const model = createModel(resolvedAccess, createTauriFetch())
  const provider = resolvedAccess.providerHint || resolvedAccess.provider

  const result = await generateText({
    model,
    system,
    prompt,
    messages,
    maxTokens,
    maxOutputTokens,
    ...rest,
  })

  let usage = null
  if (result.usage) {
    usage = convertSdkUsage(result.usage, result.providerMetadata, provider)
    usage.cost = calculateCost(usage, resolvedAccess.model, resolvedAccess.provider)

    if (feature) {
      void recordUsageEntry({
        usage,
        feature,
        provider: resolvedAccess.provider,
        modelId: resolvedAccess.model,
      })
    }
  }

  return {
    access: resolvedAccess,
    provider,
    usage,
    text: result.text || null,
    result,
  }
}
