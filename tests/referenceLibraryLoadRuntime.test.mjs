import test from 'node:test'
import assert from 'node:assert/strict'

import { createReferenceLibraryLoadRuntime } from '../src/domains/reference/referenceLibraryLoadRuntime.js'

function createHarness() {
  const state = {
    workspacePath: '/workspace',
    projectDir: '/workspace/project',
    globalConfigDir: '/config',
    loadGeneration: 0,
    globalLibrary: [],
    globalKeyMap: {},
    collections: [],
    savedViews: [],
    library: [],
    workspaceKeys: [],
    keyMap: {},
    activeKey: 'missing',
    libraryDetailMode: 'edit',
    citationStyle: 'apa',
    initialized: false,
    loading: false,
  }
  const watchContexts = []

  const runtime = createReferenceLibraryLoadRuntime({
    getWorkspacePath: () => state.workspacePath,
    getProjectDir: () => state.projectDir,
    getGlobalConfigDir: () => state.globalConfigDir,
    getLoadGeneration: () => state.loadGeneration,
    setLoadGeneration: (value) => {
      state.loadGeneration = value
    },
    getGlobalLibrary: () => state.globalLibrary,
    getActiveKey: () => state.activeKey,
    setLoading: (value) => {
      state.loading = value
    },
    setGlobalLibrary: (value) => {
      state.globalLibrary = value
    },
    setGlobalKeyMap: (value) => {
      state.globalKeyMap = value
    },
    setCollections: (value) => {
      state.collections = value
    },
    setSavedViews: (value) => {
      state.savedViews = value
    },
    setLibrary: (value) => {
      state.library = value
    },
    setWorkspaceKeys: (value) => {
      state.workspaceKeys = value
    },
    setKeyMap: (value) => {
      state.keyMap = value
    },
    setActiveKey: (value) => {
      state.activeKey = value
    },
    setLibraryDetailMode: (value) => {
      state.libraryDetailMode = value
    },
    setCitationStyle: (value) => {
      state.citationStyle = value
    },
    setInitialized: (value) => {
      state.initialized = value
    },
    ensureReferenceStorageReady: async () => {},
    readJsonArray: async () => [
      { _key: 'alpha', title: 'Alpha', _collections: ['c1', 'missing'] },
      { _key: 'beta', title: 'Beta' },
    ],
    readWorkspaceReferenceCollection: async () => ({ keys: ['alpha'] }),
    readFileIfExists: async () => JSON.stringify({
      collections: [{ id: 'c1', name: 'Core' }],
      savedViews: [{ id: 'v1', name: 'Recent' }],
    }),
    parseGlobalReferenceWorkbench: (text) => JSON.parse(text),
    sanitizeReferenceWorkbenchState: (value) => value,
    migrateLegacyWorkspaceData: async (_context, { globalLibrary, workspaceKeys }) => ({
      globalLibrary,
      workspaceKeys,
      didChange: false,
      legacyLibraryFound: false,
    }),
    sanitizeReferenceRecord: (value) => ({ ...value }),
    referenceKey: (ref) => ref?._key || null,
    buildKeyMapFromList: (list) => Object.fromEntries(list.map((ref, index) => [ref._key, index])),
    buildWorkspaceLibrary: (globalLibrary, globalKeyMap, workspaceKeys) => ({
      library: workspaceKeys.map((key) => globalLibrary[globalKeyMap[key]]).filter(Boolean),
      keys: workspaceKeys,
    }),
    writeLibraries: async () => {},
    deleteLegacyWorkspaceReferenceLibrary: async () => {},
    loadPersistedCitationStyle: async () => 'mla',
    loadReferenceUserStyles: async () => {},
    startWatching: async (context) => {
      watchContexts.push(context)
    },
  })

  return {
    runtime,
    state,
    watchContexts,
  }
}

test('reference library load runtime hydrates state and starts watching', async () => {
  const harness = createHarness()

  await harness.runtime.loadLibrary()

  assert.equal(harness.state.loading, false)
  assert.equal(harness.state.initialized, true)
  assert.equal(harness.state.citationStyle, 'mla')
  assert.deepEqual(harness.state.globalLibrary.map((ref) => ref._key), ['alpha', 'beta'])
  assert.deepEqual(harness.state.library.map((ref) => ref._key), ['alpha'])
  assert.deepEqual(harness.state.collections, [{ id: 'c1', name: 'Core' }])
  assert.deepEqual(harness.watchContexts[0], {
    workspacePath: '/workspace',
    projectDir: '/workspace/project',
    globalConfigDir: '/config',
    generation: 1,
  })
  assert.equal(harness.state.activeKey, null)
  assert.equal(harness.state.libraryDetailMode, 'browse')
  assert.deepEqual(harness.state.globalLibrary[0]._collections, ['c1'])
})

test('reference library load runtime exposes workspace context and stale generation guards', () => {
  const harness = createHarness()

  const context = harness.runtime.beginLoadContext()
  assert.equal(context.generation, 1)
  assert.equal(harness.runtime.isLoadStale(context), false)

  harness.state.loadGeneration = 2
  assert.equal(harness.runtime.isLoadStale(context), true)
})

test('reference library load runtime ignores invalid workspace contexts', async () => {
  const harness = createHarness()
  harness.state.projectDir = ''

  assert.equal(harness.runtime.beginLoadContext(), null)
  await harness.runtime.loadLibrary()

  assert.equal(harness.state.initialized, false)
  assert.equal(harness.watchContexts.length, 0)
})
