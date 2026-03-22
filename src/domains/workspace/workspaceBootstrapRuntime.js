export function createWorkspaceBootstrapRuntime({
  getPath,
  getCurrentBootstrapGeneration,
  getWorkspaceDataDir,
  getInstructionsPaths,
  getInstructionsUnlisten,
  setInstructionsUnlisten,
  initWorkspaceDataDir,
  initProjectDir,
  installEditHooks,
  loadSettings,
  loadInstructions,
  canAutoCommit,
  startAutoCommit,
  loadWorkspaceUsage,
  watchDirectory,
  listenToFsChange,
  logWorkspaceBootstrapWarning,
} = {}) {
  function clearInstructionsWatcher() {
    const unlisten = getInstructionsUnlisten?.()
    if (!unlisten) return false
    unlisten()
    setInstructionsUnlisten?.(null)
    return true
  }

  async function bootstrapWorkspace(path, generation) {
    const isStale = () => generation !== getCurrentBootstrapGeneration?.() || getPath?.() !== path
    const runStep = async (label, fn) => {
      if (isStale()) return false
      try {
        await fn?.()
        return !isStale()
      } catch (error) {
        logWorkspaceBootstrapWarning?.(label, error)
        return !isStale()
      }
    }

    if (!(await runStep('initWorkspaceDataDir', () => initWorkspaceDataDir?.()))) return
    if (!(await runStep('initProjectDir', () => initProjectDir?.()))) return
    if (!(await runStep('installEditHooks', () => installEditHooks?.()))) return
    if (!(await runStep('loadSettings', () => loadSettings?.()))) return

    let fsWatchReady = false
    if (!isStale()) {
      try {
        const workspaceDataDir = getWorkspaceDataDir?.()
        await watchDirectory?.({
          paths: [path, workspaceDataDir].filter(Boolean),
          recursivePaths: [workspaceDataDir].filter(Boolean),
        })
        fsWatchReady = true
      } catch (error) {
        logWorkspaceBootstrapWarning?.('watch_directory', error)
      }
    }

    if (fsWatchReady && !isStale()) {
      try {
        clearInstructionsWatcher()
        const unlisten = await listenToFsChange?.((event) => {
          const changedPaths = event?.payload?.paths || []
          const { rootPath, internalPath } = getInstructionsPaths?.() || {}
          const instructionsPaths = [rootPath, internalPath].filter(Boolean)
          if (changedPaths.some((changedPath) => instructionsPaths.includes(changedPath))) {
            void loadInstructions?.()
          }
        })
        setInstructionsUnlisten?.(unlisten || null)
      } catch (error) {
        logWorkspaceBootstrapWarning?.('listen(fs-change)', error)
      }
    }

    if (!isStale()) {
      loadWorkspaceUsage?.(isStale)
    }

    if (!isStale() && await canAutoCommit?.(path)) {
      void startAutoCommit?.()
    }
  }

  return {
    bootstrapWorkspace,
    clearInstructionsWatcher,
  }
}
