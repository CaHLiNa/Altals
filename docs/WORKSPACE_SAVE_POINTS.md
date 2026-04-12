# Workspace Save Points

Altals uses local workspace save points to capture restorable text snapshots for the current project.

## What a save point contains

- a workspace-scoped snapshot record in `src/domains/changes/workspaceSnapshotRuntime.js`
- a local index entry stored through `src/domains/changes/workspaceLocalSnapshotStoreRuntime.js`
- optional payload metadata and captured file content managed by `src/domains/changes/workspaceLocalSnapshotPayloadRuntime.js`

## Current behavior

- save points are stored inside the workspace metadata directory, not in the project tree
- save points capture restorable text content for the current workspace scope
- the browser in `src/components/WorkspaceSnapshotBrowser.vue` lists local save points only
- restore flows operate through explicit file writes and diff/apply paths, not repository checkout

## Important boundaries

- save points are product-level recovery records for the opened workspace
- they are separate from repository source control for the Altals app itself
- visibility state can hide save points from the UI without rewriting stored payload files
- payload coverage may vary by save point depending on which files were readable and in scope

## Validation anchors

- `tests/workspaceSnapshot.test.mjs`
- `tests/workspaceSnapshotRuntime.test.mjs`
- `tests/workspaceLocalSnapshotStoreRuntime.test.mjs`
- `tests/workspaceSnapshotPreviewRuntime.test.mjs`

## See also

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TESTING.md`
