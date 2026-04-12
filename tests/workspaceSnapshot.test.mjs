import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceSnapshotOperations } from '../src/domains/changes/workspaceSnapshot.js'

test('workspace snapshot operations create local workspace save points with payload metadata', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    historyPreparationRuntime: {
      prepareWorkspaceHistoryFiles: async ({ filesStore, editorStore }) => {
        calls.push(['prepare', filesStore.id, editorStore.id])
        return { ok: true }
      },
    },
    localSnapshotPayloadRuntime: {
      captureWorkspaceSnapshotPayload: async ({ workspacePath, workspaceDataDir, snapshot }) => {
        calls.push(['payload', workspacePath, workspaceDataDir, snapshot.kind, snapshot.message])
        return {
          manifestPath: '/workspace/.altals/snapshots/payloads/workspace123/manifest.json',
          fileCount: 2,
          skippedCount: 1,
          capturedAt: '2026-03-22T10:11:30Z',
          captureScope: 'project-text-set',
        }
      },
    },
    localSnapshotStoreRuntime: {
      recordWorkspaceSavePoint: async ({ workspaceDataDir, snapshot }) => {
        calls.push(['record', workspaceDataDir, snapshot.kind, snapshot.label, snapshot.message])
        return {
          id: 'local:workspace:workspace123',
          backend: 'local',
          sourceKind: 'workspace-save-point',
          sourceId: '',
          scope: 'workspace',
          filePath: '',
          kind: snapshot.kind,
          label: snapshot.label,
          message: snapshot.message,
          rawMessage: snapshot.rawMessage,
          createdAt: snapshot.createdAt,
          manifest: snapshot.manifest,
          payload: snapshot.payload,
        }
      },
    },
    nowImpl: () => new Date('2026-03-22T10:11:00Z'),
  })

  const result = await operations.createWorkspaceSnapshot({
    workspace: {
      path: '/workspace/demo',
      workspaceDataDir: '/workspace/.altals',
    },
    filesStore: { id: 'files' },
    editorStore: { id: 'editor' },
    preferredSnapshotLabel: 'Draft 3 ready',
    t: (value) => value,
  })

  assert.deepEqual(calls, [
    ['prepare', 'files', 'editor'],
    ['payload', '/workspace/demo', '/workspace/.altals', 'named', 'Draft 3 ready'],
    ['record', '/workspace/.altals', 'named', 'Draft 3 ready', 'Draft 3 ready'],
  ])
  assert.equal(result?.reason, 'created-save-point')
  assert.equal(result?.snapshot?.id, 'local:workspace:workspace123')
  assert.equal(result?.snapshotMetadata?.backend, 'local')
  assert.equal(result?.snapshotMetadata?.capabilities?.canRestore, true)
})

test('workspace snapshot operations return preparation failures before saving', async () => {
  const operations = createWorkspaceSnapshotOperations({
    historyPreparationRuntime: {
      prepareWorkspaceHistoryFiles: async () => ({ ok: false, reason: 'prepare-failed' }),
    },
  })

  const result = await operations.createWorkspaceSnapshot({
    workspace: { path: '/workspace/demo', workspaceDataDir: '/workspace/.altals' },
  })

  assert.deepEqual(result, {
    committed: false,
    reason: 'prepare-failed',
  })
})

test('workspace snapshot operations surface save failures through the failure callback', async () => {
  const errors = []
  let failureCalls = 0
  const operations = createWorkspaceSnapshotOperations({
    historyPreparationRuntime: {
      prepareWorkspaceHistoryFiles: async () => {
        throw new Error('save failed')
      },
    },
    logErrorImpl: (...args) => {
      errors.push(args)
    },
  })

  const result = await operations.createWorkspaceSnapshot({
    workspace: { path: '/workspace/demo', workspaceDataDir: '/workspace/.altals' },
    showSaveFailure: () => {
      failureCalls += 1
    },
  })

  assert.equal(result, null)
  assert.equal(failureCalls, 1)
  assert.equal(errors.length, 1)
  assert.equal(errors[0][0], 'Create snapshot error:')
})

test('workspace snapshot operations list and delete workspace save points through local storage and visibility state', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    snapshotRuntime: {
      listWorkspaceSavePointEntries: async ({ workspacePath, workspaceDataDir, limit }) => {
        calls.push(['list', workspacePath, workspaceDataDir, limit])
        return [
          {
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
            createdAt: '2026-03-22T10:13:00Z',
            manifest: {
              version: 1,
              scope: 'workspace',
              kind: 'named',
            },
          },
        ]
      },
    },
    localSnapshotStoreRuntime: {
      removeWorkspaceSavePoint: async ({ workspaceDataDir, snapshot }) => {
        calls.push(['remove', workspaceDataDir, snapshot.sourceId])
        return true
      },
    },
    historyVisibilityRuntime: {
      hideHistoryEntry: async ({ workspaceDataDir, snapshot }) => {
        calls.push(['hide', workspaceDataDir, snapshot.scope, snapshot.sourceId])
        return { key: 'hidden' }
      },
    },
  })

  const listed = await operations.listWorkspaceSavePoints({
    workspacePath: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
    limit: 20,
  })
  const deleted = await operations.deleteWorkspaceSavePoint({
    workspace: { workspaceDataDir: '/workspace/.altals' },
    snapshot: listed[0],
  })

  assert.equal(listed.length, 1)
  assert.equal(listed[0].metadata.snapshotId, 'local:workspace:workspace123')
  assert.deepEqual(deleted, {
    deleted: true,
    removedLocalEntry: true,
    hiddenEntry: true,
    reason: '',
  })
  assert.deepEqual(calls, [
    ['list', '/workspace/demo', '/workspace/.altals', 20],
    ['remove', '/workspace/.altals', 'workspace123'],
    ['hide', '/workspace/.altals', 'workspace', 'workspace123'],
  ])
})

test('workspace snapshot operations delegate payload and preview wrappers to the lower runtimes', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    localSnapshotPayloadRuntime: {
      loadWorkspaceSnapshotPayloadManifest: async ({ workspaceDataDir, snapshot }) => {
        calls.push(['manifest', workspaceDataDir, snapshot.sourceId])
        return { files: [{ path: '/workspace/demo/draft.md' }] }
      },
    },
    previewRuntime: {
      loadWorkspaceSnapshotPreviewSummary: async ({ workspacePath, workspaceDataDir, snapshot }) => {
        calls.push(['summary', workspacePath, workspaceDataDir, snapshot.sourceId])
        return { entries: [{ path: '/workspace/demo/draft.md', status: 'modified' }] }
      },
    },
    diffRuntime: {
      loadWorkspaceSnapshotFilePreview: async ({ workspacePath, workspaceDataDir, snapshot, filePath }) => {
        calls.push(['preview', workspacePath, workspaceDataDir, snapshot.sourceId, filePath])
        return { status: 'modified', file: { path: filePath } }
      },
    },
  })

  const workspace = {
    path: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
  }
  const snapshot = {
    sourceId: 'workspace123',
    payload: {
      manifestPath: '/workspace/.altals/snapshots/payloads/workspace123/manifest.json',
      fileCount: 1,
      skippedCount: 0,
      capturedAt: '2026-03-22T10:13:10Z',
      captureScope: 'project-text-set',
    },
  }

  const manifest = await operations.loadWorkspaceSavePointPayloadManifest({ workspace, snapshot })
  const summary = await operations.loadWorkspaceSavePointPreviewSummary({
    workspace,
    snapshot,
    filesStore: {},
    editorStore: {},
  })
  const preview = await operations.loadWorkspaceSavePointFilePreview({
    workspace,
    snapshot,
    filePath: '/workspace/demo/draft.md',
  })

  assert.deepEqual(manifest, { files: [{ path: '/workspace/demo/draft.md' }] })
  assert.deepEqual(summary, { entries: [{ path: '/workspace/demo/draft.md', status: 'modified' }] })
  assert.deepEqual(preview, {
    status: 'modified',
    file: { path: '/workspace/demo/draft.md' },
  })
  assert.deepEqual(calls, [
    ['manifest', '/workspace/.altals', 'workspace123'],
    ['summary', '/workspace/demo', '/workspace/.altals', 'workspace123'],
    ['preview', '/workspace/demo', '/workspace/.altals', 'workspace123', '/workspace/demo/draft.md'],
  ])
})

test('workspace snapshot operations restore, apply, and remove files through local runtimes', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    localSnapshotPayloadRuntime: {
      restoreWorkspaceSnapshotPayload: async ({
        workspacePath,
        workspaceDataDir,
        snapshot,
        targetPaths,
        applyFileContent,
      }) => {
        calls.push(['restore-payload', workspacePath, workspaceDataDir, snapshot.sourceId, targetPaths])
        await applyFileContent('/workspace/demo/draft.md', '# Restored draft')
        return {
          restored: true,
          restoredFiles: ['/workspace/demo/draft.md'],
          manifest: { id: 'manifest' },
        }
      },
    },
    fileApplyRuntime: {
      applyWorkspaceSnapshotFileContent: async ({ filePath, content }) => {
        calls.push(['apply-file', filePath, content])
        return true
      },
    },
    deletionRuntime: {
      removeWorkspaceSnapshotAddedFiles: async ({
        workspacePath,
        workspaceDataDir,
        snapshot,
        targetPaths,
      }) => {
        calls.push(['remove-added', workspacePath, workspaceDataDir, snapshot.sourceId, targetPaths])
        return {
          removed: true,
          removedFiles: ['/workspace/demo/notes.md'],
          manifest: { id: 'manifest' },
        }
      },
    },
  })

  const workspace = {
    path: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
  }
  const snapshot = {
    sourceId: 'workspace123',
    payload: {
      manifestPath: '/workspace/.altals/snapshots/payloads/workspace123/manifest.json',
      fileCount: 1,
      skippedCount: 0,
      capturedAt: '2026-03-22T10:13:10Z',
      captureScope: 'project-text-set',
    },
  }

  const restored = await operations.restoreWorkspaceSavePoint({
    workspace,
    filesStore: {},
    editorStore: {},
    snapshot,
    removeAddedFiles: true,
  })
  const restoredFile = await operations.restoreWorkspaceSavePointFile({
    workspace,
    filesStore: {},
    editorStore: {},
    snapshot,
    filePath: '/workspace/demo/draft.md',
  })
  const applied = await operations.applyWorkspaceSavePointFilePreviewContent({
    workspace,
    filesStore: {},
    editorStore: {},
    snapshot,
    filePath: '/workspace/demo/draft.md',
    content: '# Merged draft',
  })
  const removed = await operations.removeWorkspaceSavePointAddedFile({
    workspace,
    filesStore: {},
    editorStore: {},
    snapshot,
    filePath: '/workspace/demo/notes.md',
  })

  assert.deepEqual(restored, {
    restored: true,
    restoredFiles: ['/workspace/demo/draft.md'],
    removedFiles: ['/workspace/demo/notes.md'],
    manifest: { id: 'manifest' },
  })
  assert.deepEqual(restoredFile, {
    restored: true,
    restoredFiles: ['/workspace/demo/draft.md'],
    removedFiles: [],
    manifest: { id: 'manifest' },
  })
  assert.deepEqual(applied, {
    applied: true,
    reason: '',
    filePath: '/workspace/demo/draft.md',
  })
  assert.deepEqual(removed, {
    removed: true,
    removedFiles: ['/workspace/demo/notes.md'],
    manifest: { id: 'manifest' },
  })
  assert.deepEqual(calls, [
    ['restore-payload', '/workspace/demo', '/workspace/.altals', 'workspace123', []],
    ['apply-file', '/workspace/demo/draft.md', '# Restored draft'],
    ['remove-added', '/workspace/demo', '/workspace/.altals', 'workspace123', undefined],
    ['restore-payload', '/workspace/demo', '/workspace/.altals', 'workspace123', ['/workspace/demo/draft.md']],
    ['apply-file', '/workspace/demo/draft.md', '# Restored draft'],
    ['apply-file', '/workspace/demo/draft.md', '# Merged draft'],
    ['remove-added', '/workspace/demo', '/workspace/.altals', 'workspace123', ['/workspace/demo/notes.md']],
  ])
})
