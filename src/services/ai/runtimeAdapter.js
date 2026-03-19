import { DirectChatTransport, ToolLoopAgent, stepCountIs } from 'ai'
import { createModel, buildProviderOptions, convertSdkUsage } from '../aiSdk'
import { createTauriFetch } from '../tauriFetch'
import { getAiTools } from '../chatTools'
import { resolveAllowedToolNames } from './toolRegistry'
import { sendWithOpencodeRuntime } from './opencodeAdapter'

export const AI_RUNTIME_IDS = {
  LEGACY: 'legacy',
  OPENCODE: 'opencode',
}

export const DEFAULT_AI_RUNTIME_ID = AI_RUNTIME_IDS.LEGACY

export function normalizeRuntimeId(runtimeId) {
  const value = String(runtimeId || '').trim().toLowerCase()
  if (value === AI_RUNTIME_IDS.OPENCODE) return AI_RUNTIME_IDS.OPENCODE
  return AI_RUNTIME_IDS.LEGACY
}

function buildLegacyTools(config) {
  const allowedTools = resolveAllowedToolNames({
    profile: config.toolProfile,
    role: config.toolRole,
    allowedTools: config.allowedTools,
  })

  return {
    ...getAiTools(config.workspace, { allowedTools }),
    ...config.extraTools,
  }
}

function createLegacyAgent(config) {
  const tauriFetch = createTauriFetch()
  const model = createModel(config.access, tauriFetch)
  const tools = buildLegacyTools(config)
  const providerOptions = buildProviderOptions(config.thinkingConfig, config.provider)

  return new ToolLoopAgent({
    model,
    tools,
    instructions: config.systemPrompt,
    stopWhen: stepCountIs(config.maxSteps || 15),
    providerOptions,
    prepareStep({ steps, messages }) {
      // Only re-inject native PDF parts from the last tool loop step.
      const lastStep = steps[steps.length - 1]
      if (!lastStep) return undefined

      const pdfParts = []
      for (const result of lastStep.toolResults) {
        if (result.output?._type === 'pdf' && result.output.base64) {
          pdfParts.push({
            type: 'file',
            data: result.output.base64,
            mediaType: 'application/pdf',
            filename: result.output.filename,
          })
        }
      }

      if (pdfParts.length === 0) return undefined

      return {
        messages: [
          ...messages,
          { role: 'user', content: pdfParts },
        ],
      }
    },
    onStepFinish(event) {
      if (config.onUsage && event.usage) {
        const normalized = convertSdkUsage(event.usage, event.providerMetadata, config.provider)
        config.onUsage(normalized, config.access.model)
      }
    },
  })
}

export async function sendWithLegacyRuntime({ config, messages, abortSignal }) {
  const agent = createLegacyAgent(config)
  const transport = new DirectChatTransport({ agent, sendReasoning: true })
  return await transport.sendMessages({ messages, abortSignal })
}

export async function sendWithRuntimeAdapter({ config, messages, abortSignal }) {
  const runtimeId = normalizeRuntimeId(config?.runtimeId)

  if (runtimeId === AI_RUNTIME_IDS.OPENCODE) {
    try {
      return await sendWithOpencodeRuntime({
        config,
        messages,
        abortSignal,
        trigger: config?.trigger,
        messageId: config?.messageId,
      })
    } catch (error) {
      if (config?.strictRuntime || !config?.access) throw error
      console.warn('[ai-runtime] opencode runtime unavailable, falling back to legacy runtime:', error)
    }
  }

  return await sendWithLegacyRuntime({ config, messages, abortSignal })
}
