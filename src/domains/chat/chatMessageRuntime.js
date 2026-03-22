export function createChatMessageRuntime({
  getSession,
  getChatInstance,
  getOrCreateChat,
  isUsageBudgetExceeded,
  buildSessionLabel,
  appendUnresolvedCommentsToContent,
  nextTickImpl,
  setRichHtml,
  chatSendEvent,
  warn = console.warn,
} = {}) {
  async function buildMessageTextAndFiles({ text, fileRefs, context }) {
    const textParts = []
    const files = []

    if (fileRefs?.length) {
      for (const ref of fileRefs) {
        if (ref._multimodal && ref._dataUrl) {
          files.push({
            type: 'file',
            mediaType: ref._mediaType,
            url: ref._dataUrl,
            filename: ref.path.split('/').pop(),
          })
        } else if (ref.content) {
          const content = appendUnresolvedCommentsToContent?.(ref.path, ref.content) ?? ref.content
          textParts.push(`<file-ref path="${ref.path}">\n${content}\n</file-ref>`)
        }
      }
    }

    if (context?.text) {
      let ctx = `<context file="${context.file || ''}">`
      if (context.contextBefore) ctx += `\n...${context.contextBefore}`
      ctx += `\n<selection>\n${context.text}\n</selection>`
      if (context.contextAfter) ctx += `\n${context.contextAfter}...`
      ctx += '\n</context>'
      textParts.push(ctx)
    }

    if (text) textParts.push(text)

    return { text: textParts.join('\n\n'), files }
  }

  async function sendMessage(sessionId, { text, fileRefs, context, richHtml, preserveLabel = false }) {
    const session = getSession?.(sessionId)
    if (!session) {
      warn?.('[chat] sendMessage: session not found:', sessionId)
      return false
    }

    const chat = getOrCreateChat?.(session)
    const status = chat.state.statusRef.value
    if (status === 'submitted' || status === 'streaming') {
      warn?.('[chat] sendMessage: already streaming, ignoring')
      return false
    }

    if (isUsageBudgetExceeded?.()) {
      warn?.('[chat] Budget exceeded')
      return false
    }

    const isFirst = chat.state.messagesRef.value.length === 0
    if (isFirst && text && !preserveLabel) {
      session.label = buildSessionLabel?.(text) ?? session.label
    }

    const { text: messageText, files } = await buildMessageTextAndFiles({ text, fileRefs, context })

    chatSendEvent?.(session.modelId || 'unknown')
    const userCountBefore = chat.state.messagesRef.value.filter((message) => message.role === 'user').length
    if (files.length > 0) {
      chat.sendMessage({ text: messageText, files })
    } else {
      chat.sendMessage({ text: messageText })
    }

    if (richHtml) {
      let newUserMessage = null
      for (let i = 0; i < 5 && !newUserMessage; i++) {
        await nextTickImpl?.()
        const messages = chat.state.messagesRef.value
        const users = messages.filter((message) => message.role === 'user')
        if (users.length > userCountBefore) {
          newUserMessage = users[users.length - 1]
        }
      }
      if (newUserMessage) {
        setRichHtml?.(newUserMessage.id, richHtml)
      }
    }

    return true
  }

  async function abortSession(sessionId) {
    const chat = getChatInstance?.(sessionId)
    if (!chat) return false
    chat.stop()
    return true
  }

  return {
    buildMessageTextAndFiles,
    sendMessage,
    abortSession,
  }
}
