import {
  listenForWorkspaceTreeChanges,
  startWorkspaceTreeWatch,
  stopWorkspaceTreeWatch,
} from '../../services/fileTreeWatchBridge.js'

const ACTIVE_TREE_POLL_INTERVAL_MS = 15000
const IDLE_TREE_POLL_INTERVAL_MS = 60000
const TREE_ACTIVITY_WINDOW_MS = 15000
const NATIVE_TREE_REFRESH_DEBOUNCE_MS = 180

export function createFileTreeWatchRuntime({
  getWorkspaceContext,
  refreshVisibleTree,
  addWindowListener = (type, handler, options) => window.addEventListener(type, handler, options),
  removeWindowListener = (type, handler, options) => window.removeEventListener(type, handler, options),
  addDocumentListener = (type, handler) => document.addEventListener(type, handler),
  removeDocumentListener = (type, handler) => document.removeEventListener(type, handler),
  getVisibilityState = () => (typeof document === 'undefined' ? 'hidden' : document.visibilityState),
  createTimer = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearScheduledTimer = (timerId) => clearTimeout(timerId),
  startNativeWatcher = (workspacePath) => startWorkspaceTreeWatch(workspacePath),
  stopNativeWatcher = () => stopWorkspaceTreeWatch(),
  subscribeNativeWatcher = (handler) => listenForWorkspaceTreeChanges(handler),
  now = () => Date.now(),
} = {}) {
  let pollTimer = null
  let nativeRefreshTimer = null
  let nativeWatcherUnlisten = null
  let nativeWatcherActive = false
  let activityHandlers = null
  let lastTreeActivityAt = 0

  function clearPollTimer() {
    if (!pollTimer) return
    clearScheduledTimer(pollTimer)
    pollTimer = null
  }

  function clearNativeRefreshTimer() {
    if (!nativeRefreshTimer) return
    clearScheduledTimer(nativeRefreshTimer)
    nativeRefreshTimer = null
  }

  function teardownNativeWatcher() {
    clearNativeRefreshTimer()
    if (typeof nativeWatcherUnlisten === 'function') {
      nativeWatcherUnlisten()
    }
    nativeWatcherUnlisten = null
    if (nativeWatcherActive) {
      Promise.resolve(stopNativeWatcher?.()).catch(() => {})
    }
    nativeWatcherActive = false
  }

  function teardownActivityHooks() {
    if (!activityHandlers) return
    const { focusHandler, visibilityHandler } = activityHandlers
    removeWindowListener('focus', focusHandler)
    removeDocumentListener('visibilitychange', visibilityHandler)
    activityHandlers = null
  }

  function scheduleNextTreePoll() {
    clearPollTimer()

    const workspace = getWorkspaceContext?.() || {}
    if (!workspace.path) return
    if (getVisibilityState() !== 'visible') return

    const isActive = now() - lastTreeActivityAt <= TREE_ACTIVITY_WINDOW_MS
    const delayMs = isActive ? ACTIVE_TREE_POLL_INTERVAL_MS : IDLE_TREE_POLL_INTERVAL_MS

    pollTimer = createTimer(async () => {
      pollTimer = null
      const activeWorkspace = getWorkspaceContext?.() || {}
      if (!activeWorkspace.path || getVisibilityState() !== 'visible') {
        scheduleNextTreePoll()
        return
      }

      try {
        await refreshVisibleTree?.({ suppressErrors: true, reason: 'poll' })
      } catch {
        // Workspace may have closed between scheduling and execution.
      } finally {
        scheduleNextTreePoll()
      }
    }, delayMs)
  }

  function noteTreeActivity() {
    lastTreeActivityAt = now()
    if (getWorkspaceContext?.()?.path) {
      scheduleNextTreePoll()
    }
  }

  function setupActivityHooks() {
    teardownActivityHooks()
    const focusHandler = () => noteTreeActivity()
    const visibilityHandler = () => scheduleNextTreePoll()
    activityHandlers = { focusHandler, visibilityHandler }
    addWindowListener('focus', focusHandler)
    addDocumentListener('visibilitychange', visibilityHandler)
  }

  function scheduleNativeRefresh(reason = 'fs-watch') {
    clearNativeRefreshTimer()
    nativeRefreshTimer = createTimer(async () => {
      nativeRefreshTimer = null

      const workspace = getWorkspaceContext?.() || {}
      if (!workspace.path) return
      if (getVisibilityState() !== 'visible') return

      lastTreeActivityAt = now()

      try {
        await refreshVisibleTree?.({ suppressErrors: true, reason })
      } catch {
        // Workspace may have changed while the refresh was queued.
      } finally {
        scheduleNextTreePoll()
      }
    }, NATIVE_TREE_REFRESH_DEBOUNCE_MS)
  }

  async function setupNativeWatcher() {
    teardownNativeWatcher()

    const workspace = getWorkspaceContext?.() || {}
    if (!workspace.path) return

    try {
      await startNativeWatcher?.(workspace.path)
      nativeWatcherActive = true
      nativeWatcherUnlisten = await subscribeNativeWatcher?.((payload = {}) => {
        const activeWorkspace = getWorkspaceContext?.() || {}
        if (!activeWorkspace.path) return
        if (String(payload.workspacePath || '') !== String(activeWorkspace.path || '')) return
        scheduleNativeRefresh('fs-watch')
      })
    } catch (error) {
      nativeWatcherUnlisten = null
      nativeWatcherActive = false
      console.warn('[file-tree] native workspace watcher unavailable:', error)
    }
  }

  async function startWatching() {
    stopWatching()
    setupActivityHooks()
    noteTreeActivity()
    await setupNativeWatcher()

    scheduleNextTreePoll()
  }

  function stopWatching() {
    clearPollTimer()
    teardownNativeWatcher()
    teardownActivityHooks()
    lastTreeActivityAt = 0
  }

  return {
    noteTreeActivity,
    startWatching,
    stopWatching,
  }
}
