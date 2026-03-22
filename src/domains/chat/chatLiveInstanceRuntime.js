export function createChatLiveInstanceRuntime({
  getChatInstanceById,
  setChatInstance,
  createChatTransportImpl,
  buildConfig,
  ChatCtor,
  sendAutomaticallyWhen,
  watchImpl,
  syncSessionArtifacts,
  saveSession,
  maybeGenerateTitle,
  removeFromSessions,
  createMessageId,
  notifyInstanceMutation,
  error = console.error,
  warn = console.warn,
} = {}) {
  const artifactSyncStops = new Map()

  function stopArtifactSync(sessionId) {
    const stop = artifactSyncStops.get(sessionId)
    if (!stop) return
    try { stop() } catch {}
    artifactSyncStops.delete(sessionId)
  }

  function getChatInstance(sessionId) {
    return getChatInstanceById?.(sessionId) || null
  }

  function getOrCreateChat(session) {
    const existing = getChatInstanceById?.(session.id)
    if (existing) return existing

    const chat = new ChatCtor({
      id: session.id,
      messages: session._savedMessages || [],
      transport: createChatTransportImpl(() => buildConfig?.(session)),
      sendAutomaticallyWhen,
      onToolCall: async () => {},
      onError: (err) => {
        error?.('[chat] onError:', err?.message || err)
        session.updatedAt = new Date().toISOString()

        try {
          const messages = chat.state.messagesRef.value

          for (const message of messages) {
            if (message.role !== 'assistant' || !message.parts) continue
            for (const part of message.parts) {
              if (part.state !== 'output-error') continue
              if (part.input !== undefined || part.rawInput !== undefined) {
                delete part.input
                delete part.rawInput
              }
            }
          }

          const last = messages.at(-1)
          if (last?.role === 'assistant') {
            const brokenPart = last.parts?.find((part) =>
              part.state === 'input-available' || part.state === 'input-streaming'
            )
            if (brokenPart) {
              const { toolCallId, toolName, type } = brokenPart
              const errMsg = err?.message || String(err)
              chat.state.popMessage()
              chat.state.pushMessage({
                id: createMessageId?.(),
                role: 'assistant',
                parts: [{
                  type: type || 'dynamic-tool',
                  toolCallId,
                  toolName,
                  state: 'output-error',
                  errorText: `Tool call failed: ${errMsg}. Ensure all arguments use valid JSON — do not use XML or <tag> syntax inside JSON string values.`,
                }],
                createdAt: new Date().toISOString(),
              })
            }
          }
        } catch (cleanupErr) {
          warn?.('[chat] Failed to recover from broken tool call:', cleanupErr)
        }
      },
    })

    setChatInstance?.(session.id, chat)
    notifyInstanceMutation?.()

    stopArtifactSync(session.id)
    artifactSyncStops.set(
      session.id,
      watchImpl(
        () => [chat.state.messagesRef.value, session._ai],
        () => {
          syncSessionArtifacts?.(session, chat.state.messagesRef.value)
        },
        { deep: true, immediate: true },
      ),
    )

    watchImpl(
      () => chat.state.statusRef.value,
      (newStatus, oldStatus) => {
        if (newStatus === 'ready' && (oldStatus === 'streaming' || oldStatus === 'submitted')) {
          session.updatedAt = new Date().toISOString()
          saveSession?.(session.id)
          maybeGenerateTitle?.(session)
          if (session._background) {
            removeFromSessions?.(session.id)
          }
        }
      },
    )

    return chat
  }

  return {
    stopArtifactSync,
    getChatInstance,
    getOrCreateChat,
  }
}
