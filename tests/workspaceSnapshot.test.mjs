import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceSnapshotOperations } from '../src/domains/changes/workspaceSnapshot.js'

test('workspace snapshot operations create snapshots through the history-point runtime', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    historyPointRuntime: {
      createHistoryPoint: async (input) => {
        calls.push(input)
        return {
          committed: true,
          snapshot: {
            id: 'git:abc123',
            scope: 'workspace',
            message: 'Draft 3 ready',
          },
        }
      },
    },
  })

  const result = await operations.createWorkspaceSnapshot({
    workspace: { path: '/workspace/demo' },
    filesStore: { id: 'files' },
    editorStore: { id: 'editor' },
    preferredSnapshotLabel: 'Draft 3 ready',
    requestSnapshotLabel: async () => 'ignored',
    t: (value) => value,
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].preferredHistoryLabel, 'Draft 3 ready')
  assert.equal(typeof calls[0].requestHistoryLabel, 'function')
  assert.equal(result?.snapshot?.id, 'git:abc123')
  assert.equal(result?.snapshotMetadata?.snapshotId, 'git:abc123')
  assert.equal(result?.snapshot?.metadata?.scope, 'workspace')
})

test('workspace snapshot operations record workspace save points into the local snapshot store when workspace data is available', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    historyPointRuntime: {
      createHistoryPoint: async () => ({
        committed: true,
        snapshot: {
          id: 'git:abc123',
          backend: 'git',
          sourceKind: 'git-commit',
          sourceId: 'abc123',
          scope: 'workspace',
          kind: 'named',
          label: 'Draft 3 ready',
          message: 'Draft 3 ready',
          rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
          createdAt: '2026-03-22T10:11:00Z',
          manifest: {
            version: 1,
            scope: 'workspace',
            kind: 'named',
          },
        },
      }),
    },
    localSnapshotPayloadRuntime: {
      captureWorkspaceSnapshotPayload: async ({ workspacePath, workspaceDataDir, snapshot }) => {
        calls.push(['payload', workspacePath, workspaceDataDir, snapshot.sourceId])
        return {
          manifestPath: '/workspace/.altals/snapshots/payloads/abc123/manifest.json',
          fileCount: 2,
          capturedAt: '2026-03-22T10:11:30Z',
        }
      },
    },
    localSnapshotStoreRuntime: {
      recordWorkspaceSavePoint: async ({ workspaceDataDir, snapshot }) => {
        calls.push(['record', workspaceDataDir, snapshot.sourceId, snapshot.payload?.fileCount || 0])
        return {
          id: 'local:workspace:abc123',
          backend: 'local',
          sourceKind: 'workspace-save-point',
          sourceId: 'abc123',
          scope: 'workspace',
          filePath: '',
          kind: 'named',
          label: 'Draft 3 ready',
          message: 'Draft 3 ready',
          rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
          createdAt: '2026-03-22T10:11:00Z',
          manifest: {
            version: 1,
            scope: 'workspace',
            kind: 'named',
          },
          payload: snapshot.payload,
        }
      },
    },
  })

  const result = await operations.createWorkspaceSnapshot({
    workspace: {
      path: '/workspace/demo',
      workspaceDataDir: '/workspace/.altals',
    },
  })

  assert.deepEqual(calls, [
    ['payload', '/workspace/demo', '/workspace/.altals', 'abc123'],
    ['record', '/workspace/.altals', 'abc123', 2],
  ])
  assert.equal(result?.snapshot?.id, 'local:workspace:abc123')
  assert.equal(result?.snapshot?.metadata?.backend, 'local')
  assert.equal(result?.snapshot?.metadata?.capabilities?.canRestore, true)
  assert.equal(result?.localSnapshot?.id, 'local:workspace:abc123')
  assert.equal(result?.gitSnapshot?.id, 'git:abc123')
})

test('workspace snapshot operations surface create errors through the failure callback', async () => {
  const errors = []
  let failureCalls = 0
  const operations = createWorkspaceSnapshotOperations({
    historyPointRuntime: {
      createHistoryPoint: async () => {
        throw new Error('commit failed')
      },
    },
    logErrorImpl: (...args) => {
      errors.push(args)
    },
  })

  const result = await operations.createWorkspaceSnapshot({
    workspace: { path: '/workspace/demo' },
    showCommitFailure: () => {
      failureCalls += 1
    },
  })

  assert.equal(result, null)
  assert.equal(failureCalls, 1)
  assert.equal(errors.length, 1)
  assert.equal(errors[0][0], 'Create snapshot error:')
})

test('workspace snapshot operations open file version history only after history availability succeeds', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    availabilityRuntime: {
      ensureWorkspaceHistoryAvailable: async (input) => {
        calls.push(['availability', input.workspacePath, input.options.enableAutoCommit])
        return { ok: true, autoCommitEnabled: true }
      },
    },
  })

  const result = await operations.openFileVersionHistoryBrowser({
    workspace: { path: '/workspace/demo' },
    filePath: '/workspace/demo/draft.md',
    onReady: (filePath) => {
      calls.push(['ready', filePath])
    },
    options: {
      enableAutoCommit: true,
    },
  })

  assert.deepEqual(calls, [
    ['availability', '/workspace/demo', true],
    ['ready', '/workspace/demo/draft.md'],
  ])
  assert.deepEqual(result, {
    historyAvailability: {
      ok: true,
      autoCommitEnabled: true,
    },
    filePath: '/workspace/demo/draft.md',
  })
})

test('workspace snapshot operations delegate explicit file/workspace list and file-preview/restore wrappers to the lower snapshot runtime', async () => {
  const calls = []
  const listFileSnapshots = async (input) => {
    calls.push(['list-file', input.workspacePath, input.filePath || '', input.workspaceDataDir || ''])
    if (input.filePath) {
      return [{ id: 'git:abc123', scope: 'file', message: 'Save: 2026-03-22 10:11' }]
    }
    return []
  }
  const listWorkspaceSnapshots = async (input) => {
    calls.push(['list-workspace', input.workspacePath, input.filePath || '', input.workspaceDataDir || ''])

    return [{
      id: 'git:workspace123',
      scope: 'workspace',
      message: 'Draft 3 ready',
      manifest: {
        version: 1,
        scope: 'workspace',
        kind: 'named',
      },
    }]
  }
  const loadPreview = async (input) => {
    calls.push(['preview', input.snapshot?.sourceId])
    return '# preview'
  }
  const restoreEntry = async (input) => {
    calls.push(['restore', input.snapshot?.sourceId])
    return { restored: true }
  }
  const operations = createWorkspaceSnapshotOperations({
    snapshotRuntime: {
      listFileVersionHistoryEntries: listFileSnapshots,
      listWorkspaceSavePointEntries: listWorkspaceSnapshots,
      loadFileVersionHistoryPreview: loadPreview,
      restoreFileVersionHistoryEntry: restoreEntry,
    },
  })

  const snapshots = await operations.listFileVersionHistory({
    workspacePath: '/workspace/demo',
    filePath: '/workspace/demo/draft.md',
  })
  const workspaceSnapshots = await operations.listWorkspaceSavePoints({
    workspacePath: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
  })
  const preview = await operations.loadFileVersionHistoryPreview({
    workspacePath: '/workspace/demo',
    filePath: '/workspace/demo/draft.md',
    snapshot: { sourceId: 'abc123' },
  })
  const restored = await operations.restoreFileVersionHistoryEntry({
    workspacePath: '/workspace/demo',
    filePath: '/workspace/demo/draft.md',
    snapshot: { sourceId: 'abc123' },
  })

  assert.deepEqual(snapshots, [{
    id: 'git:abc123',
    scope: 'file',
    message: 'Save: 2026-03-22 10:11',
    metadata: {
      snapshotId: 'git:abc123',
      scope: 'file',
      backend: '',
      sourceKind: '',
      kind: '',
      title: 'Save: 2026-03-22 10:11',
      message: 'Save: 2026-03-22 10:11',
      isNamed: false,
      isSystemGenerated: true,
      capabilities: {
        canPreview: true,
        canRestore: true,
        canCopy: true,
      },
      payload: null,
    },
  }])
  assert.deepEqual(workspaceSnapshots, [{
    id: 'git:workspace123',
    scope: 'workspace',
    message: 'Draft 3 ready',
    manifest: {
      version: 1,
      scope: 'workspace',
      kind: 'named',
    },
    metadata: {
      snapshotId: 'git:workspace123',
      scope: 'workspace',
      backend: '',
      sourceKind: '',
      kind: '',
      title: 'Draft 3 ready',
      message: 'Draft 3 ready',
      isNamed: false,
      isSystemGenerated: true,
      capabilities: {
        canPreview: false,
        canRestore: false,
        canCopy: false,
      },
      payload: null,
    },
  }])
  assert.equal(preview, '# preview')
  assert.deepEqual(restored, { restored: true })
  assert.deepEqual(calls, [
    ['list-file', '/workspace/demo', '/workspace/demo/draft.md', ''],
    ['list-workspace', '/workspace/demo', '', '/workspace/.altals'],
    ['preview', 'abc123'],
    ['restore', 'abc123'],
  ])
})

test('workspace snapshot operations restore workspace save points through the local payload runtime without using git history restore', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    localSnapshotPayloadRuntime: {
      restoreWorkspaceSnapshotPayload: async ({ workspacePath, workspaceDataDir, snapshot, applyFileContent }) => {
        calls.push(['restore-payload', workspacePath, workspaceDataDir, snapshot.sourceId])
        const applied = await applyFileContent('/workspace/demo/draft.md', '# Restored draft')
        return {
          restored: applied !== false,
          restoredFiles: ['/workspace/demo/draft.md'],
        }
      },
    },
  })

  const editorUpdates = []
  const result = await operations.restoreWorkspaceSavePoint({
    workspace: {
      path: '/workspace/demo',
      workspaceDataDir: '/workspace/.altals',
    },
    snapshot: {
      sourceId: 'abc123',
      payload: {
        manifestPath: '/workspace/.altals/snapshots/payloads/abc123/manifest.json',
        fileCount: 1,
      },
    },
    filesStore: {
      saveFile: async (path, content) => {
        calls.push(['saveFile', path, content])
        return true
      },
      reloadFile: async (path) => {
        calls.push(['reloadFile', path])
      },
    },
    editorStore: {
      editorViews: {
        'pane-1:/workspace/demo/draft.md': {
          altalsApplyExternalContent: async (content) => {
            editorUpdates.push(content)
          },
        },
      },
      allOpenFiles: new Set(['/workspace/demo/draft.md']),
      clearFileDirty: (path) => {
        calls.push(['clearDirty', path])
      },
    },
  })

  assert.deepEqual(result, {
    restored: true,
    restoredFiles: ['/workspace/demo/draft.md'],
  })
  assert.deepEqual(editorUpdates, ['# Restored draft'])
  assert.deepEqual(calls, [
    ['restore-payload', '/workspace/demo', '/workspace/.altals', 'abc123'],
    ['saveFile', '/workspace/demo/draft.md', '# Restored draft'],
    ['clearDirty', '/workspace/demo/draft.md'],
  ])
})

test('workspace snapshot operations can load workspace save-point payload manifests for the browser surface', async () => {
  const calls = []
  const operations = createWorkspaceSnapshotOperations({
    localSnapshotPayloadRuntime: {
      loadWorkspaceSnapshotPayloadManifest: async ({ workspaceDataDir, snapshot }) => {
        calls.push([workspaceDataDir, snapshot.sourceId])
        return {
          fileCount: 2,
          files: [
            { path: '/workspace/demo/draft.md', relativePath: 'draft.md' },
            { path: '/workspace/demo/notes.md', relativePath: 'notes.md' },
          ],
        }
      },
    },
  })

  const manifest = await operations.loadWorkspaceSavePointPayloadManifest({
    workspace: {
      workspaceDataDir: '/workspace/.altals',
    },
    snapshot: {
      sourceId: 'abc123',
    },
  })

  assert.deepEqual(calls, [['/workspace/.altals', 'abc123']])
  assert.deepEqual(manifest, {
    fileCount: 2,
    files: [
      { path: '/workspace/demo/draft.md', relativePath: 'draft.md' },
      { path: '/workspace/demo/notes.md', relativePath: 'notes.md' },
    ],
  })
})
