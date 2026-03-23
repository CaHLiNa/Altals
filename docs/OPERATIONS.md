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
- notebook/kernel-backed execution flow
- AI workflow launch/executor flow
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

### Notebook / Code Execution

The computation loop already exists, but it is still distributed.

Primary paths today include:

- `src/components/editor/NotebookEditor.vue`
- `src/stores/kernel.js`
- `src/stores/environment.js`
- `src/services/chunkKernelBridge.js`
- `src/services/notebookDocument.js`
- `src-tauri/src/kernel.rs`

Current behavior includes:

- kernelspec discovery
- kernel launch / shutdown / interrupt
- notebook cell execution
- text-editor chunk execution for runnable surfaces
- environment detection and kernel installation guidance

This means Altals already has partial `RunNotebookCell`, `RunCodeSelection`, and environment-preparation operations, but they are not yet behind one shared execution domain seam.

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
- `getArtifactPathForFile`
- `getStatusTone`

`src/domains/document/documentWorkflowBuildOperationRuntime.js` now owns shared build execution behavior:

- `runBuildForFile`

`src/domains/document/documentWorkflowTypstPaneRuntime.js` now owns the typst preview/pdf shared-pane state machine:

- `revealPreviewForFile`
- `revealPdfForFile`

`src/domains/document/documentWorkflowActionRuntime.js` now owns the remaining UI-facing document workflow action routing:

- `toggleMarkdownPreviewForFile`
- `togglePdfPreviewForFile`
- `runPrimaryActionForFile`
- `revealPreviewForFile`
- `revealPdfForFile`

These runtimes deliberately reuse the existing document adapters in `src/services/documentWorkflow/adapters/*` instead of creating a parallel build abstraction.

Current adapter-backed behavior includes:

- Markdown draft + preview problem aggregation
- LaTeX compile/log/problem/status wiring
- Typst compile/log/problem/status wiring
- preview-kind and preview-availability resolution

`src/stores/documentWorkflow.js` is now a migration shell over these runtimes, and `src/composables/useEditorPaneWorkflow.js` now reuses the same document seam for toolbar state, build launch, compile-artifact lookup, typst preview/pdf pane switching, and UI-facing primary/reveal action routing instead of calling compile adapters or running the typst shared-pane/action state machine directly.

### Review Changes / History

The current review loop still uses Git-backed history rather than a separate app snapshot model.

Primary entry points:

- `src/app/changes/useWorkspaceSnapshotActions.js`
- `src/domains/changes/workspaceSnapshot.js`
- `src/app/changes/useSnapshotLabelPrompt.js`
- `src/domains/changes/workspaceHistoryPointRuntime.js`
- `src/domains/changes/workspaceLocalSnapshotStoreRuntime.js`
- `src/domains/changes/workspaceLocalSnapshotPayloadRuntime.js`
- `src/domains/changes/workspaceVersionHistoryRuntime.js`
- `src/components/VersionHistory.vue`

Current behavior:

- explicit snapshot creation now routes through `workspaceSnapshot.js`, which persists dirty/open files before committing through the lower history-point/runtime seam
- explicit workspace save points now persist a Git-backed manifest trailer through `workspaceSnapshotManifestRuntime.js` so `scope` / `kind` metadata survives later history listing
- explicit workspace save points now also record a local index entry under `workspaceDataDir/snapshots/workspace-save-points.json`
- explicit workspace save points can now also capture a local payload manifest plus per-file payload files for a filtered `project-text-set` inside the current workspace
- `workspaceSnapshotProjectTextRuntime.js` now assembles that `project-text-set` from loaded text candidates plus the workspace flat-file index instead of stopping at already loaded files
- that broadened project text set is explicitly filtered so PDF/binary/non-document/support-only paths do not enter workspace payload capture through cached string fallbacks or raw index membership
- payload metadata now preserves an explicit `captureScope` so workspace restore semantics stay visible above the raw payload files
- payload metadata and payload manifests now also preserve skipped coverage so unreadable or over-limit project-text candidates do not disappear silently
- Footer prompt state for naming that history point is now isolated behind the `snapshotLabelPromptRuntime` / `useSnapshotLabelPrompt` app-layer seam
- file version history now opens through `openFileVersionHistoryBrowser(...)` and lists through `listFileVersionHistory(...)`
- repo-wide workspace save points now list through `listWorkspaceSavePoints({ workspacePath, workspaceDataDir })` and surface in `WorkspaceSnapshotBrowser.vue`
- repo-wide workspace save points can now also load payload-manifest summaries through `loadWorkspaceSavePointPayloadManifest(...)`
- repo-wide workspace save points can now also load a current-workspace preview summary through `loadWorkspaceSavePointPreviewSummary(...)`
- repo-wide workspace save points can now also load a selected-file full diff/content preview through `loadWorkspaceSavePointFilePreview(...)`
- repo-wide workspace save-point preview summaries now also surface `addedEntries` for in-scope project-text files that were added after the selected save point
- file version history preview/restore now route through `loadFileVersionHistoryPreview(...)` / `restoreFileVersionHistoryEntry(...)`
- payload-backed workspace save points can now restore their captured files through `restoreWorkspaceSavePoint(...)`
- payload-backed workspace save points can now also restore the currently inspected captured file through the same app-managed payload boundary, still without routing restore through Git history
- that selected-file restore path is now explicit at the app boundary through `restoreWorkspaceSavePointFile(...)`
- the workspace snapshot operation boundary now also exposes `applyWorkspaceSavePointFilePreviewContent(...)` so chunk-level diff decisions can write merged text back through the same app-managed file-write/editor-sync path instead of a browser-local shortcut
- the workspace snapshot operation boundary now also exposes `removeWorkspaceSavePointAddedFile(...)` so added in-scope project-text files can be removed through the same app-managed workspace save-point boundary instead of Git history
- the lower snapshot runtime now mirrors that separation through `listFileVersionHistoryEntries(...)`, `listWorkspaceSavePointEntries(...)`, `loadFileVersionHistoryPreview(...)`, and `restoreFileVersionHistoryEntry(...)`
- the lower snapshot runtime now also backfills manifest-backed Git workspace save points into the local index so the workspace browser does not remain a new-records-only surface
- `WorkspaceSnapshotBrowser.vue` now lists the captured files for payload-backed save points, exposes a dedicated restore action for them, and distinguishes the newer `project-text-set` payload scope from the older loaded/open-only payload scopes
- `WorkspaceSnapshotBrowser.vue` now also lists skipped payload candidates and explains skipped-only save points without falsely offering a restore button
- `WorkspaceSnapshotBrowser.vue` now also shows a current-workspace comparison summary for captured files before restore, without routing that preview through Git history
- `WorkspaceSnapshotBrowser.vue` now also shows files added after the selected save point inside the current filtered `project-text-set` and allows targeted removal for them
- `WorkspaceSnapshotBrowser.vue` now also lets the user inspect a selected modified or missing captured file through a local patch/diff editor before restore, without routing that preview through Git history
- `WorkspaceSnapshotBrowser.vue` now also lets the user use merge-view chunk controls inside that diff editor and apply the resulting merged content back to the workspace file without routing that write through Git history
- `WorkspaceSnapshotBrowser.vue` now also exposes a `Restore this file` action for the currently inspected captured file and refreshes the local preview surface after that targeted restore
- full workspace save-point restore can now also remove added in-scope project-text files when the selected save point represents an earlier filtered `project-text-set` state
- created save points are currently workspace-scoped snapshots, while version-history browsing still yields file-scoped snapshots plus any manifest-backed workspace save points that touched the current file
- restore actions still operate through Git history for file-scoped snapshots

This is now the first explicit hybrid snapshot boundary: local workspace-save-point indexing plus payload-backed workspace restore above Git-backed content history. File-scoped restore is still Git-backed.

## Phase 5 AI Workflow

The current AI system is still distributed, but it now has one clearer document-scoped operation seam.

Primary launch/runtime paths today:

- `src/services/ai/taskCatalog.js`
- `src/services/ai/launch.js`
- `src/services/ai/workflowRuns/templates.js`
- `src/stores/aiWorkflowRuns.js`
- `src/domains/document/documentWorkflowAiRuntime.js`

`src/domains/document/documentWorkflowAiRuntime.js` now owns the document workflow toolbar's AI launch routing:

- `launchDiagnoseForFile`
- `launchFixForFile`

This runtime deliberately reuses the existing AI launch service and task catalog instead of introducing a second document-only AI backend.

Current document-scoped AI behavior includes:

- only TeX / Typst files are eligible through this seam
- diagnose uses the existing `compile.tex-typ-diagnose` workflow template
- fix uses the existing `compile.tex-typ-fix` workflow template
- fix remains patch-first because the underlying workflow still pauses at `apply_patch`
- `useEditorPaneWorkflow.js` no longer builds those tasks or calls `launchAiTask(...)` directly

## Current Operation Map

The repository is converging toward the target operation model, but the current mapping is still partial:

| Target operation | Current implementation status | Current primary path |
| --- | --- | --- |
| `OpenProject` | Partial | workspace lifecycle + bootstrap runtime |
| `ListProjectFiles` | Partial | files store + file tree runtimes |
| `ReadDocument` | Partial | file content runtime |
| `SaveDocument` | Partial | files store + editor dirty persistence |
| `RunNotebookCell` | Partial | notebook editor + kernel store + Tauri kernel commands |
| `RunCodeSelection` | Partial | chunk kernel bridge + editor surfaces |
| `BuildDocument` | Partial but strongest | document workflow build operation runtime + build runtime |
| `RevealPreview` | Landed seam | document workflow runtime |
| `ListProblems` | Landed seam | document workflow build runtime |
| `OpenBuildLog` | Landed seam | document workflow build runtime |
| `ListChanges` | Partial but explicit | version history UI + workspace snapshot operation boundary |
| `CommitChanges` | Partial | workspace history commit runtime |
| `CreateHistoryPoint` | Internal seam only | workspace history point runtime + Footer prompt runtime |
| `PushRemote` / `PullRemote` | Partial | workspace GitHub services/runtime |
| `CreateSnapshot` | Partial but explicit | workspace snapshot operation boundary + history point runtime |
| `RestoreSnapshot` | Partial but explicit | workspace snapshot operation boundary + version-history runtime + local payload runtime |
| `RunAiWorkflow` | Partial but explicit | AI task catalog + launch service + workflow runs + document workflow AI runtime |

## Gaps

The main missing pieces are:

- no single operation layer shared by UI, AI, and commands
- save/build/review operations are still split between stores, composables, and services
- notebook execution is real but still lacks one shared execution/notebook domain boundary
- workspace snapshot restore currently covers only the current filtered `project-text-set`, not a whole-project rewind
- that `project-text-set` boundary is broader than the loaded-only path but still narrower than the whole workspace, which keeps workspace restore separate from PDF extraction and other non-document side paths
- change review is still partly Git-first because file preview/restore remains Git-backed even though workspace save-point review now has local chunk-level apply/restore
- workspace save-point preview/restore now covers captured-file replay, chunk-level apply, and in-scope added-file removal, but it still does not provide a whole-project rewind
- the remaining document workflow glue in `useEditorPaneWorkflow.js` is now mostly thin compile-button wrappers rather than the main Phase 3/5 orchestration knot
- many non-document surfaces still launch AI workflows directly instead of going through one shared app/domain AI operation seam

## Next Operation Work

The current planned Phase 3, Phase 4, Phase 5, and the current planned Phase 6 documentation/stabilization baseline are complete for their current scopes.

The next operation-oriented refactor should not reopen document workflow extraction or scatter more one-off AI wrappers.

The highest-value next operation slice is the first explicit execution/notebook boundary.

The most useful next operation target is now:

- keep workspace save-point restore separate from Git-backed file version history restore
- shrink the remaining direct AI launch callers toward a clearer shared app/domain AI operation seam
- start backend layering work where the frontend architecture now has the clearest lead, especially around the still-flat Rust command modules
