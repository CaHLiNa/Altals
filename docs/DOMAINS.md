# Domains

The `src/domains` directory holds product rules and reusable runtime decisions that should stay out of components.

## Why this layer exists

Use domains for product policy that needs to be shared across stores, components, or services.

A good domain module usually:

- accepts explicit inputs instead of reading UI directly
- returns normalized state or decisions
- keeps policy out of components
- avoids becoming a thin wrapper around one store method

## Current domain areas

### `src/domains/document/*`

Owns document workflow capabilities, preview/build actions, adapter resolution, diagnostics, and workspace preview state.

Representative files:

- `documentWorkflowRuntime.js`
- `documentWorkflowAdaptersRuntime.js`
- `documentWorkflowBuildRuntime.js`
- `documentWorkspacePreviewRuntime.js`

### `src/domains/files/*`

Owns file tree hydration, refresh, creation, mutation, watches, file content behavior, and workspace text indexing.

Representative files:

- `fileTreeHydrationRuntime.js`
- `fileTreeRefreshRuntime.js`
- `fileCreationRuntime.js`
- `fileMutationRuntime.js`
- `fileContentRuntime.js`

### Future `src/domains/references/*`

Owns project-scoped reference policy, citation insertion decisions, bibliography planning, reference filtering, and other reusable academic writing rules that should not live in components or stores.

Representative future files:

- `referenceLibraryRuntime.js`
- `citationInsertionRuntime.js`
- `bibliographyPlanningRuntime.js`
- `referenceFilterRuntime.js`

### `src/domains/editor/*`

Owns editor open/persist/restore behavior, pane layout, tab behavior, runtime view registration, and cleanup.

Representative files:

- `editorOpenRoutingRuntime.js`
- `editorPersistenceRuntime.js`
- `paneTreeLayout.js`
- `paneTabs.js`
- `editorRestoreRuntime.js`

### Future `src/domains/reader/*`

Owns reader session policy, source-to-draft navigation decisions, inspection behavior for reading context, and annotation rules that should be shared across components and stores.

Representative future files:

- `readerSessionRuntime.js`
- `readerNavigationRuntime.js`
- `readerInspectionRuntime.js`
- `annotationMappingRuntime.js`

### `src/domains/changes/*`

Owns workspace snapshots, local save points, visibility filtering, diff/preview/apply behavior, version history, and history preparation.

Representative files:

- `workspaceSnapshotRuntime.js`
- `workspaceLocalSnapshotStoreRuntime.js`
- `workspaceSnapshotPreviewRuntime.js`
- `workspaceVersionHistoryRuntime.js`
- `workspaceHistoryPreparationRuntime.js`

### `src/domains/workspace/*`

Owns workspace bootstrap, starter metrics, automation, and workspace-level GitHub flows.

Representative files:

- `workspaceBootstrapRuntime.js`
- `workspaceStarterMetrics.js`
- `workspaceAutomationRuntime.js`
- `workspaceGitHubRuntime.js`

### `src/domains/git/*`

Owns workspace repository linking behavior.

Representative file:

- `workspaceRepoLinkRuntime.js`

## Practical boundary rules

- put cross-component product decisions in `domains`
- keep direct filesystem/process/network effects in `services`
- keep Pinia stores focused on state ownership and coordination
- keep Vue components focused on rendering and emitting user intent
- keep reference, citation, and reader policy out of components even when the UI feels "sidebar-shaped"

## Signs logic belongs in a domain

- the same decision is needed by both a store and a component
- a workflow has multiple valid states that need one normalized answer
- the code is defining product behavior rather than performing an effect
- tests can describe the logic without mounting UI
- the feature needs to adapt differently for Markdown, LaTeX, and Typst without duplicating UI conditionals
- the feature coordinates files, references, and readers under one writing task

## Validation anchors

A large share of the repository tests target domain runtime files directly. Representative examples:

- `tests/documentWorkflow*.test.mjs`
- `tests/fileTreeHydrationRuntime.test.mjs`
- `tests/editorOpenRoutingRuntime.test.mjs`
- `tests/workspaceSnapshot*.test.mjs`

When references, citation, or reader domains are added, they should follow the same pattern: policy-heavy runtime tests first, UI tests second.

## See also

- `docs/ARCHITECTURE.md`
- `docs/ACADEMIC_PLATFORM_DIRECTION.md`
- `docs/DOCUMENT_WORKFLOW.md`
- `docs/TESTING.md`
