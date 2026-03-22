# AI System

## Purpose

This document records the current AI workflow system in Altals.

It describes the repository as it exists today. It does not describe a target AI architecture as if it has already landed.

## Current Truth

Altals does not yet have a single `src/domains/ai` boundary or one shared `RunAiWorkflow` operation.

Current AI behavior is split across:

- task descriptors in `src/services/ai/taskCatalog.js`
- launch/session wiring in `src/services/ai/launch.js`
- workflow templates and executor state in `src/services/ai/workflowRuns/templates.js` plus `src/stores/aiWorkflowRuns.js`
- app/UI entry points that choose which task to launch

The current system is already more disciplined than a direct-action assistant:

- TeX / Typst compile diagnosis uses the `compile.tex-typ-diagnose` workflow template and does not request file edits by default
- TeX / Typst compile fixes use the `compile.tex-typ-fix` workflow template and pause at `apply_patch` approval before edits land
- draft review, notebook assistant, and reference maintenance workflows also stop at explicit approval checkpoints before edit/import actions

This means Altals already has narrow proposal-first AI workflows, but its launch entry points are still distributed.

## Current Components

### Task Catalog

`src/services/ai/taskCatalog.js` currently owns task-descriptor construction.

Important current document-scoped entries:

- `createTexTypDiagnoseTask(...)`
- `createTexTypFixTask(...)`

These descriptors preserve:

- `workflowTemplateId`
- `taskId`
- `role`
- `toolProfile`
- `artifactIntent`
- launcher/source metadata such as `source` and `entryContext`

### Launch Service

`src/services/ai/launch.js` currently owns:

- session creation / reuse
- workflow-run startup
- foreground/drawer/workbench chat opening
- task prompt/file-ref shaping
- `prepareTexTypFixTask(...)` pre-launch preparation for TeX / Typst fix workflows

Current public entry points include:

- `launchAiTask(...)`
- `launchWorkflowTask(...)`
- `startWorkflowRun(...)`

This is the main app-wide AI launch boundary today.

### Workflow Templates And Executor

`src/services/ai/workflowRuns/templates.js` plus `src/stores/aiWorkflowRuns.js` currently own:

- workflow template definitions
- approval/checkpoint semantics
- executor progress and run/session synchronization

Current TeX / Typst workflow truth:

- `compile.tex-typ-diagnose` stops after diagnosis and summary, with no edit approval step
- `compile.tex-typ-fix` proceeds through diagnosis and patch generation, then pauses at `apply_patch`

### Document AI Entry Seam

`src/domains/document/documentWorkflowAiRuntime.js` now owns the document-scoped AI launch routing used by the document workflow toolbar.

Current methods:

- `launchDiagnoseForFile(...)`
- `launchFixForFile(...)`

Current behavior:

- only `.tex` / `.latex` / `.typ` files are eligible
- launch still routes through the shared `launchAiTask(...)` service
- task creation still reuses the existing task catalog
- launch metadata stays `source: 'document-workflow'` and `entryContext: 'document-workflow'`
- fix workflows keep their patch-first semantics because the runtime does not bypass the shared workflow templates or approval steps

`src/stores/documentWorkflow.js` now exposes that seam to the UI through:

- `launchWorkflowDiagnoseWithAiForFile(...)`
- `launchWorkflowFixWithAiForFile(...)`

`src/composables/useEditorPaneWorkflow.js` no longer builds those tasks or calls `launchAiTask(...)` directly.

## Current Safe Flows

### Compile Diagnose

Current user path:

1. click `Diagnose with AI` in document workflow UI
2. document workflow AI runtime creates `compile.tex-typ-diagnose`
3. launch service starts a workflow-bound AI session
4. workflow executor runs diagnosis steps
5. no file edit path is taken by default

### Compile Fix

Current user path:

1. click `Fix with AI` in document workflow UI
2. document workflow AI runtime creates `compile.tex-typ-fix`
3. launch service prepares and starts the workflow
4. workflow executor diagnoses and generates a proposed patch
5. workflow pauses at `apply_patch` approval before edits land

This is the clearest currently landed patch-first AI workflow in the document loop.

## Current Gaps

The main remaining gaps are:

- there is still no single shared `RunAiWorkflow` operation boundary used by every AI entry point
- many other UI/domain surfaces still call `launchAiTask(...)` or `launchWorkflowTask(...)` directly
- there is still no dedicated `src/domains/ai` module family; AI boundaries are split between services, stores, and a few domain-specific runtimes
- context shaping and launch decisions are still partly distributed across feature entry points

Important remaining direct `launchAiTask(...)` callers currently include:

- `src/components/ai/AiQuickPanel.vue`
- `src/components/ai/AiWorkbenchHome.vue`
- `src/components/chat/ChatSession.vue`
- `src/components/editor/AiLauncher.vue`
- `src/components/editor/NotebookEditor.vue`
- `src/components/editor/ReferenceView.vue`
- `src/components/sidebar/ReferenceList.vue`
- `src/services/commentActions.js`

Important remaining direct `launchWorkflowTask(...)` callers currently include:

- `src/components/ai/AiQuickPanel.vue`
- `src/components/ai/AiWorkbenchHome.vue`
- `src/components/editor/AiLauncher.vue`

The repository now also has a lightweight audit test in `tests/aiLaunchBoundaryAudit.test.mjs` so this direct-caller inventory does not drift silently after the document workflow seam landed.

These are real remaining seams, not yet-completed architecture.
