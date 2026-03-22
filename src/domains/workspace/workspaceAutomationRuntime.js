export const DEFAULT_WORKSPACE_SYNC_INTERVAL_MS = 5 * 60 * 1000

export function createWorkspaceAutomationRuntime({
  getPath,
  getGitAutoCommitInterval,
  getGitAutoCommitTimer,
  setGitAutoCommitTimer,
  getSyncTimer,
  setSyncTimer,
  canAutoCommitWorkspace,
  performWorkspaceAutoCommit,
  ensureGitHubInitialized,
  getGitHubToken,
  getRemoteUrl,
  setRemoteUrl,
  applySyncState,
  runWorkspaceAutoSync,
  fetchWorkspaceRemoteChanges,
  runWorkspaceSyncNow,
  reloadOpenFilesAfterPull,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
  syncIntervalMs = DEFAULT_WORKSPACE_SYNC_INTERVAL_MS,
  onAutoCommitError,
} = {}) {
  async function canAutoCommit(path = getPath?.()) {
    return canAutoCommitWorkspace?.(path)
  }

  function stopAutoCommit() {
    const timer = getGitAutoCommitTimer?.()
    if (!timer) return
    clearIntervalImpl?.(timer)
    setGitAutoCommitTimer?.(null)
  }

  async function autoSync() {
    await ensureGitHubInitialized?.()

    const path = getPath?.()
    const token = getGitHubToken?.()?.token
    if (!path || !token) return null

    const result = await runWorkspaceAutoSync?.(path, token)
    if (!result) return null

    setRemoteUrl?.(result.remoteUrl)
    applySyncState?.(result.syncState, result.remoteUrl)
    return result
  }

  async function autoCommit() {
    if (!(await canAutoCommit())) return { committed: false }

    try {
      const result = await performWorkspaceAutoCommit?.(getPath?.())
      if (result?.committed) {
        await autoSync()
      }
      return result || { committed: false }
    } catch (error) {
      onAutoCommitError?.(error)
      return { committed: false, error }
    }
  }

  async function startAutoCommit() {
    stopAutoCommit()
    if (!(await canAutoCommit())) return false

    const timer = setIntervalImpl?.(() => {
      void autoCommit()
    }, getGitAutoCommitInterval?.())
    setGitAutoCommitTimer?.(timer || null)
    return true
  }

  function stopSyncTimer() {
    const timer = getSyncTimer?.()
    if (!timer) return
    clearIntervalImpl?.(timer)
    setSyncTimer?.(null)
  }

  function startSyncTimer() {
    stopSyncTimer()
    if (!getGitHubToken?.()?.token || !getRemoteUrl?.()) return false

    const timer = setIntervalImpl?.(() => {
      void fetchRemoteChanges()
    }, syncIntervalMs)
    setSyncTimer?.(timer || null)
    return true
  }

  async function fetchRemoteChanges() {
    await ensureGitHubInitialized?.()

    const path = getPath?.()
    const token = getGitHubToken?.()?.token
    if (!path || !token) return null

    const response = await fetchWorkspaceRemoteChanges?.(path, token)
    if (!response) return null

    setRemoteUrl?.(response.remoteUrl)
    applySyncState?.(response.syncState, response.remoteUrl)

    if (response.result?.pulled) {
      try {
        await reloadOpenFilesAfterPull?.()
      } catch {}
    }

    return response.result
  }

  async function syncNow() {
    await ensureGitHubInitialized?.()

    const path = getPath?.()
    const token = getGitHubToken?.()?.token
    if (!path || !token) return null

    const result = await runWorkspaceSyncNow?.(path, token)
    if (!result) return null

    applySyncState?.(result.syncState, getRemoteUrl?.())
    return result.result || null
  }

  function cleanup() {
    stopAutoCommit()
    stopSyncTimer()
  }

  return {
    canAutoCommit,
    startAutoCommit,
    stopAutoCommit,
    autoCommit,
    startSyncTimer,
    stopSyncTimer,
    autoSync,
    fetchRemoteChanges,
    syncNow,
    cleanup,
  }
}
