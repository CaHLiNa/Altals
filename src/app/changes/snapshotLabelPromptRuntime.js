export function createSnapshotLabelPromptRuntime({
  timeoutMs = 8000,
  onStateChange,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  const state = {
    promptActive: false,
    dialogVisible: false,
  }

  let promptTimer = null
  let pendingResolve = null

  function publishState() {
    onStateChange?.({ ...state })
  }

  function setState(patch = {}) {
    Object.assign(state, patch)
    publishState()
  }

  function clearPending(result = null) {
    clearTimeoutImpl(promptTimer)
    promptTimer = null
    setState({
      promptActive: false,
      dialogVisible: false,
    })
    if (pendingResolve) {
      const resolve = pendingResolve
      pendingResolve = null
      resolve(result)
    }
  }

  function beginSnapshotLabelConfirmation() {
    clearPending(null)
    setState({
      promptActive: true,
      dialogVisible: false,
    })

    return new Promise((resolve) => {
      pendingResolve = resolve
      promptTimer = setTimeoutImpl(() => {
        clearPending(null)
      }, timeoutMs)
    })
  }

  function openSnapshotLabelDialog() {
    if (!state.promptActive) return false
    clearTimeoutImpl(promptTimer)
    promptTimer = null
    setState({
      dialogVisible: true,
    })
    return true
  }

  function resolveSnapshotLabelDialog(name = null) {
    clearPending(name)
  }

  function dispose() {
    clearPending(null)
  }

  publishState()

  return {
    beginSnapshotLabelConfirmation,
    dispose,
    getState() {
      return { ...state }
    },
    openSnapshotLabelDialog,
    resolveSnapshotLabelDialog,
  }
}
