import test from 'node:test'
import assert from 'node:assert/strict'

import { createTerminalLifecycleRuntime } from '../src/domains/terminal/terminalLifecycleRuntime.js'

function nextShellNumber(instances) {
  return instances
    .filter((instance) => instance.kind === 'shell' && !instance.key && !instance.language && !instance.customLabel)
    .length + 1
}

function createHarness(overrides = {}) {
  const state = {
    hydratedWorkspacePath: '',
    nextInstanceId: 1,
    nextGroupId: 1,
    nextMarkerId: 1,
    groups: [],
    instances: [],
    tabOrder: [],
    activeGroupId: null,
    activeInstanceId: null,
  }

  const persistCalls = []
  const hydrateCalls = []
  const openCalls = []
  const languageConfigs = {
    python: { label: 'Python', cmd: 'python', args: ['-i'] },
    r: { label: 'R', cmd: 'R', args: ['--quiet'] },
  }

  const runtime = createTerminalLifecycleRuntime({
    getState: () => state,
    hydrateForWorkspace: () => hydrateCalls.push(true),
    createGroup: (id) => ({ id, activeInstanceId: null }),
    cloneArgs: (args = []) => (Array.isArray(args) ? [...args] : []),
    createDefaultTerminalLabel: () => `Terminal ${nextShellNumber(state.instances)}`,
    getLanguageConfig: (language) => languageConfigs[language] || null,
    translateLabel: (label, fallback = '') => label || fallback,
    shellLabel: () => 'Shell',
    sharedShellKey: 'shared-shell-terminal',
    sharedLogKey: 'shared-build-terminal',
    persistSnapshot: () => persistCalls.push({
      activeGroupId: state.activeGroupId,
      activeInstanceId: state.activeInstanceId,
      tabOrder: [...state.tabOrder],
    }),
    openBottomPanel: () => openCalls.push(true),
    ...overrides,
  })

  return {
    state,
    runtime,
    persistCalls,
    hydrateCalls,
    openCalls,
  }
}

test('createInstance creates a base group and activates the new instance', () => {
  const { state, runtime, persistCalls } = createHarness()

  const id = runtime.createInstance()

  assert.equal(id, 1)
  assert.equal(state.groups.length, 1)
  assert.equal(state.groups[0].id, 1)
  assert.equal(state.groups[0].activeInstanceId, 1)
  assert.equal(state.activeGroupId, 1)
  assert.equal(state.activeInstanceId, 1)
  assert.deepEqual(state.tabOrder, [1])
  assert.equal(state.instances[0].label, 'Terminal 1')
  assert.ok(persistCalls.length >= 1)
})

test('createTerminal hydrates first and opens the bottom panel', () => {
  const { state, runtime, hydrateCalls, openCalls } = createHarness()

  const id = runtime.createTerminal()

  assert.equal(id, 1)
  assert.equal(hydrateCalls.length, 1)
  assert.equal(openCalls.length, 1)
  assert.equal(state.instances.length, 1)
})

test('splitInstance clones repl terminals into a new group using language config', () => {
  const { state, runtime, openCalls } = createHarness()

  state.groups = [{ id: 1, activeInstanceId: 1 }]
  state.nextGroupId = 2
  state.instances = [{
    id: 1,
    key: null,
    groupId: 1,
    kind: 'repl',
    mode: 'shell',
    label: 'Python',
    customLabel: null,
    title: '',
    language: 'python',
    spawnCmd: 'python',
    spawnArgs: ['-q'],
    cwd: '',
    status: 'idle',
    lastExitCode: null,
    lastCols: 120,
    lastRows: 32,
    sessionId: null,
    shellIntegrationReady: false,
    commandMarkers: [],
    activeCommandMarkerId: null,
    logChunks: [],
    logRevision: 0,
    logResetToken: 0,
  }]
  state.tabOrder = [1]
  state.activeGroupId = 1
  state.activeInstanceId = 1
  state.nextInstanceId = 2

  const nextId = runtime.splitInstance(1)

  assert.equal(nextId, 2)
  assert.equal(state.groups.length, 2)
  assert.equal(state.groups[1].id, 2)
  assert.equal(state.activeGroupId, 2)
  assert.equal(state.activeInstanceId, 2)
  assert.deepEqual(state.instances[1].spawnArgs, ['-i'])
  assert.equal(state.instances[1].language, 'python')
  assert.equal(openCalls.length, 1)
})

test('ensureSharedShellTerminal reuses existing shared terminals and relabels them', () => {
  const { state, runtime, hydrateCalls } = createHarness()

  state.groups = [{ id: 1, activeInstanceId: 1 }]
  state.instances = [{
    id: 1,
    key: 'shared-shell-terminal',
    groupId: 1,
    kind: 'shell',
    mode: 'shell',
    label: 'Old',
    customLabel: null,
    title: '',
    language: null,
    spawnCmd: null,
    spawnArgs: [],
    cwd: '',
    status: 'idle',
    lastExitCode: null,
    lastCols: 120,
    lastRows: 32,
    sessionId: null,
    shellIntegrationReady: false,
    commandMarkers: [],
    activeCommandMarkerId: null,
    logChunks: [],
    logRevision: 0,
    logResetToken: 0,
  }]
  state.tabOrder = [1]
  state.activeGroupId = 1
  state.activeInstanceId = null

  const id = runtime.ensureSharedShellTerminal()

  assert.equal(id, 1)
  assert.equal(state.instances.length, 1)
  assert.equal(state.instances[0].label, 'Shell')
  assert.equal(state.activeInstanceId, 1)
  assert.equal(hydrateCalls.length, 1)
})

test('ensureBuildLogTerminal and ensureLanguageTerminal create specialized terminals', () => {
  const { state, runtime } = createHarness()

  const logId = runtime.ensureBuildLogTerminal({ key: 'tool-latex-terminal', label: 'LaTeX', activate: false })
  const replId = runtime.ensureLanguageTerminal('python', { activate: true })

  assert.equal(logId, 1)
  assert.equal(replId, 2)
  assert.equal(state.instances[0].kind, 'log')
  assert.equal(state.instances[0].label, 'LaTeX')
  assert.equal(state.instances[1].kind, 'repl')
  assert.equal(state.instances[1].language, 'python')
  assert.deepEqual(state.instances[1].spawnArgs, ['-i'])
  assert.equal(state.activeInstanceId, 2)
})

test('renameInstance and reorderTabs update state through the lifecycle runtime', () => {
  const { state, runtime, persistCalls } = createHarness()

  state.groups = [{ id: 1, activeInstanceId: 1 }]
  state.instances = [
    {
      id: 1,
      key: null,
      groupId: 1,
      kind: 'shell',
      mode: 'shell',
      label: 'Terminal 1',
      customLabel: null,
      title: '',
      language: null,
      spawnCmd: null,
      spawnArgs: [],
      cwd: '',
      status: 'idle',
      lastExitCode: null,
      lastCols: 120,
      lastRows: 32,
      sessionId: null,
      shellIntegrationReady: false,
      commandMarkers: [],
      activeCommandMarkerId: null,
      logChunks: [],
      logRevision: 0,
      logResetToken: 0,
    },
    {
      id: 2,
      key: null,
      groupId: 1,
      kind: 'shell',
      mode: 'shell',
      label: 'Terminal 2',
      customLabel: null,
      title: '',
      language: null,
      spawnCmd: null,
      spawnArgs: [],
      cwd: '',
      status: 'idle',
      lastExitCode: null,
      lastCols: 120,
      lastRows: 32,
      sessionId: null,
      shellIntegrationReady: false,
      commandMarkers: [],
      activeCommandMarkerId: null,
      logChunks: [],
      logRevision: 0,
      logResetToken: 0,
    },
  ]
  state.tabOrder = [1, 2]

  runtime.renameInstance(2, 'Notes Shell')
  runtime.reorderTabs(1, 0)

  assert.equal(state.instances[1].label, 'Notes Shell')
  assert.equal(state.instances[1].customLabel, 'Notes Shell')
  assert.deepEqual(state.tabOrder, [2, 1])
  assert.ok(persistCalls.length >= 2)
})
