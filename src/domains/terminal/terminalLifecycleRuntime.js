function clampIndex(value, length) {
  if (length <= 0) return -1
  return Math.min(Math.max(value, 0), length - 1)
}

function copyArgs(cloneArgs, args = []) {
  if (typeof cloneArgs === 'function') return cloneArgs(args)
  return Array.isArray(args) ? [...args] : []
}

function findInstance(state, instanceId) {
  return state.instances.find((instance) => instance.id === instanceId) || null
}

function findGroup(state, groupId) {
  return state.groups.find((group) => group.id === groupId) || null
}

function groupIndex(state, groupId) {
  return state.groups.findIndex((group) => group.id === groupId)
}

function ensureBaseGroup(state, createGroup) {
  if (state.groups.length > 0) return state.groups[0].id
  const groupId = state.nextGroupId++
  state.groups.push(createGroup(groupId))
  state.activeGroupId = groupId
  return groupId
}

export function createTerminalLifecycleRuntime({
  getState,
  hydrateForWorkspace,
  createGroup,
  cloneArgs,
  createDefaultTerminalLabel,
  getLanguageConfig,
  translateLabel,
  shellLabel,
  sharedShellKey,
  sharedLogKey,
  persistSnapshot,
  openBottomPanel,
} = {}) {
  function state() {
    return getState?.()
  }

  function activateInstance(instanceId) {
    const current = state()
    if (!current) return
    const instance = findInstance(current, instanceId)
    if (!instance) return
    current.activeInstanceId = instance.id
    current.activeGroupId = instance.groupId
    const group = findGroup(current, instance.groupId)
    if (group) {
      group.activeInstanceId = instance.id
    }
    persistSnapshot?.()
  }

  function createInstance(definition = {}, { activate = true, persist = true } = {}) {
    const current = state()
    if (!current) return null

    const groupId = definition.groupId || current.activeGroupId || ensureBaseGroup(current, createGroup)
    const instance = {
      id: current.nextInstanceId++,
      key: definition.key || null,
      groupId,
      kind: definition.kind || 'shell',
      mode: definition.mode || (definition.kind === 'log' ? 'log' : 'shell'),
      label: definition.label || createDefaultTerminalLabel?.(),
      customLabel: definition.customLabel || null,
      title: definition.title || '',
      language: definition.language || null,
      spawnCmd: definition.spawnCmd || null,
      spawnArgs: copyArgs(cloneArgs, definition.spawnArgs),
      cwd: '',
      status: 'idle',
      lastExitCode: null,
      lastCols: definition.lastCols || 120,
      lastRows: definition.lastRows || 32,
      sessionId: null,
      shellIntegrationReady: false,
      commandMarkers: [],
      activeCommandMarkerId: null,
      logChunks: [],
      logRevision: 0,
      logResetToken: 0,
    }

    current.instances.push(instance)
    current.tabOrder.push(instance.id)
    const group = findGroup(current, groupId) || findGroup(current, ensureBaseGroup(current, createGroup))
    if (group && !group.activeInstanceId) {
      group.activeInstanceId = instance.id
    }
    if (activate) {
      activateInstance(instance.id)
    }
    if (persist) persistSnapshot?.()
    return instance.id
  }

  function ensureDefaultShell() {
    hydrateForWorkspace?.()
    const current = state()
    if (!current) return null
    if (current.instances.length > 0) return current.activeInstanceId || current.instances[0]?.id || null
    return createInstance()
  }

  function createTerminal() {
    hydrateForWorkspace?.()
    const id = createInstance()
    openBottomPanel?.()
    return id
  }

  function activateGroup(groupId) {
    const current = state()
    if (!current) return
    const group = findGroup(current, groupId)
    if (!group) return
    current.activeGroupId = group.id
    if (group.activeInstanceId) current.activeInstanceId = group.activeInstanceId
  }

  function renameInstance(instanceId, label) {
    const current = state()
    if (!current) return
    const instance = findInstance(current, instanceId)
    if (!instance) return
    const nextLabel = String(label || '').trim()
    if (!nextLabel) return
    instance.label = nextLabel
    instance.customLabel = nextLabel
    persistSnapshot?.()
  }

  function reorderTabs(fromIndex, toIndex) {
    const current = state()
    if (!current || fromIndex === toIndex) return
    const safeFrom = clampIndex(fromIndex, current.tabOrder.length)
    const safeTo = clampIndex(toIndex, current.tabOrder.length)
    if (safeFrom < 0 || safeTo < 0) return
    const [moved] = current.tabOrder.splice(safeFrom, 1)
    current.tabOrder.splice(safeTo, 0, moved)
    persistSnapshot?.()
  }

  function insertGroupAfter(groupId) {
    const current = state()
    if (!current) return null
    const currentIndex = groupIndex(current, groupId)
    const nextId = current.nextGroupId++
    const nextGroup = createGroup(nextId)
    if (currentIndex === -1) {
      current.groups.push(nextGroup)
    } else {
      current.groups.splice(currentIndex + 1, 0, nextGroup)
    }
    return nextId
  }

  function splitInstance(instanceId = state()?.activeInstanceId) {
    const current = state()
    if (!current) return null
    const source = findInstance(current, instanceId)
    if (!source) return null

    const nextGroupId = insertGroupAfter(source.groupId)
    let nextDefinition

    if (source.kind === 'repl' && source.language) {
      const config = getLanguageConfig?.(source.language)
      nextDefinition = {
        groupId: nextGroupId,
        kind: 'repl',
        mode: 'shell',
        label: config?.label || source.label,
        language: source.language,
        spawnCmd: config?.cmd || source.spawnCmd,
        spawnArgs: copyArgs(cloneArgs, config?.args || source.spawnArgs),
      }
    } else {
      nextDefinition = {
        groupId: nextGroupId,
        kind: 'shell',
        mode: 'shell',
        label: createDefaultTerminalLabel?.(),
      }
    }

    const id = createInstance(nextDefinition)
    openBottomPanel?.()
    return id
  }

  function ensureBuildLogTerminal({ key = sharedLogKey, label = 'Build', activate = true } = {}) {
    hydrateForWorkspace?.()
    const current = state()
    if (!current) return null
    const existing = current.instances.find((instance) => instance.key === key)
    if (existing) {
      existing.label = translateLabel?.(label, 'Build') ?? (label || 'Build')
      if (activate) activateInstance(existing.id)
      return existing.id
    }
    return createInstance({
      key,
      kind: 'log',
      mode: 'log',
      label: translateLabel?.(label, 'Build') ?? (label || 'Build'),
    }, { activate })
  }

  function ensureSharedShellTerminal({ activate = true } = {}) {
    hydrateForWorkspace?.()
    const current = state()
    if (!current) return null
    const existing = current.instances.find((instance) => instance.key === sharedShellKey)
    if (existing) {
      existing.label = shellLabel?.() ?? 'Shell'
      if (activate) activateInstance(existing.id)
      return existing.id
    }
    return createInstance({
      key: sharedShellKey,
      kind: 'shell',
      mode: 'shell',
      label: shellLabel?.() ?? 'Shell',
    }, { activate })
  }

  function ensureLanguageTerminal(language, { activate = true } = {}) {
    hydrateForWorkspace?.()
    const current = state()
    if (!current) return null
    const config = getLanguageConfig?.(language)
    if (!config) return null

    const existing = current.instances.find((instance) => instance.language === language && instance.kind === 'repl')
    if (existing) {
      if (activate) activateInstance(existing.id)
      return existing.id
    }

    return createInstance({
      kind: 'repl',
      mode: 'shell',
      label: translateLabel?.(config.label, config.label) ?? config.label,
      language,
      spawnCmd: config.cmd,
      spawnArgs: config.args,
    }, { activate })
  }

  return {
    ensureBaseGroup: () => {
      const current = state()
      if (!current) return null
      return ensureBaseGroup(current, createGroup)
    },
    createInstance,
    ensureDefaultShell,
    createTerminal,
    activateInstance,
    activateGroup,
    renameInstance,
    reorderTabs,
    insertGroupAfter,
    splitInstance,
    ensureBuildLogTerminal,
    ensureSharedShellTerminal,
    ensureLanguageTerminal,
  }
}
