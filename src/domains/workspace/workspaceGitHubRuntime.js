export function createWorkspaceGitHubRuntime({
  getPath,
  getRemoteUrl,
  getGitHubToken,
  getGitHubInitialized,
  getGitHubInitPromise,
  setGitHubInitPromise,
  patchState,
  createDisconnectedGitHubState,
  mapWorkspaceSyncState,
  loadWorkspaceGitHubSession,
  connectWorkspaceGitHub,
  disconnectWorkspaceGitHub,
  linkWorkspaceRepo,
  unlinkWorkspaceRepo,
  startSyncTimer,
  stopSyncTimer,
  startAutoCommit,
  autoSync,
  onInitError,
} = {}) {
  function applySyncState(syncState, remoteUrl = getRemoteUrl?.()) {
    patchState?.(mapWorkspaceSyncState?.(syncState, remoteUrl))
  }

  async function ensureGitHubInitialized(options = {}) {
    const force = options?.force === true
    if (getGitHubInitialized?.() && !force) return getGitHubToken?.()

    const pending = getGitHubInitPromise?.()
    if (pending && !force) return pending

    const initPromise = (async () => {
      if (force) {
        patchState?.(createDisconnectedGitHubState?.({ remoteUrl: getRemoteUrl?.() }))
      }

      try {
        const session = await loadWorkspaceGitHubSession?.(getPath?.(), options)
        if (!session) {
          patchState?.({
            githubToken: null,
            githubUser: null,
          })
          return null
        }

        patchState?.({
          githubToken: session.token,
          githubUser: session.user,
          remoteUrl: session.remoteUrl,
          syncStatus: session.syncStatus,
        })
        if (session.syncStatus === 'idle') {
          startSyncTimer?.()
        }

        return session.token
      } catch (error) {
        onInitError?.(error)
        return null
      } finally {
        const localOnly = options?.localOnly === true
        patchState?.({
          githubInitialized: localOnly ? !!getGitHubToken?.() : true,
        })
        setGitHubInitPromise?.(null)
      }
    })()

    setGitHubInitPromise?.(initPromise)
    return initPromise
  }

  async function initGitHub(options = {}) {
    return ensureGitHubInitialized(options)
  }

  async function connectGitHub(tokenData) {
    const session = await connectWorkspaceGitHub?.({
      tokenData,
      path: getPath?.(),
    })
    if (!session) return null

    patchState?.({
      githubToken: session.token,
      githubInitialized: true,
      githubUser: session.user,
    })
    return session
  }

  async function disconnectGitHub() {
    await disconnectWorkspaceGitHub?.()
    stopSyncTimer?.()
    patchState?.({
      ...createDisconnectedGitHubState?.({ remoteUrl: getRemoteUrl?.() }),
      githubInitialized: true,
    })
    setGitHubInitPromise?.(null)
  }

  async function linkRepo(cloneUrl) {
    const path = getPath?.()
    if (!path) return null

    const result = await linkWorkspaceRepo?.(path, cloneUrl)
    if (!result) return null

    patchState?.({
      remoteUrl: result.remoteUrl,
      syncStatus: result.syncStatus,
    })
    if (result.historyRepo?.autoCommitEnabled) {
      void startAutoCommit?.()
    }
    startSyncTimer?.()
    await autoSync?.()
    return result
  }

  async function unlinkRepo() {
    const path = getPath?.()
    if (!path) return

    await unlinkWorkspaceRepo?.(path)
    stopSyncTimer?.()
    patchState?.({
      remoteUrl: '',
      syncStatus: 'disconnected',
      syncConflictBranch: null,
    })
  }

  return {
    applySyncState,
    ensureGitHubInitialized,
    initGitHub,
    connectGitHub,
    disconnectGitHub,
    linkRepo,
    unlinkRepo,
  }
}
