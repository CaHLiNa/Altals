export function createReferenceLibraryLoadRuntime({
  getWorkspacePath,
  getProjectDir,
  getGlobalConfigDir,
  getLoadGeneration,
  setLoadGeneration,
  getGlobalLibrary,
  getActiveKey,
  setLoading,
  setGlobalLibrary,
  setGlobalKeyMap,
  setCollections,
  setSavedViews,
  setLibrary,
  setWorkspaceKeys,
  setKeyMap,
  setActiveKey,
  setLibraryDetailMode,
  setCitationStyle,
  setInitialized,
  ensureReferenceStorageReady,
  readJsonArray,
  readWorkspaceReferenceCollection,
  readFileIfExists,
  parseGlobalReferenceWorkbench,
  sanitizeReferenceWorkbenchState,
  migrateLegacyWorkspaceData,
  sanitizeReferenceRecord,
  referenceKey,
  buildKeyMapFromList,
  buildWorkspaceLibrary,
  writeLibraries,
  deleteLegacyWorkspaceReferenceLibrary,
  loadPersistedCitationStyle,
  loadReferenceUserStyles,
  startWatching,
  warn = console.warn,
} = {}) {
  function captureWorkspaceContext() {
    return {
      workspacePath: getWorkspacePath?.() || '',
      projectDir: getProjectDir?.() || '',
      globalConfigDir: getGlobalConfigDir?.() || '',
    }
  }

  function matchesWorkspaceContext(context) {
    if (!context?.workspacePath || !context?.projectDir || !context?.globalConfigDir) return false
    return (
      getWorkspacePath?.() === context.workspacePath
      && getProjectDir?.() === context.projectDir
      && getGlobalConfigDir?.() === context.globalConfigDir
    )
  }

  function beginLoadContext() {
    const context = captureWorkspaceContext()
    if (!matchesWorkspaceContext(context)) return null
    const generation = (getLoadGeneration?.() || 0) + 1
    setLoadGeneration?.(generation)
    return {
      ...context,
      generation,
    }
  }

  function isLoadStale(context) {
    if (!context) return true
    return context.generation !== getLoadGeneration?.() || !matchesWorkspaceContext(context)
  }

  async function loadLibrary() {
    const context = beginLoadContext()
    if (!context) return

    setLoading?.(true)

    try {
      try {
        await ensureReferenceStorageReady(context)
        if (isLoadStale(context)) return

        let globalLibrary = await readJsonArray(context.globalConfigDir)
        if (isLoadStale(context)) return

        let workspaceCollection = await readWorkspaceReferenceCollection(context.projectDir)
        if (isLoadStale(context)) return

        const workbenchState = sanitizeReferenceWorkbenchState(
          parseGlobalReferenceWorkbench(
            await readFileIfExists(context.globalConfigDir)
          )
        )
        if (isLoadStale(context)) return

        const migration = await migrateLegacyWorkspaceData(context, {
          globalLibrary,
          workspaceKeys: workspaceCollection.keys,
        })
        if (isLoadStale(context)) return

        globalLibrary = migration.globalLibrary
        workspaceCollection = {
          ...workspaceCollection,
          keys: migration.workspaceKeys,
        }

        const validCollectionIds = new Set(workbenchState.collections.map((entry) => entry.id))
        globalLibrary = globalLibrary
          .map((ref) => {
            const nextRef = sanitizeReferenceRecord(ref)
            if (validCollectionIds.size > 0 && Array.isArray(nextRef._collections)) {
              nextRef._collections = nextRef._collections.filter((id) => validCollectionIds.has(id))
              if (nextRef._collections.length === 0) delete nextRef._collections
            } else {
              delete nextRef._collections
            }
            return nextRef
          })
          .filter((ref) => !!referenceKey(ref))

        setGlobalLibrary?.(globalLibrary)
        setGlobalKeyMap?.(buildKeyMapFromList(globalLibrary))
        setCollections?.(workbenchState.collections)
        setSavedViews?.(workbenchState.savedViews)

        const workspaceView = buildWorkspaceLibrary(globalLibrary, buildKeyMapFromList(globalLibrary), workspaceCollection.keys)
        setLibrary?.(workspaceView.library)
        setWorkspaceKeys?.(workspaceView.keys)
        setKeyMap?.(buildKeyMapFromList(workspaceView.library))

        if (getActiveKey?.() && buildKeyMapFromList(globalLibrary)[getActiveKey?.()] === undefined) {
          setActiveKey?.(null)
          setLibraryDetailMode?.('browse')
        }

        if (migration.didChange) {
          await writeLibraries?.(context)
          if (isLoadStale(context)) return
        }

        if (migration.legacyLibraryFound) {
          await deleteLegacyWorkspaceReferenceLibrary(context)
          if (isLoadStale(context)) return
        }
      } catch (error) {
        if (isLoadStale(context)) return
        warn?.('Failed to load reference library:', error)
        setLibrary?.([])
        setKeyMap?.({})
        setWorkspaceKeys?.([])
        const currentGlobalLibrary = getGlobalLibrary?.() || []
        if (!Array.isArray(currentGlobalLibrary) || currentGlobalLibrary.length === 0) {
          setGlobalLibrary?.([])
          setGlobalKeyMap?.({})
          setCollections?.([])
          setSavedViews?.([])
        } else {
          setGlobalKeyMap?.(buildKeyMapFromList(currentGlobalLibrary))
        }
      }

      if (isLoadStale(context)) return

      const citationStyle = await loadPersistedCitationStyle(context.projectDir)
      if (citationStyle) setCitationStyle?.(citationStyle)

      if (isLoadStale(context)) return

      await loadReferenceUserStyles(context.projectDir).catch(() => {})

      if (isLoadStale(context)) return

      setInitialized?.(true)
      await startWatching?.(context)
    } finally {
      if (!isLoadStale(context)) {
        setLoading?.(false)
      }
    }
  }

  return {
    captureWorkspaceContext,
    matchesWorkspaceContext,
    beginLoadContext,
    isLoadStale,
    loadLibrary,
  }
}
