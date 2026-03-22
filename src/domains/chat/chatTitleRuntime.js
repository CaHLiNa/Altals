export function extractTitleTextFromParts(parts = []) {
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .replace(/<file-ref[^>]*>[\s\S]*?<\/file-ref>/g, '')
    .replace(/<context[^>]*>[\s\S]*?<\/context>/g, '')
    .replace(/\n/g, ' ')
    .trim()
}

export function buildSmartChatSessionLabel(text, { untitledLabel = 'New chat', maxLength = 40 } = {}) {
  const clean = String(text || '')
    .replace(/<file-ref[^>]*>[\s\S]*?<\/file-ref>/g, '')
    .replace(/<context[^>]*>[\s\S]*?<\/context>/g, '')
    .replace(/\n/g, ' ')
    .trim()

  if (!clean) return untitledLabel
  if (clean.length <= maxLength) return clean

  const slice = clean.slice(0, maxLength)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > 10) {
    return slice.slice(0, lastSpace) + '...'
  }
  return slice + '...'
}

export function createChatTitleRuntime({
  getChatInstance,
  getLiveSession,
  shouldSkipAutoTitleForSession,
  getWorkspace,
  generateWorkspaceText,
  saveSession,
  getTitleSystemPrompt,
  warn = console.warn,
} = {}) {
  function maybeGenerateTitle(session) {
    if (session?._aiTitle) return
    if (shouldSkipAutoTitleForSession?.(session)) return

    const chat = getChatInstance?.(session?.id)
    if (!chat) return

    const messages = chat.state.messagesRef.value
    const userMessages = messages.filter((message) => message.role === 'user')
    const assistantMessages = messages.filter((message) => message.role === 'assistant')
    if (userMessages.length < 1 || assistantMessages.length < 1) return
    if (userMessages.length > 1) return

    generateTitle(session).catch((error) => {
      warn?.('[chat] Title generation failed:', error)
    })
  }

  async function generateTitle(session) {
    const workspace = getWorkspace?.()
    const chat = getChatInstance?.(session?.id)
    if (!chat) return

    const messages = chat.state.messagesRef.value
    const firstUser = messages.find((message) => message.role === 'user')
    const firstAssistant = messages.find((message) => message.role === 'assistant')
    if (!firstUser || !firstAssistant) return

    const userText = extractTitleTextFromParts(firstUser.parts || []).slice(0, 300)
    const assistantText = extractTitleTextFromParts(firstAssistant.parts || []).slice(0, 300)
    if (!userText) return

    try {
      const { text } = await generateWorkspaceText?.({
        workspace,
        strategy: 'ghost',
        system: getTitleSystemPrompt?.(),
        prompt: `User: ${userText}\n\nAssistant: ${assistantText}`,
        feature: null,
        maxTokens: 256,
      })
      if (!text) return

      let title = null
      let keywords = []
      try {
        const parsed = JSON.parse(text.trim())
        title = parsed.title?.trim()
        keywords = Array.isArray(parsed.keywords) ? parsed.keywords : []
      } catch {
        title = text.trim()
      }

      if (!title) return
      title = title.slice(0, 60)

      const liveSession = getLiveSession?.(session.id)
      if (!liveSession) return

      liveSession.label = title
      liveSession._aiTitle = true
      liveSession._keywords = keywords
      saveSession?.(liveSession.id)
    } catch (error) {
      warn?.('[chat] Title generation failed:', error)
    }
  }

  return {
    maybeGenerateTitle,
    generateTitle,
  }
}
