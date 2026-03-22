function findInstance(state, instanceId) {
  return state.instances.find((instance) => instance.id === instanceId) || null
}

function findGroup(state, groupId) {
  return state.groups.find((group) => group.id === groupId) || null
}

export function createTerminalSessionRuntime({
  getState,
  getWorkspacePath,
  isBottomPanelOpen,
  closeBottomPanel,
  killTerminalSession,
  disposeTerminalSession,
  clearTerminalSnapshot,
  activateInstance,
  persistSnapshot,
  maxCommandMarkers = 200,
  now = () => Date.now(),
} = {}) {
  function state() {
    return getState?.()
  }

  async function closeInstance(instanceId) {
    const current = state()
    if (!current) return

    const instanceIndex = current.instances.findIndex((instance) => instance.id === instanceId)
    if (instanceIndex === -1) return

    const instance = current.instances[instanceIndex]
    if (instance.sessionId !== null) {
      try {
        await killTerminalSession?.(instance.sessionId)
      } catch {}
      await disposeTerminalSession?.(instance.sessionId)
    }

    current.instances.splice(instanceIndex, 1)
    current.tabOrder = current.tabOrder.filter((id) => id !== instanceId)

    const group = findGroup(current, instance.groupId)
    const remainingGroupInstances = current.instances.filter((item) => item.groupId === instance.groupId)
    if (group) {
      group.activeInstanceId = remainingGroupInstances[0]?.id || null
    }
    if (group && remainingGroupInstances.length === 0 && current.groups.length > 1) {
      current.groups = current.groups.filter((item) => item.id !== group.id)
    }

    if (current.instances.length === 0) {
      current.activeInstanceId = null
      current.activeGroupId = current.groups[0]?.id || null
      if (isBottomPanelOpen?.()) {
        closeBottomPanel?.()
      }
      clearTerminalSnapshot?.(getWorkspacePath?.() || '')
      return
    }

    const nextActive = findInstance(current, current.activeInstanceId)
      || findInstance(current, group?.activeInstanceId)
      || current.instances[0]
    activateInstance?.(nextActive.id)
    persistSnapshot?.()
  }

  function markSessionExited(instanceId, payload = null) {
    const instance = findInstance(state() || { instances: [] }, instanceId)
    if (!instance) return
    instance.sessionId = null
    instance.status = 'exited'
    instance.activeCommandMarkerId = null
    instance.lastExitCode = Number.isFinite(payload?.code) ? payload.code : null
  }

  function updateInstanceCwd(instanceId, cwd) {
    const instance = findInstance(state() || { instances: [] }, instanceId)
    if (!instance) return
    instance.cwd = cwd || ''
  }

  function setSurfaceSize(instanceId, cols, rows) {
    const instance = findInstance(state() || { instances: [] }, instanceId)
    if (!instance) return
    instance.lastCols = cols || instance.lastCols
    instance.lastRows = rows || instance.lastRows
  }

  function registerCommandStart(instanceId, command = '') {
    const current = state()
    if (!current) return null
    const instance = findInstance(current, instanceId)
    if (!instance) return null

    const markerId = current.nextMarkerId++
    const marker = {
      id: markerId,
      command: String(command || '').trim(),
      cwd: instance.cwd || '',
      status: null,
      startedAt: now(),
    }
    instance.commandMarkers.push(marker)
    if (instance.commandMarkers.length > maxCommandMarkers) {
      instance.commandMarkers.splice(0, instance.commandMarkers.length - maxCommandMarkers)
    }
    instance.activeCommandMarkerId = markerId
    instance.status = 'busy'
    return markerId
  }

  function registerCommandFinish(instanceId, markerId, status) {
    const current = state()
    if (!current) return
    const instance = findInstance(current, instanceId)
    if (!instance) return

    const targetId = markerId || instance.activeCommandMarkerId
    const marker = instance.commandMarkers.find((item) => item.id === targetId)
    if (marker) {
      marker.status = Number.isFinite(Number(status)) ? Number(status) : null
      marker.finishedAt = now()
    }

    instance.activeCommandMarkerId = null
    instance.lastExitCode = Number.isFinite(Number(status)) ? Number(status) : null
    instance.status = 'running'
  }

  return {
    closeInstance,
    markSessionExited,
    updateInstanceCwd,
    setSurfaceSize,
    registerCommandStart,
    registerCommandFinish,
  }
}
