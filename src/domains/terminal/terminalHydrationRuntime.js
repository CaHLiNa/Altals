function ensureBaseGroup(state, createGroup) {
  if ((state.groups || []).length > 0) return state.groups[0].id
  const groupId = state.nextGroupId++
  state.groups = [createGroup(groupId)]
  state.activeGroupId = groupId
  return groupId
}

export function createTerminalHydrationRuntime({
  createEmptyState,
  createGroup,
  cloneArgs,
  getWorkspacePath,
  getHydratedWorkspacePath,
  getStateSnapshot,
  getInstances,
  replaceState,
  normalizeSerializedGroup,
  normalizeSerializedInstance,
  refreshLocalizedLabels,
  saveTerminalSnapshot,
  loadTerminalSnapshot,
  killTerminalSession,
  disposeTerminalSession,
} = {}) {
  function persistSnapshot() {
    const workspacePath = getWorkspacePath?.()
    if (!workspacePath) return null

    const state = getStateSnapshot?.()
    if (!state) return null

    const snapshot = {
      nextInstanceId: state.nextInstanceId,
      nextGroupId: state.nextGroupId,
      nextMarkerId: state.nextMarkerId,
      activeGroupId: state.activeGroupId,
      activeInstanceId: state.activeInstanceId,
      groups: (state.groups || []).map((group) => ({
        id: group.id,
        activeInstanceId: group.activeInstanceId,
      })),
      tabOrder: [...(state.tabOrder || [])],
      instances: (state.instances || []).map((instance) => ({
        id: instance.id,
        key: instance.key,
        groupId: instance.groupId,
        kind: instance.kind,
        mode: instance.mode,
        label: instance.label,
        customLabel: instance.customLabel,
        title: instance.title,
        language: instance.language,
        spawnCmd: instance.spawnCmd,
        spawnArgs: cloneArgs?.(instance.spawnArgs),
      })),
    }

    saveTerminalSnapshot?.(workspacePath, snapshot)
    return snapshot
  }

  async function resetForWorkspace() {
    const sessionIds = (getInstances?.() || [])
      .map((instance) => instance.sessionId)
      .filter((sessionId) => sessionId !== null)

    for (const sessionId of sessionIds) {
      try {
        await killTerminalSession?.(sessionId)
      } catch {}
      await disposeTerminalSession?.(sessionId)
    }

    replaceState?.(createEmptyState?.())
  }

  function hydrateForWorkspace(force = false) {
    const workspacePath = getWorkspacePath?.() || ''
    const hydratedWorkspacePath = getHydratedWorkspacePath?.() || ''

    if (!workspacePath) {
      if (hydratedWorkspacePath) {
        void resetForWorkspace()
      }
      return false
    }

    if (!force && hydratedWorkspacePath === workspacePath) return false

    const nextState = createEmptyState?.()
    const snapshot = loadTerminalSnapshot?.(workspacePath)

    if (!snapshot) {
      ensureBaseGroup(nextState, createGroup)
      nextState.hydratedWorkspacePath = workspacePath
      replaceState?.(nextState)
      return true
    }

    nextState.nextInstanceId = Math.max(Number(snapshot.nextInstanceId) || 1, 1)
    nextState.nextGroupId = Math.max(Number(snapshot.nextGroupId) || 1, 1)
    nextState.nextMarkerId = Math.max(Number(snapshot.nextMarkerId) || 1, 1)
    nextState.groups = (snapshot.groups || [])
      .map((group) => normalizeSerializedGroup?.(group))
      .filter((group) => group?.id > 0)
    nextState.instances = (snapshot.instances || [])
      .map((instance) => normalizeSerializedInstance?.(instance))
      .filter((instance) => instance?.id > 0)

    const validIds = new Set(nextState.instances.map((instance) => instance.id))
    nextState.tabOrder = (snapshot.tabOrder || []).filter((id) => validIds.has(id))
    for (const instance of nextState.instances) {
      if (!nextState.tabOrder.includes(instance.id)) {
        nextState.tabOrder.push(instance.id)
      }
    }

    ensureBaseGroup(nextState, createGroup)

    const validGroupIds = new Set(nextState.groups.map((group) => group.id))
    for (const instance of nextState.instances) {
      if (!validGroupIds.has(instance.groupId)) {
        instance.groupId = nextState.groups[0].id
      }
    }

    nextState.activeGroupId = validGroupIds.has(snapshot.activeGroupId)
      ? snapshot.activeGroupId
      : nextState.groups[0]?.id || null
    nextState.activeInstanceId = validIds.has(snapshot.activeInstanceId)
      ? snapshot.activeInstanceId
      : nextState.tabOrder[0] || null

    for (const group of nextState.groups) {
      const groupInstances = nextState.instances.filter((instance) => instance.groupId === group.id)
      if (!groupInstances.some((instance) => instance.id === group.activeInstanceId)) {
        group.activeInstanceId = groupInstances[0]?.id || null
      }
    }

    nextState.hydratedWorkspacePath = workspacePath
    replaceState?.(nextState)
    refreshLocalizedLabels?.()
    return true
  }

  return {
    persistSnapshot,
    resetForWorkspace,
    hydrateForWorkspace,
  }
}
