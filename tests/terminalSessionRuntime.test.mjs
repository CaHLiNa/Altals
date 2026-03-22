import test from 'node:test'
import assert from 'node:assert/strict'

import { createTerminalSessionRuntime } from '../src/domains/terminal/terminalSessionRuntime.js'

function createShellInstance(id, groupId = 1, overrides = {}) {
  return {
    id,
    key: null,
    groupId,
    kind: 'shell',
    mode: 'shell',
    label: `Terminal ${id}`,
    customLabel: null,
    title: '',
    language: null,
    spawnCmd: null,
    spawnArgs: [],
    cwd: '',
    status: 'running',
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
    ...overrides,
  }
}

function createHarness(overrides = {}) {
  const state = {
    nextMarkerId: 1,
    groups: [{ id: 1, activeInstanceId: 1 }],
    instances: [createShellInstance(1)],
    tabOrder: [1],
    activeGroupId: 1,
    activeInstanceId: 1,
  }
  const killedSessions = []
  const disposedSessions = []
  const clearedSnapshots = []
  const closedPanels = []
  const activationCalls = []
  const persisted = []

  const runtime = createTerminalSessionRuntime({
    getState: () => state,
    getWorkspacePath: () => '/workspace',
    isBottomPanelOpen: () => true,
    closeBottomPanel: () => closedPanels.push(true),
    killTerminalSession: async (sessionId) => {
      killedSessions.push(sessionId)
    },
    disposeTerminalSession: async (sessionId) => {
      disposedSessions.push(sessionId)
    },
    clearTerminalSnapshot: (workspacePath) => {
      clearedSnapshots.push(workspacePath)
    },
    activateInstance: (instanceId) => {
      activationCalls.push(instanceId)
      const instance = state.instances.find((item) => item.id === instanceId)
      state.activeInstanceId = instanceId
      state.activeGroupId = instance?.groupId || null
    },
    persistSnapshot: () => persisted.push(true),
    maxCommandMarkers: 2,
    now: () => 1234,
    ...overrides,
  })

  return {
    state,
    runtime,
    killedSessions,
    disposedSessions,
    clearedSnapshots,
    closedPanels,
    activationCalls,
    persisted,
  }
}

test('terminal session runtime closes the last instance, closes the panel, and clears the snapshot', async () => {
  const { state, runtime, killedSessions, disposedSessions, clearedSnapshots, closedPanels } = createHarness({
    getState: () => ({
      nextMarkerId: state.nextMarkerId,
      groups: state.groups,
      instances: state.instances,
      tabOrder: state.tabOrder,
      activeGroupId: state.activeGroupId,
      activeInstanceId: state.activeInstanceId,
    }),
  })
  state.instances[0].sessionId = 41

  await runtime.closeInstance(1)

  assert.deepEqual(killedSessions, [41])
  assert.deepEqual(disposedSessions, [41])
  assert.deepEqual(clearedSnapshots, ['/workspace'])
  assert.equal(closedPanels.length, 1)
})

test('terminal session runtime closes one instance and activates a fallback instance', async () => {
  const { state, runtime, activationCalls, persisted } = createHarness()

  state.groups = [
    { id: 1, activeInstanceId: 1 },
    { id: 2, activeInstanceId: 2 },
  ]
  state.instances = [
    createShellInstance(1, 1),
    createShellInstance(2, 2, { sessionId: 7 }),
  ]
  state.tabOrder = [1, 2]
  state.activeGroupId = 2
  state.activeInstanceId = 2

  await runtime.closeInstance(2)

  assert.deepEqual(state.tabOrder, [1])
  assert.equal(state.instances.length, 1)
  assert.equal(state.groups.length, 1)
  assert.deepEqual(activationCalls, [1])
  assert.ok(persisted.length >= 1)
})

test('terminal session runtime updates cwd, surface size, and exit status', () => {
  const { state, runtime } = createHarness()

  runtime.updateInstanceCwd(1, '/workspace/src')
  runtime.setSurfaceSize(1, 160, 48)
  runtime.markSessionExited(1, { code: 5 })

  assert.equal(state.instances[0].cwd, '/workspace/src')
  assert.equal(state.instances[0].lastCols, 160)
  assert.equal(state.instances[0].lastRows, 48)
  assert.equal(state.instances[0].status, 'exited')
  assert.equal(state.instances[0].lastExitCode, 5)
  assert.equal(state.instances[0].activeCommandMarkerId, null)
})

test('terminal session runtime registers command markers with trimming and finish status', () => {
  const { state, runtime } = createHarness()

  state.instances[0].cwd = '/workspace'

  const first = runtime.registerCommandStart(1, ' first ')
  const second = runtime.registerCommandStart(1, 'second')
  const third = runtime.registerCommandStart(1, 'third')

  assert.equal(first, 1)
  assert.equal(second, 2)
  assert.equal(third, 3)
  assert.equal(state.instances[0].commandMarkers.length, 2)
  assert.deepEqual(state.instances[0].commandMarkers.map((item) => item.command), ['second', 'third'])
  assert.equal(state.instances[0].activeCommandMarkerId, 3)
  assert.equal(state.instances[0].status, 'busy')

  runtime.registerCommandFinish(1, third, 0)

  assert.equal(state.instances[0].commandMarkers[1].status, 0)
  assert.equal(state.instances[0].commandMarkers[1].finishedAt, 1234)
  assert.equal(state.instances[0].activeCommandMarkerId, null)
  assert.equal(state.instances[0].lastExitCode, 0)
  assert.equal(state.instances[0].status, 'running')
})
