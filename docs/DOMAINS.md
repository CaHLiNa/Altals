# Domains

## Purpose

This document records the current domain map in Altals.

It focuses on the domain/runtime boundaries that already exist in the repository today.

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
- typst preview/pdf shared-pane state
- document-toolbar AI diagnose/fix launch

Key files:

- `documentWorkflowRuntime.js`
- `documentWorkflowBuildRuntime.js`
- `documentWorkflowBuildOperationRuntime.js`
- `documentWorkflowTypstPaneRuntime.js`
- `documentWorkflowActionRuntime.js`
- `documentWorkflowAiRuntime.js`

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

- file tree cache, refresh, hydration, watch, flat-file index
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
- document workflow adapters
- Latex/Typst helpers
- terminal helpers
- other effectful integrations

`src/services` is still broader than the target architecture and still contains some de facto subdomains.

### `src/stores`

Stores now mostly act as:

- migration shells
- UI state holders
- adapters into domain runtimes

They still matter, but they are no longer the only architecture boundary.

### `src/components` and `src/composables`

This is still where UI surfaces live, but more orchestration has now moved behind domain runtimes.

## Current Missing Domain Boundary

There is still no landed `src/domains/ai` family.

AI behavior currently spans:

- `src/services/ai/*`
- `src/stores/aiWorkflowRuns.js`
- a few UI entry surfaces
- `src/domains/document/documentWorkflowAiRuntime.js`

This is one of the clearest remaining domain-shape gaps.

## Backend Domain Status

The Rust backend does not yet follow the target domain/core/service layering.

Current backend modules are still flat under `src-tauri/src/`.

## Domain Migration Notes

Current important migration truths:

- many stores are now thinner shells around `src/domains/*`
- document workflow and workspace save points are the clearest current examples of extracted runtime seams
- AI launch entry points remain split across multiple surfaces, so AI is only partially domainized today
