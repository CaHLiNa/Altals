# Data Model

## Purpose

This document records the current explicit data-model seams that already exist in Altals.

It describes the repository as it exists today. It does not describe target models as if they are already implemented.

## Current Snapshot Model

Altals still stores local history in Git.

It now has five explicit layers above that Git history:

- `src/domains/changes/workspaceSnapshotRuntime.js`
- `src/domains/changes/workspaceSnapshotMetadataRuntime.js`
- `src/domains/changes/workspaceSnapshotManifestRuntime.js`
- `src/domains/changes/workspaceLocalSnapshotStoreRuntime.js`
- `src/domains/changes/workspaceLocalSnapshotPayloadRuntime.js`

These layers now introduce a first local workspace-save-point index plus a first restorable local payload slice while still reusing Git-backed history for the underlying content state. They map Git-backed history into explicit snapshot objects, attach UI/runtime metadata, persist a minimal manifest trailer for explicit workspace save points, record workspace-level save points into a local index under `workspaceDataDir`, and capture payload manifests plus per-file payload content for the explicitly captured restore set.

Current Git-backed record shape:

```js
{
  id: 'git:<commit-hash>',
  backend: 'git',
  sourceKind: 'git-commit',
  sourceId: '<commit-hash>',
  scope: 'file' | 'workspace',
  filePath: '/workspace/demo/draft.md',
  kind: 'named' | 'save' | 'auto' | 'empty',
  label: 'Draft 3 ready',
  message: 'Draft 3 ready',
  rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
  createdAt: '2026-03-22T10:11:00Z',
  manifest: null | {
    version: 1,
    scope: 'workspace',
    kind: 'named',
  },
}
```

Current meaning:

- `id` is the app-facing snapshot id
- `backend` identifies the current storage/recovery backend
- `sourceKind` and `sourceId` preserve the underlying Git implementation detail
- `scope` distinguishes file-history records from workspace-level save points created through the explicit snapshot action
- `kind` comes from the persisted manifest when present, and otherwise falls back to the shared history-message runtime
- `filePath` is populated for file-history/version-browser entries and stays empty for repo-wide workspace snapshot feed entries
- `label` is only populated for named history points
- `message` is the clean display text after stripping any persisted manifest trailer
- `rawMessage` preserves the raw Git-backed history subject
- `manifest` is only present for explicit workspace save points that were written through the new manifest trailer path
- only file-scoped snapshots are previewable/restorable through the current version-history flow

Current local workspace-save-point index record shape:

```js
{
  id: 'local:workspace:<commit-hash>',
  backend: 'local',
  sourceKind: 'workspace-save-point',
  sourceId: '<commit-hash>',
  scope: 'workspace',
  filePath: '',
  kind: 'named' | 'save',
  label: 'Draft 3 ready',
  message: 'Draft 3 ready',
  rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
  createdAt: '2026-03-22T10:11:00.000Z',
  manifest: {
    version: 1,
    scope: 'workspace',
    kind: 'named',
  },
  payload: {
    version: 1,
    kind: 'workspace-text-v1',
    manifestPath: '/workspace/.altals/snapshots/payloads/<commit-hash>/manifest.json',
    fileCount: 2,
    capturedAt: '2026-03-22T10:11:30.000Z',
  },
}
```

Current meaning:

- local workspace-save-point entries are stored in `workspaceDataDir/snapshots/workspace-save-points.json`
- `backend: 'local'` means the browser/feed is reading from the app-managed index, not that content restore is independent from Git yet
- `sourceId` still points at the underlying Git commit hash for the saved workspace milestone
- `payload` is present only when that workspace save point has a local restorable payload manifest
- the local index stores payload metadata, while the payload manifest/content live under `workspaceDataDir/snapshots/payloads/*`

Current local workspace-save-point payload manifest shape:

```js
{
  version: 1,
  kind: 'workspace-text-v1',
  workspacePath: '/workspace/demo',
  snapshot: {
    sourceId: '<commit-hash>',
    createdAt: '2026-03-22T10:11:00Z',
    message: 'Draft 3 ready',
  },
  capturedAt: '2026-03-22T10:11:30.000Z',
  fileCount: 2,
  files: [
    {
      path: '/workspace/demo/draft.md',
      relativePath: 'draft.md',
      contentPath: 'files/0.txt',
    },
  ],
}
```

Current meaning:

- payload manifests live under `workspaceDataDir/snapshots/payloads/<snapshot-source-id>/manifest.json`
- each manifest entry points to a payload content file stored beside that manifest
- this first payload slice currently covers the explicitly captured restore set rather than the whole workspace

Current attached metadata shape:

```js
{
  snapshotId: 'git:<commit-hash>',
  scope: 'file' | 'workspace',
  backend: 'git',
  sourceKind: 'git-commit',
  kind: 'named' | 'save' | 'auto' | 'empty',
  title: 'Draft 3 ready',
  message: 'Draft 3 ready',
  isNamed: true,
  isSystemGenerated: false,
  capabilities: {
    canPreview: false,
    canRestore: true,
    canCopy: false,
  },
  payload: {
    version: 1,
    kind: 'workspace-text-v1',
    manifestPath: '/workspace/.altals/snapshots/payloads/<commit-hash>/manifest.json',
    fileCount: 2,
    capturedAt: '2026-03-22T10:11:30.000Z',
  },
}
```

This metadata is derived at runtime from the snapshot record and is attached by `src/domains/changes/workspaceSnapshot.js`.

## Current Operations Using This Model

The current Git-backed snapshot wrapper is used by:

- `src/domains/changes/workspaceSnapshot.js`
- `src/components/VersionHistory.vue`
- `src/components/WorkspaceSnapshotBrowser.vue`
- `src/app/changes/useWorkspaceSnapshotActions.js`

Current operations use explicit snapshot objects for:

- explicit snapshot creation
- file-scoped version listing
- repo-wide workspace snapshot feed listing
- workspace payload-manifest summary loading
- preview loading
- restore actions

Current feed behavior is now split:

- `listFileVersionHistory({ workspacePath, filePath })` returns the file history for that file, including manifest-backed workspace save points if they touched the file
- `listWorkspaceSavePoints({ workspacePath, workspaceDataDir })` returns workspace save points from the local index and backfills manifest-backed Git entries into that index when needed

The underlying implementation still routes through:

- `src/domains/changes/workspaceHistoryPointRuntime.js`
- `src/domains/changes/workspaceVersionHistoryRuntime.js`
- `src/domains/changes/workspaceSnapshotRuntime.js`, which now also exposes explicit `listFileVersionHistoryEntries`, `listWorkspaceSavePointEntries`, `loadFileVersionHistoryPreview`, and `restoreFileVersionHistoryEntry` runtime seams
- `src/domains/changes/workspaceLocalSnapshotStoreRuntime.js`, which now owns the workspace save-point index path plus local record/write/backfill behavior
- `src/domains/changes/workspaceLocalSnapshotPayloadRuntime.js`, which now owns payload manifest paths plus capture/load/restore behavior for payload-backed workspace save points

## Current Limitations

This is now a hybrid local-index plus Git-content layer.

It does not yet provide:

- workspace-level preview/diff independent from Git show/write flows
- whole-workspace restore coverage beyond the current explicitly captured payload file set
- manifest persistence outside Git-backed history subjects for the file-history path

## Next Data-Model Step

The next Phase 4 data-model step is no longer deciding whether a first restorable payload should exist. That slice has landed.

The next immediate step is:

1. decide how far the local payload should expand beyond the current explicitly captured file set
2. keep the current `workspace` vs `file` scope distinction explicit while doing that
3. avoid drifting back into lower-value naming cleanup now that the public app boundary is aligned
