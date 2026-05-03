# ScribeFlow Architecture Boundary Map

> Snapshot date: 2026-05-02.
> Purpose: make current mixed responsibilities visible before deeper runtime/module cleanup.

## Target Layer Contract

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| Vue components | UI rendering, form drafts, local interaction state, loading/error/empty presentation | Tauri calls, filesystem authority, persisted schema decisions, runtime execution policy |
| Composables | UI interaction helpers and component-level event wiring | Native bridge calls, backend policy, persisted state normalization |
| Pinia stores | Screen state, orchestration, loading/error lifecycle, calls into services | Filesystem validation, reference merge policy, runtime execution, persisted schema authority |
| `src/domains` | Pure display rules, sorting, labels, deterministic UI state derivation | Tauri calls, service/store imports, persistence, process or filesystem authority |
| `src/services` | Tauri/plugin bridge, native event subscription, DTO mapping | Long-lived business state, backend policy, duplicate frontend backend centers |
| `src-tauri/src` | Filesystem, workspace access, persistence, normalization, imports, runtime execution, plugins, security | UI rendering and transient screen layout state |

Canonical layer shorthand used in repository docs:

| Layer | Responsibility |
| --- | --- |
| Vue UI | render surfaces, receive props, emit user intent, show loading/error/empty states |
| JS bridge | `src/services` wraps Tauri commands, plugins, native events and DTO compatibility |
| Pinia coordination | `src/stores` owns screen state, orchestration, loading/error lifecycle and service calls |
| JS domains | `src/domains` owns pure presentation rules, labels, sorting and deterministic state derivation |
| Rust runtime | `src-tauri/src` owns filesystem, workspace state, references, runtime execution, persistence, plugins and security |

Allowed/disallowed examples:

- Allowed: `ReferenceDetailPanel.vue` maintains local draft fields and emits save intent; `src/stores/references.js` calls `referenceRuntime.applyMutation`; Rust validates, normalizes and persists the resulting reference.
- Disallowed: Vue components write normalized reference records directly.
- Allowed: a service wrapper invokes a Rust command such as `references_mutation_apply` and maps frontend camelCase DTO fields to the command payload.
- Disallowed: a service wrapper owns reference merge policy, workspace security, plugin host lifecycle, or persisted settings schema decisions.
- Allowed: a store performs optimistic UI updates only when Rust returns a normalized final state afterward.
- Disallowed: a store parses files, validates filesystem authority, executes LaTeX/Python runtime work, or becomes a replacement backend.

Command contract:

- Tauri command name, parameter shape, response JSON shape, store action contract, and persisted state shape are compatibility boundaries.
- Any command payload shape change must update Rust command handling, JS bridge DTO mapping, store call sites, and regression verification in the same commit.
- Existing command names should not be renamed during cleanup unless a dedicated compatibility phase is added.
- Compatibility shims must be explicit and scheduled for removal when they are not required by persisted data or stable bridge contracts.

## Editor Freeze

These files are frozen during global module reorganization unless a separate editor phase is explicitly approved:

- `src/editor/**`
- `src/components/editor/TextEditor.vue`
- `src/components/editor/EditorPane.vue`
- `src/components/editor/EditorTextRouteSurface.vue`
- `src/components/editor/EditorTextWorkspaceSurface.vue`
- `src/components/editor/PaneContainer.vue`
- `src/composables/useTextEditorBridges.js`
- `src/stores/editor.js`
- `src/services/editorPersistence.js`
- `src-tauri/src/editor_session_runtime.rs`

Allowed work around the editor boundary:

- Read frozen files to understand contracts.
- Preserve editor-facing props, events, store actions, and persistence payloads.
- Add external guards or docs that protect editor imports.

Blocked work:

- CodeMirror extension changes.
- Cursor, selection, reveal, scroll, fold, autocomplete, snippet, citation insertion, or text interaction changes.
- Editor saved session shape or event timing changes.

## Native Bridge Import Inventory

Current scan result: all direct `@tauri-apps/**` imports are inside `src/services/**`.

Service files with direct Tauri or plugin usage:

- `src/services/appDirs.js`
- `src/services/appUpdater.js`
- `src/services/documentOutline/runtime.js`
- `src/services/documentWorkflow/invokeBridge.js`
- `src/services/editorPersistence.js`
- `src/services/extensions/extensionArtifacts.js`
- `src/services/extensions/extensionCommands.js`
- `src/services/extensions/extensionHost.js`
- `src/services/extensions/extensionHostEvents.js`
- `src/services/extensions/extensionRegistry.js`
- `src/services/extensions/extensionTasks.js`
- `src/services/extensions/extensionViews.js`
- `src/services/extensions/extensionWindowUi.js`
- `src/services/externalLinks.js`
- `src/services/fileStoreIO.js`
- `src/services/fileTreeSystem.js`
- `src/services/i18nRuntime.js`
- `src/services/imagePreview.js`
- `src/services/latex/latexWorkshopSynctex.js`
- `src/services/latex/projectGraph.js`
- `src/services/latex/runtime.js`
- `src/services/latexPreferences.js`
- `src/services/localFileOpen.js`
- `src/services/markdown/runtimeBridge.js`
- `src/services/nativeClipboard.js`
- `src/services/nativeDialog.js`
- `src/services/nativeWindow.js`
- `src/services/pathStatus.js`
- `src/services/pdf/artifactPreview.js`
- `src/services/pythonPreferences.js`
- `src/services/pythonRuntime.js`
- `src/services/references/bibtexExport.js`
- `src/services/references/citationFormatter.js`
- `src/services/references/crossref.js`
- `src/services/references/pdfMetadata.js`
- `src/services/references/referenceAssets.js`
- `src/services/references/referenceImport.js`
- `src/services/references/referenceLibraryIO.js`
- `src/services/references/referenceRuntime.js`
- `src/services/references/zoteroSync.js`
- `src/services/transientOverlayBus.js`
- `src/services/workbenchDockPages.js`
- `src/services/workbenchLayout.js`
- `src/services/workspacePermissions.js`
- `src/services/workspacePreferences.js`
- `src/services/workspaceRecents.js`

Guard status:

- `scripts/check-ui-bridges.mjs` fails if any non-service frontend file imports Tauri APIs or Tauri plugins.
- `scripts/check-js-layer-boundaries.mjs` reports domain modules that still import service/store modules. This is currently a warning because several existing document/editor domain modules are legacy mixed coordination surfaces scheduled for later phases.

## Domain Boundary Debt

Current `src/domains/**` modules with service dependencies:

| File | Current dependency | Cleanup direction |
| --- | --- | --- |
| `src/domains/editor/editorPersistenceRuntime.js` | `src/services/editorPersistence.js` | Frozen editor-adjacent debt; preserve behavior until a separate editor/session phase. |
| `src/domains/editor/editorRestoreRuntime.js` | `src/services/editorPersistence.js` | Frozen editor-adjacent debt; do not change during this reorganization unless payload compatibility is proven externally. |

No `src/domains/**` file currently imports `@tauri-apps/**` directly.

## Service Inventory

Service files over 150 lines require later bridge-thinning review:

| File | Lines | Classification | Follow-up |
| --- | ---: | --- | --- |
| `src/services/appUpdater.js` | 153 | Bridge-heavy with event mapping | Keep as service; ensure no persisted policy creeps in. |
| `src/services/documentWorkflow/adapters/latex.js` | 299 | Mixed runtime adapter | Phase 6 should move compile/runtime policy to Rust or store orchestration. |
| `src/services/latex/latexWorkshopSynctex.js` | 425 | Mixed SyncTeX bridge and parsing helpers | Phase 6 should move scope-sensitive lookup/parsing to Rust where feasible. |
| `src/services/latex/previewSync.js` | 163 | UI/runtime sync adapter | Keep presentation sync frontend-owned; audit for backend policy. |
| `src/services/markdown/preview.js` | 312 | Browser preview presentation service | Keep DOM presentation here only; parsing contracts should stay Rust-backed where available. |
| `src/services/pdf/artifactPreview.js` | 179 | PDF artifact bridge and DTO adapter | Keep file authority in Rust; document DTO compatibility. |
| `src/services/references/zoteroSync.js` | 179 | Reference bridge with sync DTO helpers | Phase 5 should keep Zotero policy Rust-owned. |
| `src/services/workspacePreferences.js` | 499 | Mixed settings DTO/default normalization | Phase 4 should move persisted defaults and normalization to Rust. |

## Large Vue Component Inventory

Components over 500 lines:

| File | Lines | Classification |
| --- | ---: | --- |
| `src/components/editor/CitationPalette.vue` | 715 | Editor-adjacent UI; avoid during global cleanup unless citation UI phase is opened. |
| `src/components/editor/EditorPane.vue` | 1086 | Frozen editor file. |
| `src/components/editor/MarkdownPreview.vue` | 802 | Preview UI with document runtime wiring; Phase 6/8 candidate. |
| `src/components/editor/PdfEmbedDocumentSurface.vue` | 2030 | PDF/document runtime UI; Phase 8 extracted toolbar/search chrome while retaining embedpdf runtime authority. |
| `src/components/editor/PdfEmbedToolbar.vue` | 531 | PDF toolbar/search presentation; emits zoom/page/search/spread intent to parent. |
| `src/components/editor/TextEditor.vue` | 1962 | Frozen editor file. |
| `src/components/editor/WorkspaceStarter.vue` | 724 | Workspace starter UI; Phase 8 candidate if behavior remains stable. |
| `src/components/extensions/ExtensionSidebarPanel.vue` | 660 | Extension panel shell; Phase 8 extracted per-view rendering. |
| `src/components/extensions/ExtensionSidebarViewSection.vue` | 232 | Extension view section presentation for status, results, preview, and tree root. |
| `src/components/layout/WorkbenchRail.vue` | 631 | Layout UI; Phase 4/8 candidate after workbench state contracts settle. |
| `src/components/panel/ReferenceDetailPanel.vue` | 654 | Reference detail draft orchestration; Phase 8 extracted hero/metadata/content presentation. |
| `src/components/panel/ReferenceDetailContentSection.vue` | 132 | Reference abstract and notes disclosure presentation. |
| `src/components/panel/ReferenceDetailHero.vue` | 164 | Reference detail title/save hero presentation. |
| `src/components/panel/ReferenceDetailMetadataSection.vue` | 391 | Reference metadata, tags, collections, and file action presentation. |
| `src/components/references/ReferenceLibraryWorkbench.vue` | 844 | Reference workbench orchestration; Phase 8 extracted toolbar/table presentation. |
| `src/components/references/ReferenceLibraryTable.vue` | 237 | Reference library table presentation and sort header events. |
| `src/components/references/ReferenceLibraryToolbar.vue` | 131 | Reference library toolbar presentation. |
| `src/components/settings/Settings.vue` | 543 | Settings shell UI; Phase 4/8 candidate. |
| `src/components/settings/SettingsExtensions.vue` | 779 | Extension settings shell; Phase 8 extracted list/options UI and pure settings grouping. |
| `src/components/settings/SettingsExtensionList.vue` | 120 | Extension loaded-list presentation. |
| `src/components/settings/SettingsExtensionOptions.vue` | 214 | Extension settings/action form presentation. |
| `src/components/sidebar/FileTree.vue` | 787 | File tree orchestration plus mutation commands; Phase 8 extracted header/footer/menu chrome. |
| `src/components/sidebar/FileTreeFooter.vue` | 117 | File tree footer controls. |
| `src/components/sidebar/FileTreeHeader.vue` | 94 | File tree header controls. |
| `src/components/sidebar/FileTreeNewMenu.vue` | 93 | File tree document-template create menu. |
| `src/components/sidebar/FileTreeWorkspaceMenu.vue` | 108 | File tree workspace actions menu. |
| `src/App.vue` | 735 | App shell composition; extension runtime event bridge extracted to `src/app/shell/useAppExtensionRuntimeBridge.js`. |

## Store Responsibility Snapshot

| Store | Lines | Current role | Boundary risk |
| --- | ---: | --- | --- |
| `src/stores/documentWorkflow.js` | 339 | Document workflow UI state and runtime orchestration | Needs store/domain/service separation after runtime contracts settle. |
| `src/stores/editor.js` | 579 | Frozen editor shell/session state | Do not edit during this reorganization. |
| `src/stores/extensionWindowUi.js` | 82 | Extension prompt window UI state | Low; keep UI-only. |
| `src/stores/extensions.js` | 1149 | Extension registry, host state, tasks, prompts, views, commands | Medium; Phase 7 extracted deterministic presentation/state helpers and kept host authority in Rust. |
| `src/stores/files.js` | 949 | File tree, watcher lifecycle calls, mutation orchestration, draft files | High; Phase 3 should keep path/mutation authority Rust-owned and store UI-only orchestration. |
| `src/stores/latex.js` | 924 | LaTeX preferences, build scheduling, compile state, logs | High; Phase 6 should keep compile planning/execution Rust-owned. |
| `src/stores/links.js` | 334 | Markdown heading/link index and backlinks | Medium; decide whether parsing/indexing is UI helper or Rust document intelligence. |
| `src/stores/python.js` | 219 | Python preferences and compile/run state | Medium; runtime resolution should remain Rust-owned. |
| `src/stores/references.js` | 964 | Reference selection, collections, import, persistence, mutation orchestration | High; Phase 5 should keep normalization/merge/persistence Rust-owned. |
| `src/stores/toast.js` | 48 | Toast UI | Low. |
| `src/stores/utils.js` | 10 | Store utilities | Low. |
| `src/stores/uxStatus.js` | 78 | Status/toast UI | Low. |
| `src/stores/workspace.js` | 677 | Workspace lifecycle, preferences, layout, settings, shell state | High; Phase 3/4 should keep lifecycle and persisted settings Rust-owned. |

## Workspace/File Authority Cleanup Log

- 2026-05-02: `src/stores/files.js` no longer decides whether a Save Draft As target path is inside the active workspace with frontend string-prefix checks. The selected path is sent through the normal `workspace_write_text_file` bridge, and Rust `ensure_allowed_mutation_path` remains the authority for accepting or rejecting the mutation. The store only reports the failed save as UI feedback.
- 2026-05-02: `src/services/workspaceRecents.js` no longer carries stale frontend recent-workspace normalization or record-opened policy. Lifecycle normalization, pruning, record-opened ordering, and max recent count remain owned by `src-tauri/src/workspace_lifecycle.rs` and its Rust tests.

## Preferences/Settings Authority Cleanup Log

- 2026-05-02: `src/stores/workspace.js` now sends persisted setting patch values to `workspace_preferences_save` without pre-normalizing wrap, booleans, file tree modes, PDF modes, citation settings, or locale in JS. Rust `workspace_preferences.rs` remains the persisted schema/default/normalization authority, and the store consumes the normalized preferences returned by Rust. `src/services/workspacePreferences.js` keeps DOM/UI helpers for font, theme, and PDF preview display normalization only.

## Reference Authority Cleanup Log

- 2026-05-02: `src/services/references/referenceLibraryIO.js` no longer re-normalizes reference library snapshots in JavaScript after Rust `references_snapshot_normalize`, `references_library_load_workspace`, or `references_library_write` returns. Snapshot shape, document reference selection pruning, collection/tag registry cleanup, record normalization, rating removal, and library persistence normalization remain owned by `src-tauri/src/references_snapshot.rs` and `src-tauri/src/references_backend.rs`; the JS service now only bridges commands and provides an empty fallback when no storage root is available.
- 2026-05-02: `src/stores/references.js` no longer filters, deduplicates, or clears `documentReferenceSelections` directly when a document's reference ids change or when applying a Rust-loaded library snapshot. The store now dispatches `setDocumentReferenceIds` through `references_mutation_apply`, and `src-tauri/src/references_mutation.rs` plus `src-tauri/src/references_snapshot.rs` own the mutation, id pruning, deduplication, and empty-selection cleanup.
- 2026-05-02: `src/services/references/citationFormatter.js` no longer imports the workspace Pinia store to discover workspace path. Workspace context is passed by callers as a DTO field, keeping citation services as Rust bridge wrappers around `references_citation_render` instead of hidden store-aware orchestration.

## Document Runtime Cleanup Log

- 2026-05-02: `src/stores/python.js` no longer normalizes raw Python runtime command DTOs itself. `src/services/pythonRuntime.js` now adapts `python_runtime_list`, `python_runtime_detect`, and `python_runtime_compile` responses into stable frontend DTOs, while Rust `src-tauri/src/python_runtime.rs` remains the runtime discovery and execution authority and the Pinia store keeps compile UI state only.
- 2026-05-02: `src/services/latex/runtime.js` now normalizes `latex_runtime_compile_execute` responses into a stable bridge DTO with camelCase aliases while preserving Rust result fields. `src/stores/latex.js` consumes the adapted compile result for PDF refresh metadata and keeps compile UI orchestration, with compile execution and diagnostics still owned by Rust.
- 2026-05-02: Frontend PDF SyncTeX no longer reads or parses `.synctex` content through the removed LaTeXWorkshop JS fallback. `src/services/pdf/artifactPreview.js` now delegates forward/backward SyncTeX to Rust commands only, and `src-tauri/src/latex.rs` owns CLI execution plus parser fallback for SyncTeX files under the workspace scope.
- 2026-05-02: `src/domains/document/documentWorkflowResolvedStateRuntime.js` was split so pure resolved-state cache keys live in `src/domains/document/documentWorkflowResolvedStateKeys.js`, while Rust-backed Markdown/workflow/preview resolution calls and Pinia inflight cache coordination live in `src/stores/documentWorkflowResolvedStateActions.js`.
- 2026-05-02: Document workflow action execution and build operation orchestration moved from `src/domains/document` into `src/stores/documentWorkflowActionRuntime.js` and `src/stores/documentWorkflowBuildOperationRuntime.js`, keeping Rust-backed action resolution, editor save-before-build, and store mutation calls outside pure domain modules.
- 2026-05-02: Document workflow controller orchestration moved from `src/domains/document/documentWorkflowRuntime.js` to `src/stores/documentWorkflowRuntime.js`, so Rust controller invocation and editor pane mutation no longer live in the pure domain layer.
- 2026-05-02: Document workflow build context orchestration moved from `src/domains/document/documentWorkflowBuildRuntime.js` to `src/stores/documentWorkflowBuildRuntime.js`; the pure status-tone helper remains in `src/domains/document/documentWorkflowStatusTone.js`.
- 2026-05-02: Document workflow session persistence, preview binding mutation, LaTeX artifact reconciliation, and workspace preview request state moved from `src/domains/document/documentWorkflowSessionRuntime.js` to `src/stores/documentWorkflowSessionRuntime.js`. After this move, non-editor `src/domains/document/**` modules no longer import services or stores.

## Extension Runtime Cleanup Log

- 2026-05-02: `src/stores/extensions.js` no longer carries extension/task/view/runtime DTO normalization and deterministic task/view derivation helpers inline. The pure helpers now live in `src/domains/extensions/extensionStoreState.js`; the Pinia store keeps service orchestration, host activation, command/capability dispatch, prompt recovery, and UI state coordination.
- 2026-05-02: Extension result-entry generation and view-state shaping moved into domain helpers. `src/domains/extensions/extensionResultEntries.js` now owns deterministic artifact/output/task fallback result entries, and `buildExtensionViewState` centralizes resolved/pushed view-state presentation shaping; `src/services/extensions/extensionResultEntries.js` remains a compatibility re-export.
- 2026-05-02: Extension menu, keybinding, command palette, sidebar container, view, view-title action, and view-item action derivation moved from Pinia getters into `src/domains/extensions/extensionStoreState.js`. The store getters now pass registry, enabled ids, runtime registry, and context into pure helpers while keeping Pinia state ownership local.
- 2026-05-02: Removed the extension result-entry compatibility shims from `src/services/extensions`. Components and probes now import deterministic artifact/task/result presentation helpers from `src/domains/extensions/extensionResultEntries.js`, leaving `src/services/extensions/**` focused on Tauri command/event bridge files.
- 2026-05-03: Phase 7 verification passed with full `npm run verify`. The only escalation needed was for `probe:retain-pdf-extension`, which writes generated runtime files under `~/.scribeflow/extensions/retain-pdf/.runtime`; no code regression was found.

## Phase 1 Verification Targets

- `npm run guard:ui-bridges`
- `npm run guard:js-layer-boundaries`
- `npm run build`

Later phases must update this map as responsibility moves out of mixed modules.
