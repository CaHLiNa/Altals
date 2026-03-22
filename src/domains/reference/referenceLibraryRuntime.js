export function createReferenceLibraryRuntime({
  captureWorkspaceContext,
  matchesWorkspaceContext,
  loadLibrary,
  getGlobalLibrary,
  getCollections,
  getSavedViews,
  getWorkspaceKeys,
  createEmptyGlobalReferenceWorkbench,
  createEmptyWorkspaceReferenceCollection,
  resolveGlobalReferenceLibraryPath,
  resolveGlobalReferenceWorkbenchPath,
  resolveWorkspaceReferenceCollectionPath,
  invoke,
  listenToFsChange,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
  warn = console.warn,
} = {}) {
  let saveTimer = null
  let unlisten = null
  let selfWriteCounts = Object.create(null)

  function markSelfWrite(path) {
    if (!path) return
    selfWriteCounts[path] = (selfWriteCounts[path] || 0) + 1
  }

  function consumeSelfWrite(path) {
    if (!path || !selfWriteCounts[path]) return false
    selfWriteCounts[path] -= 1
    if (selfWriteCounts[path] <= 0) delete selfWriteCounts[path]
    return true
  }

  async function writeLibraries(context = captureWorkspaceContext?.()) {
    if (!context?.projectDir || !context?.globalConfigDir) return

    const globalLibraryPath = resolveGlobalReferenceLibraryPath(context.globalConfigDir)
    const workbenchStatePath = resolveGlobalReferenceWorkbenchPath(context.globalConfigDir)
    const workspaceCollectionPath = resolveWorkspaceReferenceCollectionPath(context.projectDir)

    try {
      markSelfWrite(globalLibraryPath)
      await invoke('write_file', {
        path: globalLibraryPath,
        content: JSON.stringify(getGlobalLibrary?.() || [], null, 2),
      })

      markSelfWrite(workbenchStatePath)
      await invoke('write_file', {
        path: workbenchStatePath,
        content: JSON.stringify({
          ...createEmptyGlobalReferenceWorkbench(),
          collections: getCollections?.() || [],
          savedViews: getSavedViews?.() || [],
        }, null, 2),
      })

      markSelfWrite(workspaceCollectionPath)
      await invoke('write_file', {
        path: workspaceCollectionPath,
        content: JSON.stringify({
          ...createEmptyWorkspaceReferenceCollection(),
          keys: [...(getWorkspaceKeys?.() || [])],
        }, null, 2),
      })
    } catch (error) {
      warn?.('Failed to save reference library:', error)
    }
  }

  async function doSave(context = captureWorkspaceContext?.()) {
    if (!matchesWorkspaceContext?.(context)) return
    await writeLibraries(context)
  }

  async function saveLibrary(options = {}) {
    const { immediate = false } = options || {}
    const context = captureWorkspaceContext?.()
    clearTimeoutImpl(saveTimer)
    saveTimer = null

    if (immediate) {
      await doSave(context)
      return
    }

    saveTimer = setTimeoutImpl(() => {
      saveTimer = null
      void doSave(context)
    }, 500)
  }

  async function startWatching(context = captureWorkspaceContext?.()) {
    if (!matchesWorkspaceContext?.(context)) return
    if (unlisten) unlisten()

    const globalLibraryPath = resolveGlobalReferenceLibraryPath(context.globalConfigDir)
    const workbenchStatePath = resolveGlobalReferenceWorkbenchPath(context.globalConfigDir)
    const workspaceCollectionPath = resolveWorkspaceReferenceCollectionPath(context.projectDir)

    unlisten = await listenToFsChange(async (event) => {
      if (!matchesWorkspaceContext?.(context)) return
      const paths = event.payload?.paths || []
      const relevant = paths.filter((path) => (
        path === globalLibraryPath
        || path === workspaceCollectionPath
        || path === workbenchStatePath
      ))
      if (relevant.length === 0) return

      let needsReload = false
      for (const path of relevant) {
        if (consumeSelfWrite(path)) continue
        needsReload = true
      }
      if (needsReload) {
        await loadLibrary?.()
      }
    })
  }

  function stopWatching() {
    if (unlisten) {
      unlisten()
      unlisten = null
    }
  }

  function cleanup() {
    clearTimeoutImpl(saveTimer)
    saveTimer = null
    stopWatching()
    selfWriteCounts = Object.create(null)
  }

  return {
    saveLibrary,
    doSave,
    writeLibraries,
    startWatching,
    stopWatching,
    cleanup,
  }
}
