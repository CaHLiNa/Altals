# Domains

## Purpose

This document records the current domain map in Altals.

It focuses on the domain/runtime boundaries that already exist today and the major missing ones.

## Current Frontend Domain Map

### `src/app`

App-layer orchestration close to the shell:

- `src/app/workspace/*`
- `src/app/shell/*`
- `src/app/editor/*`
- `src/app/changes/*`
- `src/app/teardown/*`

This layer is not a domain itself. It bridges the shell/UI to domain runtimes and stores.

### `src/domains/document`

Current responsibility:

- preview/open/reconcile
- build execution
- diagnostics/status visibility
- Typst preview/pdf shared-pane state
- document-toolbar AI diagnose/fix launch

### `src/domains/changes`

Current responsibility:

- explicit history availability/preparation/message/commit/history-point intent
- snapshot record/metadata/manifest mapping
- local workspace save-point indexing and payload restore
- workspace preview/diff/apply/delete behavior
- file version history runtime

This is the strongest current safety-model domain.

### `src/domains/files`

Current responsibility:

- file tree cache, refresh, hydration, watch, and flat-file index
- file content read/save and PDF handling
- create/import/rename/move/delete coordination
- shared workspace text-file limits used by save-point capture

### `src/domains/editor`

Current responsibility:

- pane tree/layout
- pane tabs
- editor open routing
- editor persistence/restore
- cleanup
- insert actions
- view registry
- dirty persistence

### `src/domains/reference`

Current responsibility:

- library/workbench/workspace persistence
- load sequencing
- legacy migration
- workspace/global membership view
- CRUD/import/update/merge
- asset storage/removal
- search/export/metadata helpers

### `src/domains/chat`

Current responsibility:

- live instance management
- message shaping/sending
- persistence
- runtime config
- session lifecycle
- title generation

### `src/domains/terminal`

Current responsibility:

- execution
- hydration
- instance lifecycle
- log routing
- session teardown

### `src/domains/workspace`

Current responsibility:

- automation timers
- bootstrap/watch sequencing
- GitHub session lifecycle
- settings/instructions IO

### `src/domains/git`

Current responsibility:

- local history bootstrap plus remote-link preparation ordering

Current file:

- `workspaceRepoLinkRuntime.js`

## Supporting Non-Domain Areas

### `src/services`

This layer still contains:

- AI launch and workflow services
- compiler/build adapters
- notebook/chunk execution helpers
- filesystem/process helpers
- other effectful integrations

It is broader than the target architecture and still contains several de facto subdomains.

### `src/stores`

Stores now mostly act as:

- migration shells
- UI state holders
- adapters into domain runtimes

They still matter, but they are no longer the only architecture boundary.

### `src/components` and `src/composables`

This is where UI surfaces live, but too much workflow logic can still leak back in if the domains are not strengthened.

## Current Missing Domain Boundaries

### Missing `src/domains/ai`

There is still no landed `src/domains/ai` family.

AI behavior currently spans:

- `src/services/ai/*`
- `src/stores/aiWorkflowRuns.js`
- several UI entry surfaces
- `src/domains/document/documentWorkflowAiRuntime.js`

### Missing `src/domains/execution` or `src/domains/notebook`

Notebook and computation behavior currently spans:

- `src/components/editor/NotebookEditor.vue`
- `src/stores/kernel.js`
- `src/stores/environment.js`
- `src/services/chunkKernelBridge.js`
- `src/services/notebookDocument.js`
- `src-tauri/src/kernel.rs`

That means Altals already supports notebook/kernel-backed computation, but it does not yet expose it through one explicit frontend domain boundary.

## Backend Domain Status

The Rust backend does not yet follow the target domain/core/service layering.

Current backend modules are still flat under `src-tauri/src/`.

## Domain Migration Notes

Current important migration truths:

- many stores are now thinner shells around `src/domains/*`
- document workflow and workspace save points are the clearest extracted runtime seams
- terminal is better domainized than notebook execution today
- AI and notebook/execution are the clearest missing domain-shape gaps
