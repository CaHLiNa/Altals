import test from 'node:test'
import assert from 'node:assert/strict'

import { createTerminalHydrationRuntime } from '../src/domains/terminal/terminalHydrationRuntime.js'

function createEmptyState() {
  return {
    hydratedWorkspacePath: '',
    nextInstanceId: 1,
    nextGroupId: 1,
    nextMarkerId: 1,
    groups: [],
    instances: [],
    tabOrder: [],
    activeGroupId: null,
    activeInstanceId: null,
    find: {
      visible: false,
      query: '',
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    },
  }
}

function createGroup(id) {
  return {
    id,
    activeInstanceId: null,
  }
}

test('terminal hydration runtime persists snapshot state for the active workspace', () => {
  const saved = []
  const state = {
    nextInstanceId: 5,
    nextGroupId: 3,
    nextMarkerId: 8,
    activeGroupId: 2,
    activeInstanceId: 4,
    groups: [
      { id: 1, activeInstanceId: 3 },
      { id: 2, activeInstanceId: 4 },
    ],
    tabOrder: [3, 4],
    instances: [
      {
        id: 3,
        key: 'shared-shell-terminal',
        groupId: 1,
        kind: 'shell',
        mode: 'shell',
        label: 'Shell',
        customLabel: null,
        title: '',
        language: null,
        spawnCmd: null,
        spawnArgs: ['-l'],
      },
    ],
  }

  const runtime = createTerminalHydrationRuntime({
    createEmptyState,
    createGroup,
    cloneArgs: (args = []) => [...args],
    getWorkspacePath: () => '/workspace/demo',
    getStateSnapshot: () => state,
    saveTerminalSnapshot: (workspacePath, snapshot) => {
      saved.push({ workspacePath, snapshot })
    },
  })

  const snapshot = runtime.persistSnapshot()

  assert.deepEqual(snapshot, {
    nextInstanceId: 5,
    nextGroupId: 3,
    nextMarkerId: 8,
    activeGroupId: 2,
    activeInstanceId: 4,
    groups: [
      { id: 1, activeInstanceId: 3 },
      { id: 2, activeInstanceId: 4 },
    ],
    tabOrder: [3, 4],
    instances: [
      {
        id: 3,
        key: 'shared-shell-terminal',
        groupId: 1,
        kind: 'shell',
        mode: 'shell',
        label: 'Shell',
        customLabel: null,
        title: '',
        language: null,
        spawnCmd: null,
        spawnArgs: ['-l'],
      },
    ],
  })
  assert.deepEqual(saved, [{
    workspacePath: '/workspace/demo',
    snapshot,
  }])
})

test('terminal hydration runtime resets workspace sessions before clearing state', async () => {
  let state = {
    ...createEmptyState(),
    hydratedWorkspacePath: '/workspace/demo',
    instances: [
      { id: 1, sessionId: 10 },
      { id: 2, sessionId: null },
      { id: 3, sessionId: 20 },
    ],
  }
  const killed = []
  const disposed = []

  const runtime = createTerminalHydrationRuntime({
    createEmptyState,
    createGroup,
    getInstances: () => state.instances,
    replaceState: (nextState) => {
      state = nextState
    },
    killTerminalSession: async (sessionId) => {
      killed.push(sessionId)
      if (sessionId === 20) throw new Error('already gone')
    },
    disposeTerminalSession: async (sessionId) => {
      disposed.push(sessionId)
    },
  })

  await runtime.resetForWorkspace()
  assert.deepEqual(killed, [10, 20])
  assert.deepEqual(disposed, [10, 20])
  assert.deepEqual(state, createEmptyState())
})

test('terminal hydration runtime hydrates saved snapshots and repairs invalid ids', () => {
  let state = createEmptyState()
  let refreshCount = 0

  const runtime = createTerminalHydrationRuntime({
    createEmptyState,
    createGroup,
    getWorkspacePath: () => '/workspace/demo',
    getHydratedWorkspacePath: () => state.hydratedWorkspacePath,
    replaceState: (nextState) => {
      state = nextState
    },
    normalizeSerializedGroup: (group) => ({
      id: Number(group?.id) || 0,
      activeInstanceId: Number(group?.activeInstanceId) || null,
    }),
    normalizeSerializedInstance: (instance) => ({
      id: Number(instance?.id) || 0,
      key: instance?.key || null,
      groupId: Number(instance?.groupId) || null,
      kind: instance?.kind || 'shell',
      mode: instance?.mode || 'shell',
      label: instance?.label || 'Terminal',
      customLabel: instance?.customLabel || null,
      title: instance?.title || '',
      language: instance?.language || null,
      spawnCmd: instance?.spawnCmd || null,
      spawnArgs: Array.isArray(instance?.spawnArgs) ? [...instance.spawnArgs] : [],
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
    }),
    refreshLocalizedLabels: () => {
      refreshCount += 1
    },
    loadTerminalSnapshot: () => ({
      nextInstanceId: 6,
      nextGroupId: 3,
      nextMarkerId: 9,
      activeGroupId: 999,
      activeInstanceId: 999,
      groups: [
        { id: 2, activeInstanceId: 999 },
      ],
      tabOrder: [999, 4],
      instances: [
        { id: 4, groupId: 999, kind: 'shell', mode: 'shell', label: 'Shell', spawnArgs: [] },
        { id: 5, groupId: 2, kind: 'repl', mode: 'shell', label: 'Python', language: 'python', spawnArgs: ['-i'] },
      ],
    }),
  })

  assert.equal(runtime.hydrateForWorkspace(), true)
  assert.equal(state.hydratedWorkspacePath, '/workspace/demo')
  assert.equal(state.nextInstanceId, 6)
  assert.equal(state.nextGroupId, 3)
  assert.equal(state.nextMarkerId, 9)
  assert.deepEqual(state.tabOrder, [4, 5])
  assert.equal(state.activeGroupId, 2)
  assert.equal(state.activeInstanceId, 4)
  assert.deepEqual(state.groups, [
    { id: 2, activeInstanceId: 4 },
  ])
  assert.deepEqual(state.instances.map((instance) => ({ id: instance.id, groupId: instance.groupId })), [
    { id: 4, groupId: 2 },
    { id: 5, groupId: 2 },
  ])
  assert.equal(refreshCount, 1)
})

test('terminal hydration runtime creates a base group when no snapshot exists', () => {
  let state = createEmptyState()

  const runtime = createTerminalHydrationRuntime({
    createEmptyState,
    createGroup,
    getWorkspacePath: () => '/workspace/demo',
    getHydratedWorkspacePath: () => state.hydratedWorkspacePath,
    replaceState: (nextState) => {
      state = nextState
    },
    loadTerminalSnapshot: () => null,
  })

  assert.equal(runtime.hydrateForWorkspace(), true)
  assert.equal(state.hydratedWorkspacePath, '/workspace/demo')
  assert.deepEqual(state.groups, [{ id: 1, activeInstanceId: null }])
  assert.equal(state.activeGroupId, 1)
})
