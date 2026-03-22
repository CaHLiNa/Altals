import test from 'node:test'
import assert from 'node:assert/strict'

import { createReferenceLibraryRuntime } from '../src/domains/reference/referenceLibraryRuntime.js'

function createHarness() {
  const writes = []
  const warnings = []
  const timeouts = []
  const reloads = []
  const unlistenCalls = []
  let fsChangeHandler = null

  const context = {
    projectDir: '/workspace/project',
    globalConfigDir: '/config',
  }

  const runtime = createReferenceLibraryRuntime({
    captureWorkspaceContext: () => context,
    matchesWorkspaceContext: (value) => value?.projectDir === context.projectDir && value?.globalConfigDir === context.globalConfigDir,
    loadLibrary: async () => {
      reloads.push(true)
    },
    getGlobalLibrary: () => [{ _key: 'alpha' }],
    getCollections: () => [{ id: 'c1', name: 'Core' }],
    getSavedViews: () => [{ id: 'v1', name: 'Recent' }],
    getWorkspaceKeys: () => ['alpha'],
    createEmptyGlobalReferenceWorkbench: () => ({ collections: [], savedViews: [] }),
    createEmptyWorkspaceReferenceCollection: () => ({ keys: [] }),
    resolveGlobalReferenceLibraryPath: (globalConfigDir) => `${globalConfigDir}/references.json`,
    resolveGlobalReferenceWorkbenchPath: (globalConfigDir) => `${globalConfigDir}/reference-workbench.json`,
    resolveWorkspaceReferenceCollectionPath: (projectDir) => `${projectDir}/references.collection.json`,
    invoke: async (command, payload) => {
      writes.push({ command, payload })
    },
    listenToFsChange: async (handler) => {
      fsChangeHandler = handler
      return () => {
        unlistenCalls.push(true)
      }
    },
    setTimeoutImpl: (fn, delay) => {
      const id = { fn, delay, cleared: false }
      timeouts.push(id)
      return id
    },
    clearTimeoutImpl: (id) => {
      if (id) id.cleared = true
    },
    warn: (...args) => warnings.push(args),
  })

  return {
    runtime,
    writes,
    warnings,
    timeouts,
    reloads,
    unlistenCalls,
    getFsChangeHandler: () => fsChangeHandler,
  }
}

test('reference library runtime writes global, workbench, and workspace collection files', async () => {
  const harness = createHarness()

  await harness.runtime.writeLibraries()

  assert.equal(harness.writes.length, 3)
  assert.equal(harness.writes[0].payload.path, '/config/references.json')
  assert.equal(harness.writes[1].payload.path, '/config/reference-workbench.json')
  assert.equal(harness.writes[2].payload.path, '/workspace/project/references.collection.json')
})

test('reference library runtime debounces saves and ignores self-write fs events', async () => {
  const harness = createHarness()

  await harness.runtime.saveLibrary()
  assert.equal(harness.timeouts.length, 1)
  assert.equal(harness.timeouts[0].delay, 500)

  harness.timeouts[0].fn()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(harness.writes.length, 3)

  await harness.runtime.startWatching()
  await harness.getFsChangeHandler()({
    payload: {
      paths: ['/config/references.json'],
    },
  })

  assert.equal(harness.reloads.length, 0)
})

test('reference library runtime reloads on external changes and cleanup stops watchers', async () => {
  const harness = createHarness()

  await harness.runtime.startWatching()
  await harness.getFsChangeHandler()({
    payload: {
      paths: ['/workspace/project/references.collection.json'],
    },
  })

  assert.equal(harness.reloads.length, 1)

  harness.runtime.cleanup()
  assert.equal(harness.unlistenCalls.length, 1)
})
