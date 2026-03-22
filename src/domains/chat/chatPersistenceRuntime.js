export function createChatPersistenceRuntime({
  getShouldersDir,
  disposeAllChatInstances,
  replaceSessions,
  setActiveSessionId,
  getAllSessionsMeta,
  replaceAllSessionsMeta,
  clearAiArtifactsAll,
  clearAiWorkflowRunsAll,
  createSession,
  getSession,
  getChatInstance,
  syncRunToSession,
  cleanPartsForStorage,
  buildPersistedChatSessionData,
  buildPersistedChatSessionMeta,
  untitledLabel = () => 'Untitled',
  invoke,
  clearPendingPrefill,
  clearPendingSelection,
  clearRichHtmlMap,
  warn = console.warn,
} = {}) {
  async function loadAllSessionsMeta() {
    const shouldersDir = getShouldersDir?.()
    if (!shouldersDir) return

    const chatsDir = `${shouldersDir}/chats`
    try {
      const exists = await invoke?.('path_exists', { path: chatsDir })
      if (!exists) return

      const entries = await invoke?.('read_dir_recursive', { path: chatsDir })
      const jsonFiles = entries.filter((entry) => !entry.is_dir && entry.name.endsWith('.json'))

      const meta = []
      for (const file of jsonFiles) {
        try {
          const content = await invoke?.('read_file', { path: file.path })
          const data = JSON.parse(content)
          meta.push(buildPersistedChatSessionMeta?.(data, untitledLabel?.()))
        } catch {}
      }

      meta.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      replaceAllSessionsMeta?.(meta)
    } catch (error) {
      warn?.('Failed to load session meta:', error)
    }
  }

  async function saveSession(id) {
    const shouldersDir = getShouldersDir?.()
    if (!shouldersDir) return

    const session = getSession?.(id)
    if (!session) return
    const workflowSnapshot = syncRunToSession?.(session)

    const chat = getChatInstance?.(id)
    const messages = chat
      ? chat.state.messagesRef.value.map((message) => ({
          ...message,
          parts: cleanPartsForStorage?.(message.parts),
        }))
      : session.messages || []

    const chatsDir = `${shouldersDir}/chats`
    const exists = await invoke?.('path_exists', { path: chatsDir })
    if (!exists) {
      await invoke?.('create_dir', { path: chatsDir })
    }

    session._workflow = workflowSnapshot
    const data = buildPersistedChatSessionData?.(session, messages)

    try {
      await invoke?.('write_file', {
        path: `${chatsDir}/${id}.json`,
        content: JSON.stringify(data, null, 2),
      })

      const currentMeta = getAllSessionsMeta?.() || []
      const existingIdx = currentMeta.findIndex((meta) => meta.id === id)
      const meta = buildPersistedChatSessionMeta?.(data, untitledLabel?.())
      const nextMeta = [...currentMeta]
      if (existingIdx >= 0) {
        nextMeta[existingIdx] = meta
      } else {
        nextMeta.push(meta)
      }
      replaceAllSessionsMeta?.(nextMeta)
    } catch (error) {
      warn?.('Failed to save chat session:', error)
    }
  }

  async function loadSessions() {
    const shouldersDir = getShouldersDir?.()
    if (!shouldersDir) return

    disposeAllChatInstances?.()
    replaceSessions?.([])
    setActiveSessionId?.(null)
    replaceAllSessionsMeta?.([])
    clearAiArtifactsAll?.()
    clearAiWorkflowRunsAll?.()

    const chatsDir = `${shouldersDir}/chats`
    const exists = await invoke?.('path_exists', { path: chatsDir })
    if (!exists) {
      await invoke?.('create_dir', { path: chatsDir })
    }

    createSession?.()
    await loadAllSessionsMeta()
  }

  function cleanup() {
    disposeAllChatInstances?.()
    replaceSessions?.([])
    setActiveSessionId?.(null)
    replaceAllSessionsMeta?.([])
    clearPendingPrefill?.()
    clearPendingSelection?.()
    clearRichHtmlMap?.()
    clearAiArtifactsAll?.()
    clearAiWorkflowRunsAll?.()
  }

  return {
    loadAllSessionsMeta,
    saveSession,
    loadSessions,
    cleanup,
  }
}
