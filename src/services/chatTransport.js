/**
 * Custom ChatTransport for AI SDK Chat composable.
 *
 * Uses the shared AI runtime adapter per request so the current
 * legacy runtime and the future opencode sidecar share one boundary.
 */

import { sendWithRuntimeAdapter } from './ai/runtimeAdapter'

/**
 * Create a ChatTransport for the AI SDK Chat composable.
 *
 * @param {Function} getConfig - Async function returning fresh config per request:
 *   { access, workspace, systemPrompt, thinkingConfig, provider, onUsage, toolProfile, toolRole, allowedTools }
 * @returns {object} ChatTransport implementation
 */
export function createChatTransport(getConfig) {
  return {
    async sendMessages({ messages, abortSignal, trigger, messageId }) {
      const config = await getConfig()
      return await sendWithRuntimeAdapter({
        config: {
          ...config,
          trigger,
          messageId,
        },
        messages,
        abortSignal,
      })
    },

    async reconnectToStream() {
      return null
    },
  }
}
