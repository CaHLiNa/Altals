import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createLocalWorkspaceSavePointRecord,
  createWorkspaceLocalSnapshotStoreRuntime,
  mergeWorkspaceSavePointEntries,
  resolveWorkspaceSavePointIndexPath,
} from '../src/domains/changes/workspaceLocalSnapshotStoreRuntime.js'

test('workspace local snapshot store resolves the workspace save-point index path', () => {
  assert.equal(
    resolveWorkspaceSavePointIndexPath('/workspace/.altals'),
    '/workspace/.altals/snapshots/workspace-save-points.json'
  )
})

test('workspace local snapshot store records and reloads workspace save points from the local index', async () => {
  const files = new Map()
  const createDirCalls = []
  const runtime = createWorkspaceLocalSnapshotStoreRuntime({
    readFileImpl: async (path) => {
      if (!files.has(path)) {
        throw new Error('missing')
      }
      return files.get(path)
    },
    writeFileImpl: async (path, content) => {
      files.set(path, content)
    },
    createDirImpl: async (path) => {
      createDirCalls.push(path)
    },
  })

  const recorded = await runtime.recordWorkspaceSavePoint({
    workspaceDataDir: '/workspace/.altals',
    snapshot: {
      sourceId: 'workspace123',
      scope: 'workspace',
      kind: 'named',
      label: 'Draft 3 ready',
      message: 'Draft 3 ready',
      rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
      createdAt: '2026-03-22T10:13:00Z',
      manifest: {
        version: 1,
        scope: 'workspace',
        kind: 'named',
      },
    },
  })

  const loaded = await runtime.loadWorkspaceSavePointEntries({
    workspaceDataDir: '/workspace/.altals',
  })

  assert.deepEqual(createDirCalls, ['/workspace/.altals/snapshots'])
  assert.deepEqual(recorded, {
    id: 'local:workspace:workspace123',
    backend: 'local',
    sourceKind: 'workspace-save-point',
    sourceId: 'workspace123',
    scope: 'workspace',
    filePath: '',
    kind: 'named',
    label: 'Draft 3 ready',
    message: 'Draft 3 ready',
    rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
    createdAt: '2026-03-22T10:13:00.000Z',
    manifest: {
      version: 1,
      scope: 'workspace',
      kind: 'named',
    },
    payload: null,
  })
  assert.deepEqual(loaded, [recorded])
})

test('workspace local snapshot store keeps only workspace-scoped save points and prefers local entries over duplicate incoming fallbacks', () => {
  assert.equal(
    createLocalWorkspaceSavePointRecord({
      snapshot: {
        scope: 'file',
        sourceId: 'file123',
      },
    }),
    null
  )

  const localEntry = createLocalWorkspaceSavePointRecord({
    snapshot: {
      scope: 'workspace',
      sourceId: 'workspace123',
      kind: 'named',
      label: 'Draft 3 ready',
      message: 'Draft 3 ready',
      createdAt: '2026-03-22T10:13:00Z',
      manifest: {
        version: 1,
        scope: 'workspace',
        kind: 'named',
      },
    },
  })
  const merged = mergeWorkspaceSavePointEntries({
    localEntries: [localEntry],
    incomingEntries: [
      {
        id: 'imported:workspace123',
        backend: 'imported',
        sourceKind: 'workspace-save-point',
        sourceId: 'workspace123',
        scope: 'workspace',
        filePath: '',
        kind: 'named',
        label: 'Draft 3 ready',
        message: 'Draft 3 ready',
        rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
        createdAt: '2026-03-22T10:13:00Z',
        manifest: {
          version: 1,
          scope: 'workspace',
          kind: 'named',
        },
      },
      {
        id: 'imported:workspace456',
        backend: 'imported',
        sourceKind: 'workspace-save-point',
        sourceId: 'workspace456',
        scope: 'workspace',
        filePath: '',
        kind: 'named',
        label: 'Draft 2 ready',
        message: 'Draft 2 ready',
        rawMessage: 'Draft 2 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
        createdAt: '2026-03-22T10:12:00Z',
        manifest: {
          version: 1,
          scope: 'workspace',
          kind: 'named',
        },
      },
    ],
  })

  assert.deepEqual(merged, [
    localEntry,
    {
      id: 'imported:workspace456',
      backend: 'imported',
      sourceKind: 'workspace-save-point',
      sourceId: 'workspace456',
      scope: 'workspace',
      filePath: '',
      kind: 'named',
      label: 'Draft 2 ready',
      message: 'Draft 2 ready',
      rawMessage: 'Draft 2 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
      createdAt: '2026-03-22T10:12:00Z',
      manifest: {
        version: 1,
        scope: 'workspace',
        kind: 'named',
      },
    },
  ])
})

test('workspace local snapshot store can backfill manifest-backed save points into the local index', async () => {
  const files = new Map()
  const runtime = createWorkspaceLocalSnapshotStoreRuntime({
    readFileImpl: async (path) => {
      if (!files.has(path)) {
        throw new Error('missing')
      }
      return files.get(path)
    },
    writeFileImpl: async (path, content) => {
      files.set(path, content)
    },
    createDirImpl: async () => {},
  })

  const synced = await runtime.syncWorkspaceSavePointEntries({
    workspaceDataDir: '/workspace/.altals',
    snapshots: [
      {
        id: 'imported:workspace456',
        backend: 'imported',
        sourceKind: 'workspace-save-point',
        sourceId: 'workspace456',
        scope: 'workspace',
        filePath: '',
        kind: 'named',
        label: 'Draft 2 ready',
        message: 'Draft 2 ready',
        rawMessage: 'Draft 2 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
        createdAt: '2026-03-22T10:12:00Z',
        manifest: {
          version: 1,
          scope: 'workspace',
          kind: 'named',
        },
      },
    ],
  })

  assert.deepEqual(synced, [
    {
      id: 'local:workspace:workspace456',
      backend: 'local',
      sourceKind: 'workspace-save-point',
      sourceId: 'workspace456',
      scope: 'workspace',
      filePath: '',
      kind: 'named',
      label: 'Draft 2 ready',
      message: 'Draft 2 ready',
      rawMessage: 'Draft 2 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
      createdAt: '2026-03-22T10:12:00.000Z',
      manifest: {
        version: 1,
        scope: 'workspace',
        kind: 'named',
      },
      payload: null,
    },
  ])
})

test('workspace local snapshot store can remove an existing local save point', async () => {
  const files = new Map()
  const runtime = createWorkspaceLocalSnapshotStoreRuntime({
    readFileImpl: async (path) => {
      if (!files.has(path)) {
        throw new Error('missing')
      }
      return files.get(path)
    },
    writeFileImpl: async (path, content) => {
      files.set(path, content)
    },
    createDirImpl: async () => {},
  })

  await runtime.recordWorkspaceSavePoint({
    workspaceDataDir: '/workspace/.altals',
    snapshot: {
      sourceId: 'workspace123',
      scope: 'workspace',
      kind: 'named',
      label: 'Draft 3 ready',
      message: 'Draft 3 ready',
      rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
      createdAt: '2026-03-22T10:13:00Z',
      manifest: {
        version: 1,
        scope: 'workspace',
        kind: 'named',
      },
    },
  })

  const removed = await runtime.removeWorkspaceSavePoint({
    workspaceDataDir: '/workspace/.altals',
    snapshot: {
      sourceId: 'workspace123',
      scope: 'workspace',
      message: 'Draft 3 ready',
      createdAt: '2026-03-22T10:13:00Z',
    },
  })
  const loaded = await runtime.loadWorkspaceSavePointEntries({
    workspaceDataDir: '/workspace/.altals',
  })

  assert.equal(removed, true)
  assert.deepEqual(loaded, [])
})
