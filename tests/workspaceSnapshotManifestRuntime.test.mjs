import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWorkspaceSnapshotManifestTrailer,
  buildWorkspaceSnapshotPersistedMessage,
  createWorkspaceSnapshotManifest,
  parseWorkspaceSnapshotPersistedMessage,
} from '../src/domains/changes/workspaceSnapshotManifestRuntime.js'

test('workspace snapshot manifest runtime builds and parses persisted snapshot messages', () => {
  assert.deepEqual(createWorkspaceSnapshotManifest({
    scope: 'workspace',
    kind: 'named',
  }), {
    version: 1,
    scope: 'workspace',
    kind: 'named',
  })

  assert.equal(
    buildWorkspaceSnapshotManifestTrailer({
      scope: 'workspace',
      kind: 'named',
    }),
    ' [[altals-snapshot:v=1;scope=workspace;kind=named]]',
  )

  const rawMessage = buildWorkspaceSnapshotPersistedMessage({
    message: 'Draft 3 ready',
    scope: 'workspace',
    kind: 'named',
  })

  assert.equal(
    rawMessage,
    'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
  )
  assert.deepEqual(parseWorkspaceSnapshotPersistedMessage(rawMessage), {
    rawMessage,
    message: 'Draft 3 ready',
    manifest: {
      version: 1,
      scope: 'workspace',
      kind: 'named',
    },
  })
})

test('workspace snapshot manifest runtime leaves legacy messages untouched', () => {
  assert.deepEqual(parseWorkspaceSnapshotPersistedMessage('Save: 2026-03-22 10:11'), {
    rawMessage: 'Save: 2026-03-22 10:11',
    message: 'Save: 2026-03-22 10:11',
    manifest: null,
  })
})
