import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceBootstrapRuntime } from '../src/domains/workspace/workspaceBootstrapRuntime.js'

function createState() {
  return {
    path: '/workspace/demo',
    generation: 1,
    workspaceDataDir: '/workspace/.altals',
    instructionsPaths: {
      rootPath: '/workspace/_instructions.md',
      internalPath: '/workspace/.altals/project/instructions.md',
    },
    instructionsUnlisten: null,
  }
}

function createRuntime(state, overrides = {}) {
  return createWorkspaceBootstrapRuntime({
    getPath: () => state.path,
    getCurrentBootstrapGeneration: () => state.generation,
    getWorkspaceDataDir: () => state.workspaceDataDir,
    getInstructionsPaths: () => state.instructionsPaths,
    getInstructionsUnlisten: () => state.instructionsUnlisten,
    setInstructionsUnlisten: (unlisten) => {
      state.instructionsUnlisten = unlisten
    },
    ...overrides,
  })
}

test('workspace bootstrap runtime preserves step order, refreshes instruction listener, and starts auto-commit', async () => {
  const state = createState()
  const calls = []
  const oldListenerClears = []
  const instructionLoads = []
  let fsHandler = null

  state.instructionsUnlisten = () => {
    oldListenerClears.push('old')
  }

  const runtime = createRuntime(state, {
    initWorkspaceDataDir: async () => {
      calls.push('initWorkspaceDataDir')
    },
    initProjectDir: async () => {
      calls.push('initProjectDir')
    },
    installEditHooks: async () => {
      calls.push('installEditHooks')
    },
    loadSettings: async () => {
      calls.push('loadSettings')
    },
    loadInstructions: async () => {
      instructionLoads.push('loadInstructions')
    },
    canAutoCommit: async (path) => {
      calls.push(['canAutoCommit', path])
      return true
    },
    startAutoCommit: async () => {
      calls.push('startAutoCommit')
    },
    loadWorkspaceUsage: (isStale) => {
      calls.push(['loadWorkspaceUsage', isStale()])
    },
    watchDirectory: async (payload) => {
      calls.push(['watchDirectory', payload])
    },
    listenToFsChange: async (handler) => {
      fsHandler = handler
      calls.push('listenToFsChange')
      return () => {
        calls.push('newUnlisten')
      }
    },
    logWorkspaceBootstrapWarning: () => {
      calls.push('warning')
    },
  })

  await runtime.bootstrapWorkspace('/workspace/demo', 1)
  assert.deepEqual(calls, [
    'initWorkspaceDataDir',
    'initProjectDir',
    'installEditHooks',
    'loadSettings',
    ['watchDirectory', {
      paths: ['/workspace/demo', '/workspace/.altals'],
      recursivePaths: ['/workspace/.altals'],
    }],
    'listenToFsChange',
    ['loadWorkspaceUsage', false],
    ['canAutoCommit', '/workspace/demo'],
    'startAutoCommit',
  ])
  assert.deepEqual(oldListenerClears, ['old'])
  assert.equal(typeof state.instructionsUnlisten, 'function')

  await fsHandler({
    payload: {
      paths: ['/workspace/.altals/project/instructions.md'],
    },
  })
  assert.deepEqual(instructionLoads, ['loadInstructions'])

  assert.equal(runtime.clearInstructionsWatcher(), true)
  assert.equal(state.instructionsUnlisten, null)
  assert.deepEqual(calls.slice(-1), ['newUnlisten'])
})

test('workspace bootstrap runtime stops after a stale generation is detected', async () => {
  const state = createState()
  const calls = []

  const runtime = createRuntime(state, {
    initWorkspaceDataDir: async () => {
      calls.push('initWorkspaceDataDir')
      state.generation = 2
    },
    initProjectDir: async () => {
      calls.push('initProjectDir')
    },
    installEditHooks: async () => {
      calls.push('installEditHooks')
    },
    loadSettings: async () => {
      calls.push('loadSettings')
    },
    watchDirectory: async () => {
      calls.push('watchDirectory')
    },
    listenToFsChange: async () => {
      calls.push('listenToFsChange')
      return () => {}
    },
    loadWorkspaceUsage: () => {
      calls.push('loadWorkspaceUsage')
    },
    canAutoCommit: async () => {
      calls.push('canAutoCommit')
      return true
    },
    startAutoCommit: async () => {
      calls.push('startAutoCommit')
    },
    logWorkspaceBootstrapWarning: () => {
      calls.push('warning')
    },
  })

  await runtime.bootstrapWorkspace('/workspace/demo', 1)
  assert.deepEqual(calls, ['initWorkspaceDataDir'])
})

test('workspace bootstrap runtime logs listener failures but still completes usage and auto-commit startup', async () => {
  const state = createState()
  const calls = []
  const warnings = []

  const runtime = createRuntime(state, {
    initWorkspaceDataDir: async () => {
      calls.push('initWorkspaceDataDir')
    },
    initProjectDir: async () => {
      calls.push('initProjectDir')
    },
    installEditHooks: async () => {
      calls.push('installEditHooks')
    },
    loadSettings: async () => {
      calls.push('loadSettings')
    },
    loadInstructions: async () => {
      calls.push('loadInstructions')
    },
    watchDirectory: async () => {
      calls.push('watchDirectory')
    },
    listenToFsChange: async () => {
      throw new Error('listener failed')
    },
    loadWorkspaceUsage: () => {
      calls.push('loadWorkspaceUsage')
    },
    canAutoCommit: async () => {
      calls.push('canAutoCommit')
      return true
    },
    startAutoCommit: async () => {
      calls.push('startAutoCommit')
    },
    logWorkspaceBootstrapWarning: (label, error) => {
      warnings.push({ label, message: error.message })
    },
  })

  await runtime.bootstrapWorkspace('/workspace/demo', 1)
  assert.deepEqual(warnings, [{
    label: 'listen(fs-change)',
    message: 'listener failed',
  }])
  assert.deepEqual(calls, [
    'initWorkspaceDataDir',
    'initProjectDir',
    'installEditHooks',
    'loadSettings',
    'watchDirectory',
    'loadWorkspaceUsage',
    'canAutoCommit',
    'startAutoCommit',
  ])
})
