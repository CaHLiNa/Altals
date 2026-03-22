import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachWorkspaceSnapshotMetadata,
  attachWorkspaceSnapshotMetadataList,
  createWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotCapabilities,
  getWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotTitle,
} from '../src/domains/changes/workspaceSnapshotMetadataRuntime.js'

test('workspace snapshot metadata runtime derives titles and capabilities from snapshot records', () => {
  const namedSnapshot = {
    id: 'git:abc123',
    backend: 'git',
    sourceKind: 'git-commit',
    sourceId: 'abc123',
    scope: 'file',
    filePath: '/workspace/demo/draft.md',
    kind: 'named',
    label: 'Draft 3 ready',
    message: 'Draft 3 ready',
    createdAt: '2026-03-22T10:11:00Z',
  }
  const workspaceSnapshot = {
    id: 'git:def456',
    backend: 'git',
    sourceKind: 'git-commit',
    sourceId: 'def456',
    scope: 'workspace',
    filePath: '',
    kind: 'save',
    label: '',
    message: 'Save: 2026-03-22 10:12',
    createdAt: '2026-03-22T10:12:00Z',
  }
  const restorableWorkspaceSnapshot = {
    id: 'local:workspace:payload123',
    backend: 'local',
    sourceKind: 'workspace-save-point',
    sourceId: 'payload123',
    scope: 'workspace',
    filePath: '',
    kind: 'named',
    label: 'Draft 4 ready',
    message: 'Draft 4 ready',
    createdAt: '2026-03-22T10:13:00Z',
    payload: {
      manifestPath: '/workspace/.altals/snapshots/payloads/payload123/manifest.json',
      fileCount: 2,
      capturedAt: '2026-03-22T10:13:10Z',
    },
  }

  assert.equal(getWorkspaceSnapshotTitle(namedSnapshot), 'Draft 3 ready')
  assert.deepEqual(getWorkspaceSnapshotCapabilities(namedSnapshot), {
    canPreview: true,
    canRestore: true,
    canCopy: true,
  })
  assert.deepEqual(createWorkspaceSnapshotMetadata({ snapshot: namedSnapshot }), {
    snapshotId: 'git:abc123',
    scope: 'file',
    backend: 'git',
    sourceKind: 'git-commit',
    kind: 'named',
    title: 'Draft 3 ready',
    message: 'Draft 3 ready',
    isNamed: true,
    isSystemGenerated: false,
    capabilities: {
      canPreview: true,
      canRestore: true,
      canCopy: true,
    },
    payload: null,
  })

  assert.equal(getWorkspaceSnapshotTitle(workspaceSnapshot), 'Save: 2026-03-22 10:12')
  assert.deepEqual(getWorkspaceSnapshotCapabilities(workspaceSnapshot), {
    canPreview: false,
    canRestore: false,
    canCopy: false,
  })
  assert.deepEqual(getWorkspaceSnapshotCapabilities(restorableWorkspaceSnapshot), {
    canPreview: false,
    canRestore: true,
    canCopy: false,
  })
  assert.deepEqual(createWorkspaceSnapshotMetadata({ snapshot: restorableWorkspaceSnapshot }).payload, {
    version: 1,
    kind: 'workspace-text-v1',
    manifestPath: '/workspace/.altals/snapshots/payloads/payload123/manifest.json',
    fileCount: 2,
    capturedAt: '2026-03-22T10:13:10.000Z',
  })
})

test('workspace snapshot metadata runtime attaches metadata and reuses matching attached metadata', () => {
  const snapshot = {
    id: 'git:abc123',
    backend: 'git',
    sourceKind: 'git-commit',
    sourceId: 'abc123',
    scope: 'file',
    filePath: '/workspace/demo/draft.md',
    kind: 'save',
    label: '',
    message: 'Save: 2026-03-22 10:11',
    createdAt: '2026-03-22T10:11:00Z',
  }

  const attached = attachWorkspaceSnapshotMetadata(snapshot)
  assert.equal(attached.metadata.snapshotId, 'git:abc123')
  assert.deepEqual(attachWorkspaceSnapshotMetadataList([snapshot]), [attached])
  assert.equal(getWorkspaceSnapshotMetadata(attached), attached.metadata)
  assert.equal(attached.metadata.payload, null)
})
