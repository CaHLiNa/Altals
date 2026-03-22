# Operations

## Purpose

This document records the current operation seams that already exist in Altals and the gaps that still remain before the repository reaches a shared operation model.

It describes the current implementation truthfully. It does not treat target operations as already landed.

## Current State

Altals does not yet have a single centralized operation layer.

Current operations are distributed across:

- app-facing action hooks in `src/app/*`
- domain runtimes in `src/domains/*`
- store actions that still act as migration shells
- service functions that encapsulate Git, build, and filesystem effects

The most concrete current operation seams are in:

- document preview/build/diagnostic flow
- workspace history and Git bootstrap
- workspace automation for auto-commit and GitHub sync

## Phase 3 Core Loop

The current core document loop is implemented as a set of explicit runtime-backed actions rather than one monolithic store file.

### Project Open

Project opening is still coordinated from workspace bootstrap and lifecycle code, especially:

- `src/app/workspace/useWorkspaceLifecycle.js`
- `src/domains/workspace/workspaceBootstrapRuntime.js`
- `src/stores/workspace.js`

This area is not yet represented as a single `OpenProject` operation, but the bootstrap/watch sequence is already partially isolated.

### Document Read / Save

Document read and save behavior is still store-centered, with runtime help in the files domain:

- `src/domains/files/fileContentRuntime.js`
- `src/stores/files.js`
- `src/domains/editor/editorDirtyPersistence.js`

This means Altals can already perform document reads and saves through reusable helpers, but `ReadDocument` and `SaveDocument` are not yet first-class named operations.

### Build / Preview / Diagnostics

This is the clearest currently landed Phase 3 operation seam.

`src/domains/document/documentWorkflowRuntime.js` now owns preview/open/reconcile behavior:

- `reconcile`
- `ensurePreviewForSource`
- `revealPreview`
- `closePreviewForSource`

`src/domains/document/documentWorkflowBuildRuntime.js` now owns build/diagnostic visibility behavior:

- `buildAdapterContext`
- `openLogForFile`
- `getProblemsForFile`
- `getUiStateForFile`
- `getStatusTextForFile`
- `getStatusTone`

These runtimes deliberately reuse the existing document adapters in `src/services/documentWorkflow/adapters/*` instead of creating a parallel build abstraction.

Current adapter-backed behavior includes:

- Markdown draft + preview problem aggregation
- LaTeX compile/log/problem/status wiring
- Typst compile/log/problem/status wiring
- preview-kind and preview-availability resolution

`src/stores/documentWorkflow.js` is now a thinner migration shell over these runtimes, and `src/composables/useEditorPaneWorkflow.js` reuses the same runtime seam for toolbar state and compile context.

### Review Changes / History

The current review loop still uses Git-backed history rather than a separate app snapshot model.

Primary entry points:

- `src/app/changes/useWorkspaceSnapshotActions.js`
- `src/domains/changes/workspaceSnapshot.js`
- `src/app/changes/useSnapshotLabelPrompt.js`
- `src/domains/changes/workspaceHistoryPointRuntime.js`
- `src/domains/changes/workspaceVersionHistoryRuntime.js`
- `src/components/VersionHistory.vue`

Current behavior:

- explicit snapshot creation now routes through `workspaceSnapshot.js`, which persists dirty/open files before committing through the lower history-point/runtime seam
- explicit workspace save points now persist a Git-backed manifest trailer through `workspaceSnapshotManifestRuntime.js` so `scope` / `kind` metadata survives later history listing
- Footer prompt state for naming that history point is now isolated behind the `snapshotLabelPromptRuntime` / `useSnapshotLabelPrompt` app-layer seam
- file version history now opens through `openFileVersionHistoryBrowser(...)` and lists through `listFileVersionHistory(...)`
- repo-wide workspace save points now list through `listWorkspaceSavePoints(...)` and surface in `WorkspaceSnapshotBrowser.vue`
- file version history preview/restore now route through `loadFileVersionHistoryPreview(...)` / `restoreFileVersionHistoryEntry(...)`
- the lower snapshot runtime now mirrors that separation through `listFileVersionHistoryEntries(...)`, `listWorkspaceSavePointEntries(...)`, `loadFileVersionHistoryPreview(...)`, and `restoreFileVersionHistoryEntry(...)`
- created save points are currently workspace-scoped snapshots, while version-history browsing still yields file-scoped snapshots plus any manifest-backed workspace save points that touched the current file
- restore actions still operate through Git history for file-scoped snapshots

This is now the first explicit Git-backed `CreateSnapshot` / `RestoreSnapshot` boundary, but it is still not a separate local snapshot backend.

## Current Operation Map

The repository is converging toward the target operation model, but the current mapping is still partial:

| Target operation | Current implementation status | Current primary path |
| --- | --- | --- |
| `OpenProject` | Partial | workspace lifecycle + bootstrap runtime |
| `ListProjectFiles` | Partial | files store + file tree runtimes |
| `ReadDocument` | Partial | file content runtime |
| `SaveDocument` | Partial | files store + editor dirty persistence |
| `BuildDocument` | Partial but strongest | document workflow adapters + build runtime |
| `RevealPreview` | Landed seam | document workflow runtime |
| `ListProblems` | Landed seam | document workflow build runtime |
| `OpenBuildLog` | Landed seam | document workflow build runtime |
| `ListChanges` | Partial but explicit | version history UI + workspace snapshot operation boundary |
| `CommitChanges` | Partial | workspace history commit runtime |
| `CreateHistoryPoint` | Internal seam only | workspace history point runtime + Footer prompt runtime |
| `PushRemote` / `PullRemote` | Partial | workspace GitHub services/runtime |
| `CreateSnapshot` | Partial but explicit | workspace snapshot operation boundary + history point runtime |
| `RestoreSnapshot` | Partial but explicit | workspace snapshot operation boundary + version-history runtime |

## Gaps

The main missing pieces are:

- no single operation layer shared by UI, AI, and commands
- save/build/review operations are still split between stores, composables, and services
- build execution is still launched from UI-facing composables instead of a shared document operation entry
- the repository still has no true local snapshot backend above the current Git-backed save-point/history wrapper
- change review is still Git-first rather than a snapshot store independent from Git

## Next Operation Work

The next operation-oriented refactor should stay in Phase 4 and focus on the safety model boundary, not on more cosmetic Phase 2 store cleanup.

The most useful next operation target is to decide the first true local snapshot backend so:

- explicit workspace save points
- per-file version history
- preview/restore affordances
- Footer save-point creation

stop sharing a single file-history modal without inventing a second hidden safety path.
