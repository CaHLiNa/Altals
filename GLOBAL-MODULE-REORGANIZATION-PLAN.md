# ScribeFlow Global Module Reorganization Plan

> **For agentic workers:** This plan is execution-oriented. Implement it phase by phase, keep commits small, and do not claim a phase is ready until its verification gate passes.

**Goal:** Reorganize ScribeFlow so Vue owns UI, JavaScript owns the Tauri bridge and UI coordination only, and Rust owns backend authority for filesystem, workspace state, references, LaTeX/Python runtime, plugins, persistence, and security.

**Architecture:** This is not a rewrite and not an editor refactor. The plan tightens existing boundaries around the current Tauri app: Rust remains the runtime authority, `src/services` remains the only native bridge, Pinia stores coordinate UI state, and Vue components render product surfaces. The editor stack is explicitly frozen to avoid disturbing cursor, selection, CodeMirror positioning, reveal, and text interaction behavior.

**Tech Stack:** Vue 3, Pinia, JavaScript ES modules, Tauri 2, Rust, CodeMirror, Vite, npm verification scripts.

---

## 0. Non-Negotiable Boundaries

### Target Layer Contract

- **Vue components:** render UI, receive props, emit user intent, show loading/error/empty states, manage local form draft state only.
- **Composables:** UI interaction helpers only, such as resize, delayed render, transient dismissal, shell layout, and component-level event wiring.
- **Pinia stores:** coordinate screen state and call bridge services; they may decide UI flow, but must not duplicate backend business rules.
- **`src/domains`:** pure JavaScript rules for presentation, state derivation, labels, sorting, filtering, and deterministic UI policy. No Tauri calls, no filesystem assumptions, no persistence.
- **`src/services`:** thin bridge to Rust and external native/browser APIs. It may normalize request/response DTO shapes, but must not become a second backend.
- **`src-tauri/src`:** authoritative backend for filesystem, workspace access, persistence, normalization, imports, runtime execution, plugins, reference library, security, and cross-workspace lifecycle.

### Editor Freeze

Do not edit these files during this reorganization unless the user explicitly opens a separate editor phase:

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

Allowed editor-adjacent work:

- Read these files to understand contracts.
- Keep existing props/events/store actions stable.
- Add external adapter tests or guards around imports without changing editor implementation.
- Refactor callers around the editor boundary if the editor-facing payload shape stays byte-for-byte compatible.

Blocked editor-adjacent work:

- CodeMirror extension changes.
- Cursor, selection, reveal, scroll, fold, autocomplete, snippet, citation insertion, and text interaction changes.
- Changes to editor saved session shape.
- Changes to event timing between editor components and stores.

## 1. Current Repository Signals

Current structure already points in the right direction, but responsibility is uneven:

- `src/components` has UI surfaces, but several large components also assemble workflow behavior.
- `src/services` correctly holds Tauri imports, but some service files still contain domain-level runtime logic and policy.
- `src/domains` contains pure-ish rules, but several files are named `Runtime` and should be audited for backend-like decisions.
- `src/stores` coordinates Pinia state, but large stores such as `extensions.js`, `references.js`, `files.js`, `latex.js`, and `workspace.js` need stronger limits.
- `src-tauri/src` already contains substantial backend authority, especially for references, workspace lifecycle, plugins, LaTeX, Python, workbench state, and filesystem access.

High-risk large files to avoid making larger:

- `src/components/editor/PdfEmbedDocumentSurface.vue`
- `src/components/editor/TextEditor.vue` (frozen)
- `src/stores/extensions.js`
- `src/components/references/ReferenceLibraryWorkbench.vue`
- `src/components/panel/ReferenceDetailPanel.vue`
- `src/components/settings/SettingsExtensions.vue`
- `src/components/editor/EditorPane.vue` (frozen)
- `src/components/sidebar/FileTree.vue`
- `src/stores/references.js`
- `src/stores/files.js`
- `src/stores/latex.js`
- `src/App.vue`
- `src/stores/workspace.js`

Existing verification baseline:

```sh
npm run verify
```

Useful narrower gates during implementation:

```sh
npm run guard:ui-bridges
npm run guard:pdf-runtime
npm run guard:textmate-runtime
npm run build
npm run check:bundle
npm run check:rust
npm run test:rust
```

## 2. Reorganization Strategy

This work should be done as a staged architecture cleanup, not one giant mixed commit.

Main rule:

- First add boundary visibility and guards.
- Then move backend authority into Rust where missing.
- Then make JS services thin wrappers.
- Then slim stores and components.
- Then remove dead compatibility paths.

Do not start by moving files around for aesthetics. Every move must reduce one specific mixed responsibility.

## 3. Phase Overview

### Phase 1: Baseline Map And Boundary Guard Expansion

**Goal:** Produce an exact map of mixed responsibility before changing behavior, then strengthen automated checks so future phases cannot reintroduce mixed layers.

**Files to inspect:**

- `src/services/**`
- `src/domains/**`
- `src/stores/*.js`
- `src/components/**/*.vue`
- `src-tauri/src/lib.rs`
- `src-tauri/src/*.rs`
- `scripts/check-ui-bridges.mjs`
- `scripts/check-pdf-runtime-boundary.mjs`
- `scripts/check-textmate-runtime-boundary.mjs`
- `package.json`

**Files to create or modify:**

- Create `ARCHITECTURE-BOUNDARY-MAP.md`
- Modify `scripts/check-ui-bridges.mjs`
- Optionally create `scripts/check-js-layer-boundaries.mjs`
- Modify `package.json` to run the new guard from `npm run verify`

**Work:**

- [ ] List every JavaScript file that imports Tauri APIs. Expected allowed root: `src/services/**` only.
- [ ] List every service that does more than bridge request/response DTOs.
- [ ] List every domain module that performs IO, persistence, process, or workspace authority decisions.
- [ ] List every Vue component above 500 lines and classify whether its complexity is UI-only or mixed behavior.
- [ ] List every Pinia store action that contains backend-style business logic.
- [ ] Add a guard that fails when `src/components`, `src/composables`, `src/domains`, `src/stores`, `src/app`, `src/shared`, or `src/utils` import `@tauri-apps/**`.
- [ ] Add a guard that warns or fails when `src/domains/**` imports from `src/services/**`, `src/stores/**`, or Tauri packages.
- [ ] Add a guard exception list only for frozen editor files if needed, and document why each exception exists.

**Verification:**

```sh
npm run guard:ui-bridges
npm run build
```

**Commit:**

```sh
git add ARCHITECTURE-BOUNDARY-MAP.md scripts/check-ui-bridges.mjs package.json
git commit -m "chore: map module boundaries"
```

### Phase 2: Lock The Folder Contracts

**Goal:** Make the desired architecture visible in repository docs and enforceable by new contributors.

**Files to modify:**

- `AGENTS.md`
- `CURRENT-STATE.md`
- `README.md`
- `ARCHITECTURE-BOUNDARY-MAP.md`

**Work:**

- [ ] Add a short canonical layer table: Vue UI, JS bridge, Pinia coordination, domains pure rules, Rust runtime authority.
- [ ] Add the editor freeze list to the repository docs.
- [ ] Add examples of allowed and disallowed changes:
  - allowed: `ReferenceDetailPanel.vue` emits save intent, `references.js` calls `referenceRuntime.applyMutation`, Rust validates and persists.
  - disallowed: Vue component writes normalized reference records directly.
  - allowed: service wrapper invokes `references_mutation_apply`.
  - disallowed: service wrapper performs merge policy that should be Rust-owned.
- [ ] Add a rule that Rust command payload shape changes require bridge update, store update, and regression verification in the same commit.
- [ ] Add a rule that editor-related files require a separate editor-specific phase.

**Verification:**

```sh
npm run guard:ui-bridges
```

**Commit:**

```sh
git add AGENTS.md CURRENT-STATE.md README.md ARCHITECTURE-BOUNDARY-MAP.md
git commit -m "docs: codify frontend bridge runtime boundaries"
```

### Phase 3: Workspace And File Authority Cleanup

**Goal:** Make Rust the only authority for workspace file mutations, path validation, watcher lifecycle, recent workspaces, and persisted workspace lifecycle state.

**Primary current files:**

- `src/stores/files.js`
- `src/stores/workspace.js`
- `src/services/fileStoreIO.js`
- `src/services/fileTreeSystem.js`
- `src/services/workspacePermissions.js`
- `src/services/workspacePicker.js`
- `src/services/workspacePaths.js`
- `src/services/workspaceRecents.js`
- `src/services/workspaceSnapshotIO.js`
- `src/domains/files/**`
- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/fs_tree.rs`
- `src-tauri/src/fs_tree_runtime.rs`
- `src-tauri/src/fs_watch_runtime.rs`
- `src-tauri/src/workspace_access.rs`
- `src-tauri/src/workspace_lifecycle.rs`
- `src-tauri/src/security.rs`

**Target shape:**

- Rust owns path scope, allowed roots, bookmarks, watcher lifecycle, filesystem mutation, file tree snapshot, recent workspace persistence, and bootstrap data.
- `src/services/fileStoreIO.js` and related services expose one function per Rust command with light DTO normalization.
- `src/stores/files.js` keeps selected path, expanded rows, pending UI operation, and calls services.
- `src/domains/files/**` keeps pure UI derivations: display rows, sort order, labels, file limits presentation, and drag/drop UI classification.

**Work:**

- [ ] Audit `src/stores/files.js` for path normalization, duplicate validation, mutation policy, and watcher decisions that should be Rust-owned.
- [ ] Audit `src/stores/workspace.js` for lifecycle decisions that duplicate `workspace_lifecycle.rs`.
- [ ] Move any path authority decision to Rust commands or existing Rust helpers under `security.rs`, `fs_commands.rs`, or `workspace_lifecycle.rs`.
- [ ] Keep browser drag/drop and UI row state in Vue/composables/domains only.
- [ ] Keep external file drop copying behind `workspace_copy_external_path`.
- [ ] Keep watcher start/stop calls as service invocations; Rust remains responsible for actual watcher state.
- [ ] Add Rust tests for workspace path rejection and mutation boundaries where missing.
- [ ] Keep existing file tree UI behavior stable.

**Do not touch:**

- Editor tab content handling.
- Editor restore payloads.
- Cursor/selection event handling.

**Verification:**

```sh
npm run guard:ui-bridges
npm run build
npm run check:rust
npm run test:rust
```

**Commit:**

```sh
git add src/stores/files.js src/stores/workspace.js src/services src/domains/files src-tauri/src
git commit -m "refactor: centralize workspace file authority"
```

### Phase 4: Preferences, Settings, And Workbench State Cleanup

**Goal:** Ensure persisted settings and layout normalization are Rust-owned, while Vue only renders settings forms and JS only bridges save/load.

**Primary current files:**

- `src/components/settings/**`
- `src/stores/workspace.js`
- `src/services/workspacePreferences.js`
- `src/services/workbenchLayout.js`
- `src/services/workbenchDockPages.js`
- `src/services/latexPreferences.js`
- `src/services/pythonPreferences.js`
- `src/domains/workbench/**`
- `src/shared/workspaceThemeOptions.js`
- `src-tauri/src/workspace_preferences.rs`
- `src-tauri/src/workbench_state.rs`
- `src-tauri/src/latex_preferences.rs`
- `src-tauri/src/python_preferences.rs`

**Target shape:**

- Rust owns persisted settings schema defaults, normalization, migration of current supported state, system font discovery, and workbench layout persistence.
- Services bridge load/save calls and normalize naming differences only.
- Stores keep dirty state, optimistic UI state, and save lifecycle.
- Vue settings components render controls and validation messages.
- Domains provide pure display options and presentation labels.

**Work:**

- [ ] Audit `workspacePreferences.js`; move defaulting and normalization that affects persisted shape to `workspace_preferences.rs`.
- [ ] Audit settings Vue components for direct persistence assumptions.
- [ ] Keep UI-only option lists in frontend only when they are purely visual.
- [ ] Keep system-dependent option discovery, such as fonts, in Rust.
- [ ] Ensure settings save flow always goes through Rust normalization before stores consume the result.
- [ ] Add Rust tests for preferences normalization.
- [ ] Add a small JS probe for expected bridge DTO if a settings shape is changed.

**Verification:**

```sh
npm run build
npm run check:rust
npm run test:rust
```

**Commit:**

```sh
git add src/components/settings src/services/workspacePreferences.js src/services/workbenchLayout.js src/services/workbenchDockPages.js src-tauri/src/workspace_preferences.rs src-tauri/src/workbench_state.rs
git commit -m "refactor: move settings normalization to runtime"
```

### Phase 5: Reference System Authority Cleanup

**Goal:** Make reference import, normalization, merge, metadata refresh, citation rendering, PDF asset handling, Zotero sync, and library persistence Rust-owned end to end.

**Primary current files:**

- `src/components/references/ReferenceLibraryWorkbench.vue`
- `src/components/references/ReferenceAddDialog.vue`
- `src/components/references/ReferenceCitedInPanel.vue`
- `src/components/panel/ReferenceDetailPanel.vue`
- `src/components/sidebar/DocumentReferencesPanel.vue`
- `src/stores/references.js`
- `src/services/references/**`
- `src/domains/references/**`
- `src-tauri/src/references_backend.rs`
- `src-tauri/src/references_citation.rs`
- `src-tauri/src/references_import.rs`
- `src-tauri/src/references_merge.rs`
- `src-tauri/src/references_mutation.rs`
- `src-tauri/src/references_pdf.rs`
- `src-tauri/src/references_query.rs`
- `src-tauri/src/references_runtime.rs`
- `src-tauri/src/references_snapshot.rs`
- `src-tauri/src/references_zotero.rs`
- `src-tauri/src/references_zotero_account.rs`

**Target shape:**

- Rust owns CSL/BibTeX/PDF/Zotero normalization and all persisted reference shape.
- Rust owns merge policy, duplicate detection, citation rendering, BibTeX export, PDF metadata extraction, and asset storage.
- JS services expose bridge methods: import, query, mutate, refresh metadata, write BibTeX, render citation, Zotero calls.
- `src/stores/references.js` owns current selection, drafts, loading flags, and calls services.
- Vue components render library table, detail panel, add dialog, cited-in panel, and dock surfaces.
- `src/domains/references/**` owns pure display derivations only: labels, badges, sorted views, citation chip presentation.

**Work:**

- [ ] Audit `src/services/references/**` and mark functions that still do reference business decisions.
- [ ] Move any remaining reference record normalization into Rust.
- [ ] Move any remaining duplicate/merge policy into Rust.
- [ ] Move citation string generation into `references_citation.rs` if any frontend formatting still duplicates it.
- [ ] Ensure `ReferenceDetailPanel.vue` only edits draft fields and emits save intent through store actions.
- [ ] Ensure `ReferenceLibraryWorkbench.vue` only controls UI selection, filters, and commands.
- [ ] Ensure `references.js` uses one mutation command path for create/update/delete/link/asset changes.
- [ ] Preserve existing camelCase bridge compatibility for Rust command payloads.
- [ ] Add or preserve Rust regression tests for `abstract`, `notes`, citation keys, local overrides, PDF asset fields, and Zotero IDs.

**Verification:**

```sh
npm run build
npm run check:rust
npm run test:rust
```

Manual desktop path after build:

- Open a workspace.
- Import one BibTeX entry.
- Edit title/notes/abstract in reference detail.
- Save and reopen reference detail.
- Attach or inspect a PDF asset if available.
- Insert a citation into a Markdown or LaTeX document without changing editor implementation.

**Commit:**

```sh
git add src/components/references src/components/panel/ReferenceDetailPanel.vue src/stores/references.js src/services/references src/domains/references src-tauri/src/references_*.rs
git commit -m "refactor: consolidate reference authority in rust"
```

### Phase 6: Markdown, LaTeX, PDF, And Python Runtime Cleanup

**Goal:** Put runtime execution, diagnostics, compile planning, SyncTeX, PDF file access, and Python execution behind Rust; keep frontend focused on UI state and previews.

**Primary current files:**

- `src/stores/latex.js`
- `src/stores/python.js`
- `src/stores/documentWorkflow.js`
- `src/services/markdown/**`
- `src/services/latex/**`
- `src/services/pdf/**`
- `src/services/pythonRuntime.js`
- `src/services/pythonPreferences.js`
- `src/services/documentWorkflow/**`
- `src/domains/document/**`
- `src/components/editor/MarkdownPreview.vue`
- `src/components/editor/PdfEmbedSurface.vue`
- `src/components/editor/PdfEmbedDocumentSurface.vue`
- `src/components/editor/PythonTerminalPreview.vue`
- `src-tauri/src/markdown_runtime.rs`
- `src-tauri/src/latex.rs`
- `src-tauri/src/latex_compile.rs`
- `src-tauri/src/latex_diagnostics.rs`
- `src-tauri/src/latex_project_graph.rs`
- `src-tauri/src/latex_runtime.rs`
- `src-tauri/src/latex_sync_target.rs`
- `src-tauri/src/python_runtime.rs`
- `src-tauri/src/document_workflow*.rs`
- `src-tauri/src/document_workspace_preview*.rs`

**Target shape:**

- Rust owns Markdown diagnostics/headings/wiki-link extraction that depends on parsing consistency.
- Rust owns LaTeX compile target resolution, compile scheduling/execution, diagnostics, SyncTeX, and tool detection.
- Rust owns Python runtime detection/list/compile/run behavior.
- JS services wrap Rust commands and event listeners.
- Stores coordinate active preview, running state, progress streams, selected root target, and visible errors.
- Vue preview components render output and user controls.
- Browser-only Markdown preview DOM transforms may remain frontend-owned if they are purely presentation and do not affect persisted document semantics.

**Editor freeze implications:**

- Do not change text editor content model.
- Do not alter citation insertion or cursor-aware operations.
- Do not change how editor emits cursor, selection, or stats events.
- Do not touch `src/editor/**`.

**Work:**

- [ ] Audit `src/stores/latex.js` for compile planning that duplicates Rust.
- [ ] Move compile target or diagnostics policy into Rust when it affects backend behavior.
- [ ] Keep progress/event translation in `src/services/latex/runtime.js`.
- [ ] Audit `src/services/latex/latexWorkshopSynctex.js`; keep only bridge and DTO helpers in JS, move scope-sensitive parsing/lookup into Rust when feasible.
- [ ] Audit Markdown preview services; keep DOM sanitization/presentation frontend-owned, keep document parsing contracts Rust-owned where already available.
- [ ] Audit Python store and services; move runtime resolution decisions into Rust.
- [ ] Keep PDF viewer interaction state in frontend, but keep PDF file reads/writes and SyncTeX in Rust.

**Verification:**

```sh
npm run guard:pdf-runtime
npm run guard:textmate-runtime
npm run build
npm run check:rust
npm run test:rust
```

Manual desktop path:

- Open a Markdown file and preview it.
- Open a LaTeX file and compile it.
- Open the generated PDF.
- Run SyncTeX forward/backward if the workspace has SyncTeX data.
- Run a Python file.

**Commit:**

```sh
git add src/stores/latex.js src/stores/python.js src/stores/documentWorkflow.js src/services/markdown src/services/latex src/services/pdf src/services/pythonRuntime.js src-tauri/src/markdown_runtime.rs src-tauri/src/latex*.rs src-tauri/src/python_runtime.rs src-tauri/src/document_workflow*.rs
git commit -m "refactor: clarify document runtime boundaries"
```

### Phase 7: Extension Runtime Boundary Cleanup

**Goal:** Preserve the existing plugin runtime direction while making frontend extension code UI/presentation-oriented and Rust the host authority.

**Primary current files:**

- `src/stores/extensions.js`
- `src/stores/extensionWindowUi.js`
- `src/components/extensions/**`
- `src/components/settings/SettingsExtensions.vue`
- `src/services/extensions/**`
- `src/domains/extensions/**`
- `src-tauri/src/extension_*.rs`
- `src-tauri/resources/extension-host/extension-host.mjs`
- `scripts/probe-extension-*.mjs`
- `src-tauri/src/bin/extension-host-*-probe.rs`

**Target shape:**

- Rust owns plugin discovery, manifest validation, settings persistence, secure settings, host lifecycle, command/capability invocation, tasks, artifacts, view resolution, process bridge, workspace isolation, and prompt ownership.
- Extension host JS resource remains the plugin runtime adapter, not the Vue app backend.
- `src/services/extensions/**` wraps Tauri command/event bridge.
- `src/stores/extensions.js` coordinates active UI state, task visibility, prompt recovery, command preflight display, and store-level caching.
- `src/domains/extensions/**` owns pure presentation contracts and deterministic frontend state derivation.
- Vue components render extension settings, panels, task UI, prompt UI, command palette, status surfaces, and result previews.

**Work:**

- [x] Audit `src/stores/extensions.js` and split UI coordination helpers into focused pure domain modules where they are deterministic and side-effect-free.
- [x] Keep host authority in Rust commands; do not move host decisions into the store.
- [x] Ensure command/capability/task cancellation paths always call Rust authority.
- [x] Keep blocked/waiting presentation in shared domain helpers.
- [x] Keep settings secure storage and workspace scoping Rust-owned.
- [x] Keep extension runtime probes green after each change.
- [x] Do not merge extension cleanup with reference or editor changes.

**Progress notes:**

- 2026-05-02: Moved extension/task/view/runtime DTO normalization and deterministic task/view derivation helpers from `src/stores/extensions.js` into `src/domains/extensions/extensionStoreState.js`. The store still owns Pinia/service orchestration while deterministic state shaping lives in the domain layer.
- 2026-05-02: Moved deterministic result-entry generation and resolved/pushed view-state shaping into extension domain helpers. Service imports remain as compatibility re-exports while store actions now call `buildExtensionViewState`.
- 2026-05-02: Moved extension menu/keybinding/command palette/sidebar/view action derivation from Pinia getters into pure extension domain helpers. Store getters remain as compatibility wrappers over store state.
- 2026-05-02: Removed extension result-entry compatibility shims from `src/services/extensions`; result-entry presentation imports now point directly at the extension domain module.
- 2026-05-03: Phase 7 code cleanup is closed. `src/services/extensions/**` is bridge-only again, extension result/view/task presentation is domain-owned, Rust remains the host authority for commands, tasks, cancellation, settings, prompts, artifacts, and view resolution, and full `npm run verify` passed after rerunning outside the sandbox for the RetainPDF home-directory write.

**Verification:**

Run all extension probes if extension boundary behavior changes:

```sh
npm run verify
```

For smaller presentation-only extraction:

```sh
npm run build
npm run probe:extension-host-status-store-contract
npm run probe:extension-command-dispatch-preflight-store-contract
npm run probe:extension-capability-dispatch-preflight-store-contract
npm run probe:extension-action-surface-state-contract
```

**Commit:**

```sh
git add src/stores/extensions.js src/stores/extensionWindowUi.js src/components/extensions src/components/settings/SettingsExtensions.vue src/services/extensions src/domains/extensions src-tauri/src/extension_*.rs scripts/probe-extension-*.mjs
git commit -m "refactor: tighten extension runtime boundaries"
```

### Phase 8: Vue Component Slimming

**Goal:** Reduce large Vue files to UI shells without changing product behavior.

**High-priority UI files:**

- `src/components/references/ReferenceLibraryWorkbench.vue`
- `src/components/panel/ReferenceDetailPanel.vue`
- `src/components/settings/SettingsExtensions.vue`
- `src/components/sidebar/FileTree.vue`
- `src/components/editor/PdfEmbedDocumentSurface.vue`
- `src/App.vue`

**Frozen UI files:**

- `src/components/editor/TextEditor.vue`
- `src/components/editor/EditorPane.vue`
- `src/components/editor/EditorTextRouteSurface.vue`
- `src/components/editor/EditorTextWorkspaceSurface.vue`
- `src/components/editor/PaneContainer.vue`

**Target shape:**

- Large UI components can be split into smaller presentational components if the split does not change behavior.
- Component extraction must follow user workflow, not arbitrary technical categories.
- Draft handling can stay local when it is only form UI.
- Save/load/import/compile/run must route through stores and services.

**Work:**

- [ ] For each large component, identify local UI-only sections that can become child components.
- [x] Extract only stateless or draft-local UI sections first.
- [x] Move display-only derived arrays/labels into `src/domains/**`.
- [x] Keep side effects in stores/services.
- [x] Preserve props/events and keyboard behavior.
- [x] Avoid visual redesign unless the user explicitly asks.
- [x] Do not touch frozen editor files.

**Progress notes:**

- 2026-05-03: Started Phase 8 with `SettingsExtensions.vue`. Extracted loaded-extension list and extension options form into `SettingsExtensionList.vue` and `SettingsExtensionOptions.vue`, moved settings grouping/action grouping/key humanization into `src/domains/extensions/extensionSettingsGroups.js`, and kept registry refresh, enable/disable, secure-setting save, host restart, and command execution in the parent/store path. `SettingsExtensions.vue` dropped from 1160 to 779 lines without touching frozen editor files.
- 2026-05-03: Slimmed `App.vue` by moving extension command palette shortcut handling, extension keybinding dispatch, extension window prompt submit/cancel recovery, and extension host event listener lifecycle into `src/app/shell/useAppExtensionRuntimeBridge.js`. `App.vue` dropped from 845 to 735 lines while retaining app shell markup, layout wiring, and workspace orchestration.
- 2026-05-03: Split `ExtensionSidebarPanel.vue` by extracting per-view rendering into `ExtensionSidebarViewSection.vue`. The parent still owns store resolution, refresh, command execution, result action handling, expansion state, and controller synchronization; the child renders status, summary, result preview, and tree roots. `ExtensionSidebarPanel.vue` dropped from 723 to 660 lines.
- 2026-05-03: Split `FileTree.vue` chrome into `FileTreeHeader.vue`, `FileTreeFooter.vue`, `FileTreeWorkspaceMenu.vue`, and `FileTreeNewMenu.vue`. The parent still owns filesystem/store authority, rename/create/delete/duplicate orchestration, drag/drop wiring, context menu dispatch, and workspace menu state; extracted children render header controls, footer controls, workspace actions, and document-template create actions. `FileTree.vue` dropped from 1078 to 787 lines without changing file tree behavior.
- 2026-05-03: Split `ReferenceLibraryWorkbench.vue` toolbar and reference table into `ReferenceLibraryToolbar.vue` and `ReferenceLibraryTable.vue`, and moved author display labeling into `src/domains/references/referenceDisplayLabels.js`. The parent still owns reference store calls, import/export dialogs, context menu actions, inline dock state, resize coordination, and toast/status side effects. `ReferenceLibraryWorkbench.vue` dropped from 1169 to 844 lines without changing reference workflow behavior.
- 2026-05-03: Split `ReferenceDetailPanel.vue` into `ReferenceDetailHero.vue`, `ReferenceDetailMetadataSection.vue`, and `ReferenceDetailContentSection.vue`. The parent still owns draft synchronization, dirty field tracking, queued reference updates, PDF preview/open/reveal/attach actions, and toast error handling; extracted children render title/save chrome, metadata/files fields, tags/collections, and abstract/notes disclosures. `ReferenceDetailPanel.vue` dropped from 1167 to 654 lines without changing reference detail persistence behavior.
- 2026-05-03: Split `PdfEmbedDocumentSurface.vue` toolbar and search chrome into `PdfEmbedToolbar.vue`. The parent still owns embedpdf runtime wiring, zoom/page/search side effects, selection, thumbnails, forward sync, restore state, context menu, save/export actions, and toast handling; extracted toolbar renders spread controls, zoom selection, page input, search field, and search filters. `PdfEmbedDocumentSurface.vue` dropped from 2485 to 2030 lines without changing PDF runtime behavior.
- 2026-05-03: Split `WorkspaceStarter.vue` into `WorkspaceStarterEmptyState.vue` and `WorkspaceTemplateGrid.vue`. The parent now only coordinates workspace/editor state and dispatches `app:open-folder` / `app:begin-new-file`; extracted children render the no-workspace hero and current-workspace document template cards. `WorkspaceStarter.vue` dropped from 724 to 73 lines without touching workspace creation behavior.

**Verification:**

```sh
npm run build
```

Manual desktop path:

- Open app shell.
- Open settings.
- Use file tree.
- Open reference library.
- Open reference detail.
- Open PDF preview.

**Commit:**

```sh
git add src/components src/composables src/domains src/stores
git commit -m "refactor: slim ui surfaces"
```

### Phase 9: Store Responsibility Cleanup

**Goal:** Make stores easy to reason about: state, actions, orchestration, no backend policy.

**Primary stores:**

- `src/stores/files.js`
- `src/stores/workspace.js`
- `src/stores/references.js`
- `src/stores/latex.js`
- `src/stores/python.js`
- `src/stores/documentWorkflow.js`
- `src/stores/extensions.js`
- `src/stores/links.js`
- `src/stores/uxStatus.js`

**Target shape:**

- Store state is serializable where possible.
- Store actions call service functions and update UI state.
- Stores do not parse files, normalize reference records, validate filesystem paths, decide workspace security, execute processes, or own persisted schema.
- Stores may perform optimistic UI updates only when Rust returns normalized final state afterward.

**Work:**

- [x] For each store, add a one-paragraph responsibility note in `ARCHITECTURE-BOUNDARY-MAP.md`.
- [ ] Extract repeated UI status derivations into domains.
- [ ] Extract repeated service call sequences into one store action rather than duplicating in components.
- [ ] Remove stale setters left behind by deleted settings or old workflows.
- [ ] Ensure each async action has clear loading, success, and failure state.
- [ ] Ensure errors are displayed through existing toast/status mechanisms instead of swallowed.

**Verification:**

```sh
npm run build
npm run guard:ui-bridges
```

**Commit:**

```sh
git add src/stores src/domains ARCHITECTURE-BOUNDARY-MAP.md
git commit -m "refactor: simplify store responsibilities"
```

**Progress notes:**

- 2026-05-03: Started Phase 9 with store responsibility mapping. Added primary store responsibility notes to `ARCHITECTURE-BOUNDARY-MAP.md` for `files`, `workspace`, `references`, `latex`, `python`, `documentWorkflow`, `extensions`, `links`, and `uxStatus`, and refreshed the store snapshot line counts. This documents each store's intended UI coordination scope and the Rust/service/domain responsibilities it must not absorb.
- 2026-05-03: Extracted document workflow preview/workflow UI state request derivation from `src/stores/documentWorkflowBuildRuntime.js` into `src/domains/document/documentWorkflowBuildStateRequests.js`. The store runtime remains responsible for resolving adapters and assembling store context, while pure preview-kind/artifact/workflow request shaping now lives in the domain layer.
- 2026-05-03: Moved extension sidebar tone class normalization from `ExtensionSidebarPanel.vue` into `src/domains/extensions/extensionToneClass.js`, keeping status/summary tone-to-class derivation in a pure domain helper.
- 2026-05-03: Extracted extension document action progress presentation from `ExtensionDocumentActionPanel.vue` into `src/domains/extensions/extensionProgressPresentation.js`, so progress state normalization, width derivation, and tone class mapping stay in the extension domain layer.
- 2026-05-03: Moved reference BibTeX and detailed JSON export write calls from `ReferenceLibraryWorkbench.vue` into `references` store actions. The component still owns save dialog and toast/status UX, while the store owns library reference selection and reference export service calls.
- 2026-05-03: Added `referencesStore.syncZoteroNow()` and routed `SettingsZotero.vue` through the store instead of passing the Pinia store object into the Zotero service from the component.
- 2026-05-03: Removed unused `latex` store setters for build extra args and custom system TeX path. The preference fields stay in the persisted/runtime shape for compatibility, but the deleted settings no longer expose stale store actions.
- 2026-05-03: Added `referencesStore.connectZotero()` / `disconnectZotero()` and routed Zotero settings through those store actions. The component no longer owns the validate API key, persist API key, save config, and disconnect service sequence.
- 2026-05-03: Added `referencesStore.loadZoteroRemoteLibraries()` and moved Zotero API key, group, and collection fetch sequencing out of `SettingsZotero.vue`. The component still owns translated option-label presentation.
- 2026-05-03: Added `referencesStore.loadZoteroSettingsState()` / `saveZoteroSettingsConfig()` and removed direct Zotero service imports from `SettingsZotero.vue`.
- 2026-05-03: Extracted Zotero settings presentation helpers into `src/domains/references/zoteroSettingsPresentation.js`, covering push-target value parsing, selected group derivation, collection tree flattening, and translated push-target options. Removed unused citation-format option computed values from `SettingsZotero.vue`.
- 2026-05-03: Routed Zotero settings load and remote-library refresh failures into the existing inline error message instead of only writing to `console.error`, improving async failure visibility without adding new UI state.
- 2026-05-03: Extracted Python environment interpreter-option and diagnostics presentation into `src/domains/settings/pythonEnvironmentPresentation.js`. `src/stores/python.js` now keeps visible preference/runtime discovery error state, and `SettingsEnvironment.vue` shows Python environment failures inline instead of silently swallowing initial diagnostics load errors.
- 2026-05-03: Added `extensionsStore.refreshRegistryAndTasks()` and routed extension settings/action-button refresh callers through that store action instead of duplicating `refreshRegistry()` plus `refreshTasks()` in components. Task refresh errors now persist in store state and settings refresh failures surface through existing toast/inline status mechanisms.
- 2026-05-03: Kept reference deletion's local snapshot commit authoritative while making best-effort Zotero remote-delete failures visible. `src/services/references/zoteroSync.js` now propagates remote delete invoke failures to the store, `references` store records them in `zoteroMutationError`, and the reference workbench displays that error instead of silently swallowing the failed remote cleanup.
- 2026-05-03: Replaced file creation/mutation runtime `console.error`-only failure callbacks with the existing toast/status path in `src/stores/files.js`. Save, create, duplicate, folder create, external copy, rename, move, and delete failures now surface through `formatFileError` while backend path authorization and mutation acceptance remain Rust-owned.

### Phase 10: Service Bridge Cleanup

**Goal:** Make `src/services` a bridge layer, not a hidden backend.

**Primary service roots:**

- `src/services/documentWorkflow/**`
- `src/services/extensions/**`
- `src/services/references/**`
- `src/services/latex/**`
- `src/services/markdown/**`
- `src/services/pdf/**`
- `src/services/file*.js`
- `src/services/workspace*.js`
- `src/services/*Preferences.js`

**Allowed service responsibilities:**

- Import Tauri APIs.
- Call `invoke`.
- Subscribe/unsubscribe native events.
- Call Tauri plugins such as dialog, shell, clipboard, window.
- Map frontend camelCase to Rust command params.
- Map Rust responses to stable frontend DTO names.
- Provide small compatibility shims during a phase, with deletion scheduled in the same phase.

**Disallowed service responsibilities:**

- Long-lived business state.
- Reference merge policy.
- Workspace security policy.
- File path authorization.
- LaTeX compile target policy.
- Plugin host lifecycle authority.
- Persisted settings schema decisions.
- Duplicate frontend backend centers.

**Work:**

- [ ] Add a service inventory table to `ARCHITECTURE-BOUNDARY-MAP.md`.
- [ ] For each service file over 150 lines, decide whether it is bridge-heavy or policy-heavy.
- [ ] Move policy-heavy logic to Rust or pure domains depending on whether it is backend authority or UI presentation.
- [ ] Keep DTO compatibility explicit and documented.
- [ ] Delete service exports with no callers.

**Verification:**

```sh
npm run guard:ui-bridges
npm run build
npm run check:rust
npm run test:rust
```

**Commit:**

```sh
git add src/services src/domains src-tauri/src ARCHITECTURE-BOUNDARY-MAP.md
git commit -m "refactor: keep services as thin bridges"
```

**Progress notes:**

- 2026-05-03: Refreshed the service inventory in `ARCHITECTURE-BOUNDARY-MAP.md` from the current `src/services/**/*.js` line counts. Removed stale `src/services/latex/latexWorkshopSynctex.js`, removed `src/services/pdf/artifactPreview.js` from the over-150-line table after it dropped below the threshold, and added `src/services/latex/runtime.js` as a current runtime bridge review target.
- 2026-05-03: Moved LaTeX compile execution/result DTO normalization out of `src/services/latex/runtime.js` into `src/domains/latex/latexCompileResult.js`. The service now delegates response shaping to a pure domain helper, keeps Rust as compile execution authority, and drops below the over-150-line service review threshold.
- 2026-05-03: Moved app update version comparison and installer asset selection from `src/services/appUpdater.js` into `src/domains/settings/appUpdatePresentation.js`. `appUpdater.js` remains a compatibility export surface for those helpers, but its implementation is now focused on GitHub release fetch, Tauri update download/reveal commands, external release links, and download progress events.
- 2026-05-03: Removed hidden Pinia-store orchestration and long-lived sync state from `src/services/references/zoteroSync.js`. Zotero sync now takes explicit snapshot/selected-reference DTOs, returns a normalized backend result or skipped marker, and leaves snapshot application plus sync status/error UI state in `src/stores/references.js`; workspace auto-sync now calls the store action instead of the service directly.
- 2026-05-03: Moved LaTeX preview source-selection matching from `src/services/latex/previewSync.js` into `src/domains/latex/latexPreviewSelection.js`. `previewSync.js` remains a compatibility export surface for the selection helper, but its implementation now focuses on SyncTeX target resolution, editor view waiting, and source reveal side effects, dropping below the over-150-line service review threshold.
- 2026-05-03: Split workspace preference presentation and DOM side effects out of `src/services/workspacePreferences.js`. Pure defaults, font presets, font encoding, PDF viewer display normalization, and font-stack helpers now live in `src/domains/settings/workspacePreferencePresentation.js`; DOM font variables live in `src/services/workspaceFonts.js`; theme class/listener side effects live in `src/services/workspaceTheme.js`. `workspacePreferences.js` remains a compatibility export surface while dropping below the over-150-line service review threshold.
- 2026-05-03: Split Markdown preview rendering into smaller presentation services. `src/services/markdown/highlight.js` owns syntax highlighter setup and the rehype code-block highlighter, `src/services/markdown/inlineDraftSyntax.js` owns inline wiki-link draft decoration, and `src/services/markdown/preview.js` now focuses on processor composition, source anchors, sanitization, and the public render function while dropping below the over-150-line service review threshold.
- 2026-05-03: Moved LaTeX document workflow status, problem DTO shaping, and UI state presentation from `src/services/documentWorkflow/adapters/latex.js` into `src/domains/document/latexWorkflowPresentation.js`. The adapter now stays below the over-150-line service review threshold, and the refreshed service inventory has no remaining `src/services/**/*.js` or `src/services/**/*.mjs` files over that threshold.

### Phase 11: Rust Runtime Module Cleanup

**Goal:** Make Rust backend modules internally clearer without changing command names or frontend contracts.

**Primary Rust roots:**

- `src-tauri/src/lib.rs`
- `src-tauri/src/fs_*.rs`
- `src-tauri/src/workspace_*.rs`
- `src-tauri/src/references_*.rs`
- `src-tauri/src/latex*.rs`
- `src-tauri/src/python_*.rs`
- `src-tauri/src/document_workflow*.rs`
- `src-tauri/src/extension_*.rs`
- `src-tauri/src/security.rs`

**Rules:**

- Do not rename existing Tauri commands during cleanup unless a dedicated compatibility phase is added.
- Do not change JSON response shape without bridge and regression updates in the same commit.
- Prefer internal helper extraction over command churn.
- Add tests before changing normalization, persistence, path scope, merge, or runtime lifecycle behavior.

**Work:**

- [ ] Group internal helper functions by authority area: filesystem, workspace lifecycle, preferences, references, runtime execution, extension host.
- [ ] Extract repeated validation helpers into existing Rust modules rather than frontend JS.
- [ ] Add unit tests around each extracted helper.
- [ ] Keep `lib.rs` command registration readable; if command list grows harder to scan, group registration comments by subsystem without changing command names.
- [ ] Preserve existing probe binaries and Rust tests.

**Verification:**

```sh
cargo fmt --manifest-path src-tauri/Cargo.toml
npm run check:rust
npm run test:rust
npm run build
```

**Commit:**

```sh
git add src-tauri/src
git commit -m "refactor: organize rust runtime modules"
```

**Progress notes:**

- 2026-05-03: Started Phase 11 by moving workspace URI scheme handling from `src-tauri/src/lib.rs` into `src-tauri/src/workspace_protocol.rs`. `lib.rs` now keeps only protocol registration, while workspace protocol parsing, content-type mapping, scoped file resolution, and response construction are grouped under the workspace authority area with targeted unit tests. No Tauri command names, URI scheme name, or frontend payload shapes changed.
- 2026-05-03: Added subsystem grouping comments to the `tauri::generate_handler!` command registration list in `src-tauri/src/lib.rs` without changing command names, order, parameters, or response shapes.

### Phase 12: Dead Code And Compatibility Cleanup

**Goal:** Remove stale frontend backend logic, unused setters, old service exports, obsolete compatibility branches, and stale docs after each subsystem has migrated.

**Files to inspect:**

- `src/services/**`
- `src/stores/**`
- `src/domains/**`
- `src/components/**`
- `src/utils/**`
- `src/shared/**`
- `src-tauri/src/**`
- `package.json`
- `scripts/**`

**Work:**

- [ ] Use `rg` to find unused legacy function names after each subsystem phase.
- [ ] Remove old frontend normalization once Rust returns the normalized payload.
- [ ] Remove duplicate constant definitions when Rust or a domain module becomes canonical.
- [ ] Remove stale settings setter/action pairs when UI setting is gone.
- [ ] Remove comments that describe old behavior.
- [ ] Keep bridge compatibility only when existing persisted data or command payloads require it.

**Verification:**

```sh
npm run build
npm run check:bundle
npm run check:rust
npm run test:rust
```

**Commit:**

```sh
git add src src-tauri package.json scripts
git commit -m "chore: remove obsolete module glue"
```

### Phase 13: Final End-To-End Verification

**Goal:** Prove the reorganization did not break the desktop product path.

**Automated gate:**

```sh
npm run verify
```

**Manual desktop smoke path:**

- [ ] Start the app with `npm run tauri dev`.
- [ ] Open an existing workspace.
- [ ] Browse file tree and create a test Markdown file.
- [ ] Edit text in the editor without any cursor jump, selection drift, or scroll jump.
- [ ] Preview Markdown.
- [ ] Open a LaTeX file and compile if the workspace has one.
- [ ] Open a PDF preview.
- [ ] Open reference library.
- [ ] Import or edit a reference.
- [ ] Insert a citation without editor positioning regression.
- [ ] Open settings and save one harmless preference.
- [ ] Enable/disable an extension if a local extension is present.
- [ ] Close and reopen workspace; verify tabs/layout/reference state persist.

**Final commit if verification-only fixes were needed:**

```sh
git add .
git commit -m "fix: stabilize reorganized module boundaries"
```

## 4. Module Ownership Matrix

| Capability | Vue | JS services | JS domains | Pinia stores | Rust |
| --- | --- | --- | --- | --- | --- |
| Workspace open/close | buttons, dialogs, surfaces | call lifecycle commands | display policy | active workspace state | lifecycle, persisted recents, bootstrap |
| File tree | tree UI, context menus | file/tree/watch bridge | row display/sorting | selected/expanded/pending state | filesystem, watcher, security |
| File mutations | emit intent | mutation bridge | UI labels | orchestrate action | create/rename/move/delete/copy |
| Markdown preview | render preview surface | parser/runtime bridge | display-only transforms | preview state | diagnostics/headings/wiki links where backend-owned |
| LaTeX compile | controls and progress UI | compile/event bridge | UI status labels | running state | target resolution, compile, diagnostics, SyncTeX |
| PDF preview | viewer UI | file/SyncTeX bridge | UI status derivation | active preview state | PDF file access, SyncTeX |
| Python runtime | run panel UI | runtime bridge | UI status labels | running/output state | detect/list/execute/compile |
| References | library/detail UI | reference bridge | display/sort/citation chip presentation | selection/draft/loading state | import, normalize, merge, persist, Zotero, citation render |
| Settings | form controls | load/save bridge | option presentation | dirty/save state | persisted schema and normalization |
| Extensions | panels, prompts, command UI | host/event bridge | status/action presentation | active runtime UI state | host lifecycle, settings, tasks, artifacts, process |
| Editor | frozen | frozen bridge | frozen rules | frozen state | frozen session runtime |

## 5. Migration Order And Why

1. **Guards first:** Without stronger checks, cleanup can regress silently.
2. **Docs/contracts second:** Everyone needs the same boundary definition before moving code.
3. **Workspace/files before references:** References depend on workspace and file authority.
4. **Preferences/workbench before UI slimming:** UI split is safer once persisted state contracts are stable.
5. **References before document runtime polish:** Citation and PDF paths cross reference and document surfaces.
6. **Runtime systems before component slimming:** Vue slimming is safer after backend/bridge seams are stable.
7. **Dead code last:** Removing compatibility too early makes regressions harder to isolate.

## 6. What Not To Do

- Do not perform a broad rename-only directory reshuffle.
- Do not edit editor core while doing architecture cleanup.
- Do not change Tauri command names as part of cleanup.
- Do not move backend policy into `src/services` just because services can call Rust.
- Do not let Pinia stores become replacement backend modules.
- Do not use browser `localStorage` or old migration paths as a new authority source.
- Do not mix UI redesign with runtime boundary cleanup.
- Do not run one giant commit across Rust, stores, services, and UI unless it is a tiny mechanical import fix.

## 7. Recommended Commit Cadence

Use small commits with one subsystem per commit:

```sh
git status --short
npm run build
npm run check:rust
npm run test:rust
git add <only-related-files>
git commit -m "refactor: <subsystem> <boundary change>"
git push
```

For doc-only or guard-only phases:

```sh
npm run guard:ui-bridges
git add <only-related-files>
git commit -m "docs: <boundary doc change>"
git push
```

For high-risk runtime phases:

```sh
npm run verify
git add <only-related-files>
git commit -m "refactor: <subsystem> runtime authority"
git push
```

## 8. Acceptance Criteria

This reorganization is successful only when all of the following are true:

- `npm run verify` passes.
- No non-service frontend file imports Tauri APIs.
- `src/domains/**` contains no native bridge, persistence, filesystem, or process authority.
- `src/services/**` functions are thin bridge wrappers or explicitly documented DTO adapters.
- Rust owns reference normalization, filesystem mutation, workspace security, runtime execution, settings persistence, plugin host authority, and persisted state.
- Large Vue components are either UI-only or have a documented follow-up split plan.
- Editor frozen files are unchanged unless the user explicitly approved a separate editor phase.
- Manual desktop smoke confirms editor cursor/selection behavior did not regress.
- Every code/config/doc phase has a focused commit and push.

## 9. First Execution Slice

Start with this minimal slice before touching subsystem behavior:

- [ ] Create `ARCHITECTURE-BOUNDARY-MAP.md`.
- [ ] Add the editor freeze list and current module inventory.
- [ ] Expand bridge guard coverage.
- [ ] Run `npm run guard:ui-bridges`.
- [ ] Run `npm run build`.
- [ ] Commit and push.

This first slice gives the rest of the cleanup a stable map and prevents accidental editor or bridge drift before deeper Rust/Vue/JS refactors begin.
