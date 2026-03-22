# Architecture

## Purpose

This document records the current repository architecture of Altals.

It describes the current system truthfully. It does not present the target architecture as if it has already landed.

## Current Top-Level Shape

The repository currently has these major layers:

- `src/app`
- `src/domains/*`
- `src/services/*`
- `src/stores/*`
- `src/components/*`
- `src/composables/*`
- `src-tauri/src/*`

The frontend has already moved toward domain/runtime seams, but the backend is still comparatively flat.

## Frontend Layers

### `src/app`

`src/app` now carries app-facing orchestration hooks that sit close to the shell:

- workspace lifecycle
- shell event bridge
- teardown handling
- footer status sync
- workspace snapshot prompt/actions

This layer is much thinner than the old `App.vue`-centric structure, but it is not yet a full operation layer.

### `src/domains`

`src/domains/*` is the strongest current architecture direction.

The most established runtime seams today are:

- `src/domains/document/*`
- `src/domains/changes/*`
- `src/domains/files/*`
- `src/domains/reference/*`
- `src/domains/chat/*`
- `src/domains/terminal/*`
- `src/domains/workspace/*`
- `src/domains/editor/*`
- `src/domains/git/*`

These modules now carry most of the extracted orchestration that previously lived in large stores and UI glue.

### `src/services`

`src/services/*` still owns many cross-domain helpers and effectful integrations, especially:

- AI launch/session wiring
- document workflow adapters
- Latex/Typst integration
- workspace/system access helpers

This layer is still broader and flatter than the target architecture, but it now sits under more explicit domain/runtime seams than before.

### `src/stores`

Stores are increasingly migration shells plus UI state holders.

They are still important, but they are no longer the only place where business logic lives.

Current remaining large store-heavy bottlenecks include:

- `src/stores/latex.js`
- `src/stores/pdfTranslate.js`
- `src/stores/reviews.js`

### `src/components` and `src/composables`

UI code still carries glue and presentation concerns.

The most important recent architectural improvement is that major document workflow decisions no longer live primarily inside `src/composables/useEditorPaneWorkflow.js`.

## Current Strongest Landed Seams

### Document Loop

The document loop is now split across explicit runtimes:

- `src/domains/document/documentWorkflowRuntime.js`
- `src/domains/document/documentWorkflowBuildRuntime.js`
- `src/domains/document/documentWorkflowBuildOperationRuntime.js`
- `src/domains/document/documentWorkflowTypstPaneRuntime.js`
- `src/domains/document/documentWorkflowActionRuntime.js`
- `src/domains/document/documentWorkflowAiRuntime.js`

`src/stores/documentWorkflow.js` is now primarily a migration shell exposing those seams to the UI.

### Change / Snapshot / History

The clearest safety-model architecture is now in `src/domains/changes/*`:

- explicit history availability, preparation, message, commit, and history-point intent runtimes
- Git-backed snapshot mapping plus metadata and manifest seams
- local workspace save-point index and payload runtimes
- workspace preview/diff/apply/delete runtimes
- Git-backed file version history runtime kept separate from workspace save-point restore

### Store Reduction Work

Large slices of `files`, `references`, `chat`, `terminal`, `workspace`, and `editor` have already moved into domain runtimes.

This means the repository now has a real runtime-oriented architecture, even though stores and services still remain broader than the target state.

## Backend Shape

The Rust/Tauri backend is still comparatively flat.

Current modules live directly under `src-tauri/src/`, including:

- `fs_commands.rs`
- `git.rs`
- `latex.rs`
- `pty.rs`
- `tinymist.rs`
- `typst_export.rs`
- `workspace_access.rs`

`src-tauri/src/lib.rs` still wires many commands and protocol helpers directly from this flat module layout.

The backend has not yet been migrated into the target `commands/core/services/models/errors` layering.

## Main Current Architectural Boundaries

The current practical architecture can be summarized like this:

- app hooks choose top-level shell actions
- domain runtimes own the best current orchestration seams
- services provide effectful helpers and cross-domain integration glue
- stores bridge UI state into those runtimes
- components and composables render UI and invoke store/app actions
- the Rust backend still exposes a flatter command/module surface than the frontend target shape

## Remaining Direct AI Launch Surfaces

The document workflow toolbar is now behind `documentWorkflowAiRuntime`, but direct AI launch calls still exist in these files:

- `src/components/ai/AiQuickPanel.vue`
- `src/components/ai/AiWorkbenchHome.vue`
- `src/components/chat/ChatSession.vue`
- `src/components/editor/AiLauncher.vue`
- `src/components/editor/NotebookEditor.vue`
- `src/components/editor/ReferenceView.vue`
- `src/components/sidebar/ReferenceList.vue`
- `src/services/commentActions.js`

Direct `launchWorkflowTask(...)` callers still exist in:

- `src/components/ai/AiQuickPanel.vue`
- `src/components/ai/AiWorkbenchHome.vue`
- `src/components/editor/AiLauncher.vue`

These are the clearest current cleanup targets for the next AI-operation tightening pass.

## Current Migration Shells And Deletion Targets

The main near-term bridge/deletion targets are:

- `src/stores/documentWorkflow.js`
  It is now a runtime-backed migration shell rather than the real orchestration home.
- `src/composables/useEditorPaneWorkflow.js`
  It still carries thin compile-button and toolbar glue even after the major document seams were extracted.
- remaining direct AI launch callers listed above
  They should eventually route through clearer app/domain seams instead of constructing launch payloads inline.

These are not all safe to delete immediately, but they are now explicit cleanup targets instead of hidden leftovers.

## Current Architecture Risks

The biggest current architecture risks are:

- the backend is still flat while frontend domain seams are multiplying
- some large stores and UI components remain coupled
- AI launch entry points are still distributed outside one shared operation seam
- architecture docs can become stale again if future refactor slices land without updating them
