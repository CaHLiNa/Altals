# Refactor Blueprint

## Overview

Altals is being refactored from a broad, feature-heavy research desktop application into a focused, local-first academic writing workspace centered on project-based document editing, references, builds, changes, and AI-assisted patch workflows.

This file is the living execution plan for the refactor. It must always reflect the real repository state, not an aspirational plan.

Current overall assessment:

- Phase 0 is effectively complete.
- Phase 1 is substantially advanced but not fully closed.
- Phase 2 is meaningfully underway with two major store/domain reductions already completed.
- Phase 3 onward are still mostly ahead of us and should not be treated as already in execution.
- Repository state was re-audited on 2026-03-22; the current worktree already contains in-flight `files` runtime extractions and blueprint updates that must be carried forward, not discarded.

## Product Direction

Target product definition:

> A local-first, project-directory-centered academic writing workspace.

Primary workflow:

1. Open project
2. Browse files
3. Edit document
4. Manage references
5. Build / preview
6. Review changes
7. Use AI through auditable proposals

First-class product objects:

- Project
- Document
- Reference
- Build
- Change
- Workflow

Secondary/supporting systems:

- Git
- remote sync
- terminal
- AI chat
- experimental panels
- legacy migration shims

If there is tension between the writing workflow and support systems, the writing workflow wins.

## Architectural Principles

- Domain-first structure
- Thin root components
- Thin Rust commands
- Shared operation-oriented boundaries
- Patch-first AI
- Clear separation of autosave, snapshot, git commit, and remote sync
- Documentation maintained alongside code
- Controlled migration instead of blind rewrite
- Real boundary extraction over cosmetic refactors
- Narrow, validated slices over broad speculative changes

Target frontend direction:

- `src/app`
- `src/domains/project`
- `src/domains/document`
- `src/domains/reference`
- `src/domains/build`
- `src/domains/changes`
- `src/domains/ai`
- `src/domains/git`
- `src/domains/terminal`
- `src/shared`

Target Rust direction:

- `src-tauri/src/commands`
- `src-tauri/src/core`
- `src-tauri/src/services`
- `src-tauri/src/models`
- `src-tauri/src/errors`

## Current State Assessment

### Product / architecture reality

The repository has already moved away from a fully App-centric structure, but it has not yet reached a stable domain-oriented architecture.

The current strongest signs of progress are:

- `src/app` entry-layer boundaries have been established.
- `App.vue` has already been reduced significantly and no longer carries as much direct orchestration as before.
- `src/domains/changes` has been established as an early domain boundary.
- `references` and `editor` have both gone through first-round store/domain extraction.

### Frontend current state

#### App/root layer

The root app component has already been reduced through extraction of several orchestration modules, including workspace lifecycle, shell event bridge, workspace history actions, teardown handling, and footer status sync.

#### Large store reduction progress

Two major store reductions have already happened:

1. `references`
2. `editor`

##### References domain status

The references store has already had these responsibilities extracted into domain modules:

- workflow metadata
- workbench collections / saved views
- search / export
- import / dedup / merge
- storage IO

The store still retains mostly store-specific lifecycle, watcher, self-write bookkeeping, load generation, and state sync responsibilities.

##### Editor domain status

The editor store has already had these responsibilities extracted into domain modules:

- pane tree / layout
- pane tab mutation
- surface switching
- persistence runtime
- editor view registry
- dirty persistence bridge
- research / execution insertion actions
- cleanup runtime
- restore runtime

The editor store is now much smaller and is no longer the highest-priority refactor target.

#### Remaining large frontend bottlenecks

The largest remaining frontend architectural bottlenecks include:

- `src/stores/files.js`
- `src/stores/workspace.js`
- `src/stores/chat.js`
- `src/stores/terminal.js`
- `src/components/editor/PdfViewer.vue`

`workspace` is now the clearest next large store/domain split target.

Current `files`-specific audit notes:

- `src/stores/files.js` is now 579 lines after the cache, refresh, watch, hydration, flat-file indexing, content-runtime, entry-creation/import, mutation-runtime, and cleanup slices.
- `fileStoreIO` already carries filesystem IO helpers.
- `fileStoreEffects` already carries cross-store rename/move/delete side effects.
- `src/domains/files/fileTreeCacheRuntime.js` now carries the first extracted `files` runtime slice:
  - `treeCacheByWorkspace`
  - root expanded-dir snapshotting
  - cached tree restore
  - cached expanded-dir replay
- `src/domains/files/fileTreeRefreshRuntime.js` now carries visible-tree refresh orchestration:
  - loaded-directory traversal
  - tree snapshot diffing
  - queued visible-tree refresh loop
- `src/domains/files/fileTreeWatchRuntime.js` now carries watch/poll lifecycle orchestration:
  - filesystem event filtering
  - debounce handling
  - activity tracking
  - visibility-aware polling
- `src/domains/files/fileTreeHydrationRuntime.js` now carries tree hydration/loading orchestration:
  - entry lookup
  - shallow tree load
  - directory child hydration
  - post-mutation tree resync / expansion replay
- `src/domains/files/flatFilesIndexRuntime.js` now carries flat-file indexing/runtime orchestration:
  - delayed recursive indexing
  - generation-based stale-result suppression
  - promise/timer reuse and cleanup
- `src/domains/files/fileContentRuntime.js` now carries file content/runtime orchestration:
  - text/PDF read behavior
  - file load error normalization and cache updates
  - PDF source-kind detection and reload behavior
  - save-path cache synchronization
- `src/domains/files/fileCreationRuntime.js` now carries entry-creation/import runtime orchestration:
  - create file
  - duplicate path
  - create folder
  - copy external file into workspace
- `src/domains/files/fileMutationRuntime.js` now carries rename/move/delete coordination:
  - cache migration after rename
  - editor tab and wiki-link side effects
  - expanded-dir state repair
  - deletion race protection and post-mutation tree refresh
- `files` is no longer the clearest next extraction target; the next high-value store slice has shifted to `workspace`.

Current `workspace`-specific audit notes:

- `src/stores/workspace.js` is now 727 lines after automation, GitHub session, settings/instructions, and bootstrap/watch runtime extractions.
- `src/domains/workspace/workspaceAutomationRuntime.js` now carries:
  - auto-commit interval lifecycle
  - sync timer lifecycle
  - auto-sync / fetch / sync-now orchestration
  - timer cleanup during workspace teardown
- `src/domains/workspace/workspaceGitHubRuntime.js` now carries:
  - init/connect/disconnect state transitions
  - repo link/unlink orchestration
  - sync-state application bridges
- `src/domains/workspace/workspaceSettingsRuntime.js` now carries:
  - workspace settings load orchestration
  - instructions file migration/load/open flows
  - global key/model config persistence
  - tool-permission and skills-manifest IO
- `src/domains/workspace/workspaceBootstrapRuntime.js` now carries:
  - bootstrap step sequencing with stale-generation guards
  - watch-directory registration
  - instructions fs-change listener lifecycle
  - workspace usage kickoff and auto-commit startup bridge
- Remaining `workspace` store logic is now mostly:
  - open/close state reset
  - thin service wrappers for data-dir/project-dir/edit-hook setup
  - preference/UI state setters and zoom/theme helpers
- The next high-value store reduction should shift away from `workspace`; `src/stores/terminal.js` (889 lines) is now the largest remaining store bottleneck ahead of `src/stores/chat.js` (854 lines).

### Backend current state

Rust backend structure is still largely flat.

Large backend modules still include:

- `src-tauri/src/latex.rs`
- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/kernel.rs`
- `src-tauri/src/pdf_translate.rs`
- `src-tauri/src/git.rs`

This means the backend has not yet entered the target command/core/service/model layering.

### Docs state

Current docs are still incomplete.

Observed repository reality as of 2026-03-22:

- `docs/REFACTOR_BLUEPRINT.md` is still the only substantive top-level architecture/refactor document in `docs/`.
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/DOMAINS.md`, `docs/OPERATIONS.md`, and the other required documents still do not exist.
- The repository currently has no additional markdown architecture map to explain how the newly extracted frontend domain modules relate to the remaining large stores.

Required docs such as the following are still missing:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAINS.md`
- `docs/OPERATIONS.md`
- `docs/DATA_MODEL.md`
- `docs/BUILD_SYSTEM.md`
- `docs/AI_SYSTEM.md`
- `docs/GIT_AND_SNAPSHOTS.md`
- `docs/CONTRIBUTING.md`
- `docs/TESTING.md`

At the moment, `docs/REFACTOR_BLUEPRINT.md` is the only clearly established refactor doc.

### Safety model observations

Safety boundaries are still not clean.

Important remaining coupling:
- `workspaceAutoCommit`
- version history flows
- app-level history triggers
- Git-based safety expectations

This means autosave, local snapshot, git commit, and remote sync are still not sufficiently separated.

## Phase Plan

### Phase 0 - Inventory and Truthful Documentation
Goal:
- record the real repository structure
- identify actual bottlenecks
- replace placeholder planning with truthful documentation

Status:
- Complete

Exit criteria:
- current structure documented truthfully
- major bottlenecks identified
- blueprint is no longer a placeholder

### Phase 1 - App and Domain Skeleton
Goal:
- establish `src/app` entry-layer boundaries
- shrink `App.vue`
- begin app/domain separation
- establish early domain boundaries

Status:
- In progress, late stage

What has already happened:
- workspace lifecycle extraction
- shell event bridge extraction
- workspace history action extraction
- teardown extraction
- footer status sync extraction
- early `changes` boundary creation

Exit criteria:
- `App.vue` reduced to mostly composition/template/UI glue
- remaining root-level responsibilities explicitly documented
- no new business logic added back into root app layer

### Phase 2 - Store Boundary Reduction
Goal:
- reduce giant store responsibility
- move domain logic out of stores
- reduce cross-store orchestration pressure

Status:
- In progress

Completed phase slices:
- `references` first-round extraction completed
- `editor` first-round extraction completed
- `files` first extraction slice completed

Current next target:
- `src/stores/workspace.js`

Exit criteria:
- third large store/domain split begun and validated
- store responsibilities narrower and better documented
- migration notes identify legacy deletion targets

### Phase 3 - Project / Document / Build / Change Loop
Goal:
- stabilize the main product loop:
  - open project
  - edit document
  - save
  - build
  - review changes
- unify diagnostics and visibility of outcomes

Status:
- Not yet meaningfully started

Exit criteria:
- coherent main loop documented
- build/diagnostic/change visibility improved
- core loop is more explicit than legacy cross-store behavior

### Phase 4 - Safety Model Separation
Goal:
- separate autosave, local snapshot, git commit, remote sync
- reduce hidden automation
- weaken Git’s role as implicit safety layer

Status:
- Not yet started in code
- partially identified in audit

Exit criteria:
- explicit safety model documented
- auto-commit/history coupling reduced
- recovery model clearer to users and maintainers

### Phase 5 - AI Workflow Discipline
Goal:
- constrain AI to proposal/patch/review
- prevent direct broad side effects
- move toward operation-aligned AI paths

Status:
- Not yet started

Exit criteria:
- AI behavior documented
- at least one narrow proposal-first workflow planned or implemented
- no expansion of direct-action AI paths

### Phase 6 - Cleanup and Stabilization
Goal:
- delete dead legacy paths
- build missing docs
- add tests and validation
- reduce ambiguity in the repository

Status:
- Not yet started, aside from blueprint maintenance

Exit criteria:
- missing core docs exist
- dead paths are identified and some are removed
- validation story is stronger than raw build-only confidence

## Task Backlog

### Highest-priority backlog

- [x] Audit `src/stores/files.js` in detail and identify the cleanest first extraction slice
- [x] Create `src/domains/files/*` or equivalent runtime boundary for the first `files` slice
- [x] Validate the first `files` extraction with build verification
- [x] Decide whether the next slice stays in `files` or shifts to `workspace`
- [x] Extract the `files` refresh/runtime orchestration slice into `src/domains/files/*`
- [x] Validate the `files` refresh/runtime extraction with targeted runtime tests and build verification
- [x] Decide whether the next safe slice remains in `files` watch/poll orchestration or shifts to `workspace`
- [x] Extract the `files` watch/poll orchestration slice into `src/domains/files/*`
- [x] Validate the `files` watch/poll extraction with targeted runtime tests and build verification
- [x] Remove the dead `files` flat-file cache gate and unused active-file state left behind after the runtime splits
- [x] Decide whether the next safe slice is `files` tree hydration/runtime or a docs/architecture catch-up slice
- [x] Extract the `files` tree hydration/runtime slice into `src/domains/files/*`
- [x] Validate the `files` tree hydration/runtime extraction with targeted runtime tests and build verification
- [x] Decide whether the next safe slice remains in `files` flat-file indexing/runtime or shifts to architecture/doc catch-up
- [x] Extract the `files` flat-file indexing/runtime slice into `src/domains/files/*`
- [x] Validate the `files` flat-file indexing/runtime extraction with targeted runtime tests and build verification
- [x] Decide whether the next safe slice remains in `files` content/runtime or shifts to architecture/doc catch-up
- [x] Extract the `files` content/runtime slice into `src/domains/files/*`
- [x] Validate the `files` content/runtime extraction with targeted runtime tests and build verification
- [x] Decide whether the next safe slice remains in `files` entry-creation/import runtime or shifts to architecture/doc catch-up
- [x] Extract the `files` entry-creation/import runtime slice into `src/domains/files/*`
- [x] Validate the `files` entry-creation/import runtime extraction with targeted runtime tests and build verification
- [x] Decide whether rename/move/delete should become a dedicated file-operations boundary or wait until `docs/OPERATIONS.md` exists
- [x] Extract the `files` rename/move/delete coordination slice into `src/domains/files/*` without widening cross-store leakage
- [x] Validate the rename/move/delete slice against editor-tab migration, wiki-link updates, and delete-race behavior
- [x] Decide whether the next safe slice shifts from `files` to `workspace` timer/runtime orchestration
- [x] Extract the `workspace` auto-commit + GitHub sync timer/runtime slice into `src/domains/workspace/*` or `src/app/workspace/*`
- [x] Validate the `workspace` timer/runtime extraction with targeted tests and build verification
- [x] Decide whether the next safe slice after timer/runtime extraction is GitHub session lifecycle or settings/bootstrap loading
- [x] Extract the `workspace` GitHub session lifecycle slice into `src/domains/workspace/*`
- [x] Validate the `workspace` GitHub session lifecycle extraction with targeted tests and build verification
- [x] Extract the `workspace` settings/instructions/runtime slice into `src/domains/workspace/*`
- [x] Validate the `workspace` settings/instructions/runtime extraction with targeted tests and build verification
- [x] Decide whether the next safe `workspace` slice is bootstrap/watch orchestration or preference-state cleanup
- [x] Extract the `workspace` bootstrap/watch orchestration slice into `src/domains/workspace/*`
- [x] Validate the `workspace` bootstrap/watch extraction with targeted tests and build verification
- [x] Decide whether `workspace` still merits another high-value extraction or whether Phase 2 focus should shift to the next large store
- [ ] Audit `src/stores/terminal.js` in detail and identify the cleanest first extraction slice
- [ ] Extract the first `terminal` runtime/domain slice into `src/domains/terminal/*`
- [ ] Validate the first `terminal` slice with targeted tests and build verification

### Product and architecture docs

- [ ] Create `docs/PRODUCT.md`
- [ ] Create `docs/ARCHITECTURE.md`
- [ ] Create `docs/DOMAINS.md`
- [ ] Create `docs/OPERATIONS.md`

### Safety model

- [ ] Document the current coupling between auto-commit and history/version flows
- [ ] Create `docs/GIT_AND_SNAPSHOTS.md`
- [ ] Identify a concrete first code slice for separating safety responsibilities

### Backend planning

- [ ] Audit `src-tauri/src/latex.rs` for command/core/service split opportunities
- [ ] Audit `src-tauri/src/fs_commands.rs` for future boundary extraction
- [ ] Define first backend layering slice after frontend store work has progressed further

### Cleanup / validation

- [ ] Identify dead or near-dead paths left behind by App/store extraction
- [ ] Record deletion targets for temporary bridges
- [ ] Strengthen validation beyond repeated build-only verification

## In Progress

- `src/app` entry-layer boundary construction
- reduction of `App.vue` toward composition-only role
- early `changes` domain boundary
- post-extraction stabilization after `references` first-round split
- post-extraction stabilization after `editor` first-round split
- transition of store-boundary reduction focus toward `files`
- `files` detailed audit completed; first narrow slice selected as tree cache / workspace snapshot runtime
- `files` first runtime extraction has landed; focus remains on `files` for at least one more slice before reevaluating `workspace`
- 2026-03-22 execution cycle: re-auditing `files` post-watch state, docs truthfulness, and validation gaps before the next code slice lands
- `files` refresh/runtime orchestration has now been extracted into a dedicated domain runtime module; next decision is whether to continue with watch/poll orchestration in the same domain
- `files` watch/poll orchestration has now also been extracted into a dedicated domain runtime module; remaining `files` runtime complexity is concentrated in tree hydration/loading and a small reconcile/status shell
- `files` tree hydration/runtime has now also been extracted into a dedicated domain runtime module; the next remaining `files` runtime knot is flat-file indexing and timer/promise coordination
- `files` flat-file indexing/runtime has now also been extracted into a dedicated domain runtime module; the next remaining `files` logic cluster is file content/PDF handling plus mutation-side orchestration
- `files` content/runtime has now also been extracted into a dedicated domain runtime module; the next remaining `files` logic cluster is creation/import mutations plus rename/move/delete coordination
- `files` entry-creation/import runtime has now also been extracted into a dedicated domain runtime module; the remaining `files` mutation logic is concentrated in rename/move/delete plus reconcile/status shell code
- `files` rename/move/delete is now also extracted as an explicit file-operations boundary; remaining `files` store logic is mostly state shell and reconcile/watch/bootstrap glue
- `workspace` automation/runtime orchestration is now extracted; remaining `workspace` store pressure has shifted to GitHub session lifecycle, settings/instructions IO, and bootstrap/watch sequencing
- `workspace` GitHub session lifecycle is now also extracted; the remaining `workspace` store pressure has shifted to settings/instructions IO plus bootstrap/watch sequencing
- `workspace` settings/instructions IO is now also extracted; the remaining `workspace` store pressure is concentrated in bootstrap/watch sequencing and a smaller preference-state shell
- `workspace` bootstrap/watch orchestration is now also extracted; the remaining `workspace` pressure is mostly a thinner preference/open-close shell rather than another large orchestration knot
- the next execution cycle should shift from `workspace` to the next large store rather than spending more time on lower-value preference wrappers

## Completed

- Replaced placeholder blueprint content with a truthful execution-oriented blueprint
- Identified the real primary frontend bottlenecks
- Identified the real primary backend bottlenecks
- Established `src/app/workspace/useWorkspaceLifecycle.js`
- Established `src/app/shell/useAppShellEventBridge.js`
- Established `src/app/changes/useWorkspaceHistoryActions.js`
- Established `src/app/teardown/useAppTeardown.js`
- Established `src/app/editor/useFooterStatusSync.js`
- Reduced `App.vue` substantially from its earlier monolithic role
- Established `src/domains/changes/workspaceHistory.js`
- Extracted `references` domain logic into:
  - `referenceMetadata.js`
  - `referenceWorkbench.js`
  - `referenceSearchExport.js`
  - `referenceImportMerge.js`
  - `referenceStorageIO.js`
- Extracted `editor` domain logic into:
  - `paneTreeLayout.js`
  - `paneTabs.js`
  - `editorSurfaces.js`
  - `editorPersistenceRuntime.js`
  - `editorViewRegistry.js`
  - `editorDirtyPersistence.js`
  - `editorInsertActions.js`
  - `editorCleanupRuntime.js`
  - `editorRestoreRuntime.js`
- Repeatedly validated migration slices with successful `npm run build`
- Audited `src/stores/files.js` and identified tree cache / workspace snapshot runtime as the first extraction slice
- Established `src/domains/files/fileTreeCacheRuntime.js`
- Moved `files` tree cache snapshotting, cached tree restore, and cached expanded-dir replay behind the new runtime module
- Reduced `src/stores/files.js` from 996 lines to 976 lines
- Validated the `files` slice with a fresh successful `npm run build`
- Established `src/domains/files/fileTreeRefreshRuntime.js`
- Moved loaded-directory traversal, tree snapshot diffing, and queued visible-tree refresh orchestration behind the new runtime module
- Reduced `src/stores/files.js` from 976 lines to 839 lines
- Added `tests/fileTreeRefreshRuntime.test.mjs` to validate merge/patch helpers and queued refresh behavior outside the Pinia store shell
- Validated the refresh/runtime slice with:
  - `node --test tests/fileTreeRefreshRuntime.test.mjs`
  - `npm run build`
- Established `src/domains/files/fileTreeWatchRuntime.js`
- Moved file-watch filtering, debounce handling, activity tracking, visibility-aware polling, and filesystem listener lifecycle behind the new runtime module
- Reduced `src/stores/files.js` from 839 lines to 749 lines
- Added `tests/fileTreeWatchRuntime.test.mjs` to validate `.git` filtering, debounced watch handling, and refresh triggering outside the Pinia store shell
- Removed the dead `treeCacheByWorkspace[workspacePath]?.flatFilesReady` gate in favor of `_flatFilesWorkspace`-based cache reuse
- Removed the unused `activeFilePath` state that no longer participates in the main file workflow
- Validated the watch/runtime and cleanup slices with:
  - `node --test tests/fileTreeRefreshRuntime.test.mjs tests/fileTreeWatchRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build` after the watch/runtime extraction
- Established `src/domains/files/fileTreeHydrationRuntime.js`
- Moved tree entry lookup, shallow root load, directory hydration, reveal/toggle expansion wiring, and post-mutation tree resync behind the new runtime module
- Reduced `src/stores/files.js` from 749 lines to 680 lines
- Added `tests/fileTreeHydrationRuntime.test.mjs` to validate nested entry lookup, directory-load promise coalescing, ancestor reveal expansion, and mutation-triggered tree resync outside the Pinia store shell
- Validated the hydration/runtime slice with:
  - `node --test tests/fileTreeHydrationRuntime.test.mjs tests/fileTreeRefreshRuntime.test.mjs tests/fileTreeWatchRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build`
- Established `src/domains/files/flatFilesIndexRuntime.js`
- Moved delayed recursive flat-file indexing, stale-generation suppression, and timer/promise lifecycle cleanup behind the new runtime module
- Reduced `src/stores/files.js` from 680 lines to 639 lines
- Added `tests/flatFilesIndexRuntime.test.mjs` to validate request coalescing, ready-cache reuse, stale workspace suppression, and timer cleanup outside the Pinia store shell
- Validated the flat-file indexing/runtime slice with:
  - `node --test tests/flatFilesIndexRuntime.test.mjs tests/fileTreeHydrationRuntime.test.mjs tests/fileTreeRefreshRuntime.test.mjs tests/fileTreeWatchRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build`
- Established `src/domains/files/fileContentRuntime.js`
- Moved PDF source-kind detection, PDF/text read behavior, save-path cache synchronization, and in-memory file-content updates behind the new runtime module
- Reduced `src/stores/files.js` from 639 lines to 583 lines
- Added `tests/fileContentRuntime.test.mjs` to validate PDF source-kind coalescing, PDF reload invalidation, text read failure handling, and save success/failure behavior outside the Pinia store shell
- Validated the content/runtime slice with:
  - `node --test tests/fileContentRuntime.test.mjs tests/flatFilesIndexRuntime.test.mjs tests/fileTreeHydrationRuntime.test.mjs tests/fileTreeRefreshRuntime.test.mjs tests/fileTreeWatchRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build`
- Established `src/domains/files/fileCreationRuntime.js`
- Moved create-file, duplicate, create-folder, and external-copy workspace entry creation flows behind the new runtime module
- `src/stores/files.js` ended at 587 lines after the extraction; the new runtime boundary landed, but the store shell grew slightly because the remaining rename/move/delete bridge code still dominates and now sits beside an additional runtime accessor
- Added `tests/fileCreationRuntime.test.mjs` to validate duplicate-name handling, forced folder hydration, and tree-sync behavior for duplicate/import flows outside the Pinia store shell
- Validated the entry-creation/import slice with:
  - `node --test tests/fileCreationRuntime.test.mjs tests/fileContentRuntime.test.mjs tests/flatFilesIndexRuntime.test.mjs tests/fileTreeHydrationRuntime.test.mjs tests/fileTreeRefreshRuntime.test.mjs tests/fileTreeWatchRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build`
- Established `src/domains/files/fileMutationRuntime.js`
- Moved rename, move, delete, cache migration, expanded-dir repair, and delete-race coordination behind the new runtime module
- Reduced `src/stores/files.js` from 587 lines to 579 lines
- Added `tests/fileMutationRuntime.test.mjs` to validate rename cache migration, move no-op/relocation behavior, and delete cleanup outside the Pinia store shell
- Validated the mutation/runtime slice with:
  - `node --test tests/fileMutationRuntime.test.mjs tests/fileCreationRuntime.test.mjs tests/fileContentRuntime.test.mjs tests/flatFilesIndexRuntime.test.mjs tests/fileTreeHydrationRuntime.test.mjs tests/fileTreeRefreshRuntime.test.mjs tests/fileTreeWatchRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build`
- Established `src/domains/workspace/workspaceAutomationRuntime.js`
- Moved workspace auto-commit, sync timer lifecycle, auto-sync/fetch/sync-now orchestration, and timer cleanup behind the new runtime module
- Reduced `src/stores/workspace.js` from 809 lines to 791 lines
- Added `tests/workspaceAutomationRuntime.test.mjs` to validate timer scheduling, committed auto-sync flow, remote fetch reload behavior, and cleanup outside the Pinia store shell
- Validated the workspace automation/runtime slice with:
  - `node --test tests/workspaceAutomationRuntime.test.mjs`
  - `npm run build`
- Established `src/domains/workspace/workspaceGitHubRuntime.js`
- Moved GitHub init/connect/disconnect/link/unlink state orchestration and sync-state application behind the new runtime module
- Reduced `src/stores/workspace.js` from 791 lines to 764 lines
- Added `tests/workspaceGitHubRuntime.test.mjs` to validate init, disconnect, link/unlink, and sync-state mapping outside the Pinia store shell
- Validated the workspace GitHub/runtime slice with:
  - `node --test tests/workspaceAutomationRuntime.test.mjs tests/workspaceGitHubRuntime.test.mjs`
  - `npm run build`
- Established `src/domains/workspace/workspaceSettingsRuntime.js`
- Moved workspace settings load, instructions migration/load/open, key/model persistence, tool-permission IO, and skills-manifest IO behind the new runtime module
- Reduced `src/stores/workspace.js` from 764 lines to 755 lines
- Added `tests/workspaceSettingsRuntime.test.mjs` to validate settings load, provider-model sync, instructions IO, and tool-permission persistence outside the Pinia store shell
- Validated the workspace settings/runtime slice with:
  - `node --test tests/workspaceAutomationRuntime.test.mjs tests/workspaceGitHubRuntime.test.mjs tests/workspaceSettingsRuntime.test.mjs`
  - `npm run build`
- Established `src/domains/workspace/workspaceBootstrapRuntime.js`
- Moved workspace bootstrap step sequencing, stale-generation guards, watch-directory registration, instructions listener lifecycle, usage kickoff, and auto-commit startup bridge behind the new runtime module
- Reduced `src/stores/workspace.js` from 755 lines to 727 lines
- Added `tests/workspaceBootstrapRuntime.test.mjs` to validate step order, stale bootstrap cancellation, listener refresh, and listener-failure resilience outside the Pinia store shell
- Validated the workspace bootstrap/runtime slice with:
  - `node --test tests/workspaceAutomationRuntime.test.mjs tests/workspaceGitHubRuntime.test.mjs tests/workspaceSettingsRuntime.test.mjs tests/workspaceBootstrapRuntime.test.mjs`
  - `node --test tests/*.test.mjs`
  - `npm run build`

## Blocked / Risks

- Workspace open/close still touches multiple stores and services, so careless reordering can introduce regressions
- Auto-commit and history/version flows are still coupled
- `PdfViewer.vue` remains extremely large and highly coupled, but is not yet the best next target
- Validation is still heavily dependent on build checks and manual confidence rather than systematic tests
- `references` still retains watcher/self-write/load-generation/state-sync responsibilities that should eventually move into clearer infra/runtime boundaries
- `files` may already have partial helper boundaries (`fileStoreIO` / `fileStoreEffects`) that can either help the migration or hide remaining coupling
- `files` refresh runtime remains more coupled than cache/snapshot state; pulling refresh logic first would widen blast radius compared with extracting the cache/runtime boundary
- `files` now delegates visible-tree refresh execution, watch/poll lifecycle orchestration, tree hydration/loading, flat-file indexing, file content/PDF handling, entry-creation/import flows, and rename/move/delete coordination to domain runtimes; the store is no longer the clearest next extraction target
- `workspace` now delegates automation, GitHub session lifecycle, settings/instructions IO, and bootstrap/watch sequencing to domain runtimes; the remaining store shell is thinner but still not minimal
- The remaining `workspace` logic is lower-value than before, so there is risk of slipping into cosmetic preference-wrapper extraction instead of moving to the next genuinely large store
- Backend flattening is still untouched and could become harder if frontend assumptions harden further
- The architecture docs are still missing even though frontend domain boundaries are now multiplying; this remains a shared-understanding risk

## Next Recommended Slice

1. Audit `src/stores/terminal.js` and identify the smallest high-value orchestration seam that can move without entangling the entire terminal surface
2. Prefer extracting terminal session/watch/process lifecycle or command-routing orchestration before touching cosmetic terminal UI state
3. Keep `workspace` where it is for now; remaining preference/open-close wrappers are no longer the best Phase 2 leverage
4. Validate the first terminal slice with focused runtime tests plus `node --test tests/*.test.mjs` and `npm run build`
5. Update this blueprint based on the actual migration result and then decide whether the next large target stays in `terminal` or shifts to `chat`

## Validation Checklist

- [x] Blueprint reflects the current repository state
- [x] App-layer boundary extraction is documented
- [x] `App.vue` responsibility has materially shrunk
- [x] `references` first-round split is documented
- [x] `editor` first-round split is documented
- [x] current bottlenecks are explicitly named
- [x] next recommended slice is explicit
- [x] `files` refresh/runtime extraction is documented truthfully
- [x] `files` watch/runtime extraction is documented truthfully
- [x] `files` hydration/runtime extraction is documented truthfully
- [x] `files` flat-file indexing/runtime extraction is documented truthfully
- [x] `files` content/runtime extraction is documented truthfully
- [x] `files` entry-creation/import runtime extraction is documented truthfully
- [x] `files` mutation/runtime extraction is documented truthfully
- [x] `workspace` automation/runtime extraction is documented truthfully
- [x] `workspace` GitHub/runtime extraction is documented truthfully
- [x] `workspace` settings/runtime extraction is documented truthfully
- [x] `workspace` bootstrap/runtime extraction is documented truthfully
- [ ] core architecture docs have been created
- [ ] safety model has been documented as a first-class system
- [x] testing/validation story is stronger than build-only checks for the current `files` and `workspace` slices
- [ ] backend layering migration has begun

## Migration Notes

- The refactor correctly began by reducing root-level orchestration before attacking every large store at once.
- `references` was a good first store/domain split because it allowed meaningful logic extraction without immediately entangling the entire workspace lifecycle.
- `editor` was a reasonable second large split, and it now appears to be past the highest-value extraction stage for the current phase.
- `files` was the highest-value target through the runtime extraction sequence, but after the mutation slice landed it is no longer the clearest bottleneck.
- After the refresh/runtime extraction, `files` still contains a second narrow orchestration seam around watch/poll scheduling and activity hooks; that is the best candidate if we continue in the same domain.
- After the watch/runtime extraction, the highest-value remaining `files` slice is tree hydration/loading rather than more watch logic.
- After the hydration/runtime extraction, the highest-value remaining `files` slice is flat-file indexing/runtime rather than immediately widening into workspace-level orchestration.
- After the flat-file indexing/runtime extraction, the highest-value remaining `files` slice is content/PDF handling rather than mutation-side cross-store coordination.
- After the content/runtime extraction, the highest-value remaining `files` slice is entry creation/import handling rather than rename/move/delete coordination.
- After the entry-creation/import extraction, the next remaining `files` slice was rename/move/delete coordination; that slice has now landed as `fileMutationRuntime`.
- The entry-creation/import slice improved boundary clarity more than raw line count; the store did not get smaller in that cycle because the remaining rename/move/delete bridge code still dominated.
- With rename/move/delete extracted, `files` is now mostly a thinner shell around state, reconcile status, and runtime accessors; the next high-value store reduction has shifted to `workspace`.
- The first `workspace` slice should target timer/runtime orchestration before bootstrap or settings loading because it has a narrower blast radius and can be tested without reopening workspace bootstrap sequencing.
- The first three `workspace` slices have now landed in the expected order: automation/timers first, then GitHub session lifecycle, then settings/instructions IO.
- The fourth `workspace` slice has now landed as `workspaceBootstrapRuntime`, so the remaining `workspace` logic is mostly a thinner shell plus preference/open-close wrappers.
- After four `workspace` slices, `src/stores/workspace.js` is down to 727 lines and is no longer the clearest next large-store target.
- Preference toggles remain in the store, but they are now lower-value than shifting to `terminal` because they are mostly direct state wrappers and do not carry the same orchestration risk.
- The repository can now validate `files` runtime slices with focused `node:test` coverage instead of relying on build-only confidence.
- The repository can now also validate `workspace` runtime slices with focused `node:test` coverage instead of relying on build-only confidence for sync/settings/bootstrap behavior.
- `PdfViewer.vue` is large enough to deserve future attention, but it should not displace the more structurally important `files` migration unless product work proves otherwise.
- Missing documentation is now a repository-level risk, not just a nice-to-have, because the codebase is accumulating new boundaries without a matching shared architectural map.
- Safety model separation should become a first-class implementation effort soon after the next store-boundary slice, especially because current history/version flows still imply Git-coupled safety behavior.
