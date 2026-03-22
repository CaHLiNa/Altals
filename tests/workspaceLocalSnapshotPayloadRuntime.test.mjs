import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createWorkspaceLocalSnapshotPayloadRuntime,
  createWorkspaceSnapshotPayloadManifest,
  createWorkspaceSnapshotPayloadMeta,
  resolveWorkspaceSnapshotPayloadManifestPath,
} from '../src/domains/changes/workspaceLocalSnapshotPayloadRuntime.js'

test('workspace local snapshot payload runtime resolves the payload manifest path', () => {
  assert.equal(
    resolveWorkspaceSnapshotPayloadManifestPath('/workspace/.altals', {
      sourceId: 'abc123',
    }),
    '/workspace/.altals/snapshots/payloads/abc123/manifest.json',
  )
})

test('workspace local snapshot payload runtime captures a manifest-backed payload for persistable open files', async () => {
  const files = new Map([
    ['/workspace/demo/draft.md', '# Draft 3'],
    ['/workspace/demo/notes.md', 'notes'],
  ])
  const writes = []
  const createDirs = []
  const runtime = createWorkspaceLocalSnapshotPayloadRuntime({
    readFileImpl: async (path) => {
      if (!files.has(path)) {
        throw new Error('missing')
      }
      return files.get(path)
    },
    writeFileImpl: async (path, content) => {
      writes.push([path, content])
      files.set(path, content)
    },
    createDirImpl: async (path) => {
      createDirs.push(path)
    },
  })

  const payload = await runtime.captureWorkspaceSnapshotPayload({
    workspacePath: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
    snapshot: {
      sourceId: 'abc123',
      createdAt: '2026-03-22T10:11:00Z',
      message: 'Draft 3 ready',
    },
    editorStore: {
      allOpenFiles: new Set([
        '/workspace/demo/draft.md',
        '/workspace/demo/notes.md',
        'preview:/workspace/demo/draft.pdf',
      ]),
    },
    filesStore: {
      fileContents: {},
    },
  })

  assert.deepEqual(createDirs, [
    '/workspace/.altals/snapshots/payloads/abc123',
    '/workspace/.altals/snapshots/payloads/abc123/files',
  ])
  assert.deepEqual(payload, {
    version: 1,
    kind: 'workspace-text-v1',
    manifestPath: '/workspace/.altals/snapshots/payloads/abc123/manifest.json',
    fileCount: 2,
    capturedAt: payload.capturedAt,
  })
  assert.ok(typeof payload.capturedAt === 'string' && payload.capturedAt.length > 0)

  const manifest = JSON.parse(files.get('/workspace/.altals/snapshots/payloads/abc123/manifest.json'))
  assert.deepEqual(manifest, createWorkspaceSnapshotPayloadManifest({
    workspacePath: '/workspace/demo',
    snapshot: {
      sourceId: 'abc123',
      createdAt: '2026-03-22T10:11:00Z',
      message: 'Draft 3 ready',
    },
    payload,
    files: [
      {
        path: '/workspace/demo/draft.md',
        relativePath: 'draft.md',
        contentPath: 'files/0.txt',
      },
      {
        path: '/workspace/demo/notes.md',
        relativePath: 'notes.md',
        contentPath: 'files/1.txt',
      },
    ],
  }))
  assert.equal(files.get('/workspace/.altals/snapshots/payloads/abc123/files/0.txt'), '# Draft 3')
  assert.equal(files.get('/workspace/.altals/snapshots/payloads/abc123/files/1.txt'), 'notes')
})

test('workspace local snapshot payload runtime restores captured file contents through the injected apply function', async () => {
  const files = new Map()
  const manifestPath = '/workspace/.altals/snapshots/payloads/abc123/manifest.json'
  files.set(manifestPath, JSON.stringify({
    version: 1,
    kind: 'workspace-text-v1',
    workspacePath: '/workspace/demo',
    snapshot: {
      sourceId: 'abc123',
      createdAt: '2026-03-22T10:11:00Z',
      message: 'Draft 3 ready',
    },
    capturedAt: '2026-03-22T10:11:30Z',
    fileCount: 1,
    files: [{
      path: '/workspace/demo/draft.md',
      relativePath: 'draft.md',
      contentPath: 'files/0.txt',
    }],
  }))
  files.set('/workspace/.altals/snapshots/payloads/abc123/files/0.txt', '# Restored')

  const restored = []
  const runtime = createWorkspaceLocalSnapshotPayloadRuntime({
    readFileImpl: async (path) => {
      if (!files.has(path)) {
        throw new Error('missing')
      }
      return files.get(path)
    },
  })

  const result = await runtime.restoreWorkspaceSnapshotPayload({
    workspacePath: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
    snapshot: {
      sourceId: 'abc123',
      payload: createWorkspaceSnapshotPayloadMeta({
        manifestPath,
        fileCount: 1,
        capturedAt: '2026-03-22T10:11:30Z',
      }),
    },
    applyFileContent: async (path, content) => {
      restored.push([path, content])
      return true
    },
  })

  assert.deepEqual(restored, [['/workspace/demo/draft.md', '# Restored']])
  assert.equal(result.restored, true)
  assert.deepEqual(result.restoredFiles, ['/workspace/demo/draft.md'])
})
