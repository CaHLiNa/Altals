# ScribeFlow Current State

Last updated: 2026-05-02

## Product

ScribeFlow is a local-first Tauri desktop workbench for academic writing and research.

Current desktop paths:

- open, close and reopen local workspaces
- browse and mutate the workspace file tree
- restore editor tabs, document dock tabs and recent files
- edit Markdown, LaTeX and Python documents
- preview Markdown, compile LaTeX, inspect PDF output and run Python
- manage references from BibTeX, PDF metadata and Zotero
- insert Markdown and LaTeX citations
- sync selected document references into LaTeX bibliography files
- inspect where references are cited in the workspace
- configure editor, workspace, PDF, citation, environment, Zotero, extensions and update settings
- discover local plugin packages, enable or disable them, and configure host-managed plugin settings in Settings
- activate enabled plugins immediately so runtime-only commands, menus, and views become available without waiting for a later user action
- deactivate disabled plugins through the host runtime so plugin-local `deactivate()` logic can release resources instead of relying only on frontend state cleanup
- restart the persistent extension host automatically after a host-process crash so the next activation or command request can recover without restarting the desktop app
- render plugin surfaces as document right sidebar tabs, resolve tree roots and child nodes from the plugin host, support reveal and selection events, and surface host-rendered quick input flows for plugins
- enforce one activitybar view container per plugin so each normal plugin maps to one document right sidebar tab/container
- route PDF actions, command invocations and view reveal requests into the matching plugin-owned right sidebar tab by default
- expose thicker runtime APIs for plugins through `context.workspace`, `context.documents`, `context.invocation`, `context.references`, `context.pdf` and `context.process`
- allow process-driven plugins to `spawn` local workers and explicitly `wait` for completion through the Rust-backed host bridge
- support `context.window.showQuickPick(..., { canPickMany: true })` end-to-end so plugin quick-pick flows can return multi-select arrays instead of only single values
- persist plugin `globalState` and `workspaceState` through the Rust runtime and restore both scopes on later activation
- propagate host-managed extension setting changes into activated plugins through `context.settings.onDidChange(...)`
- store schema-declared secure plugin settings in secure host-managed keychain storage instead of plain `extension-settings.json`, while legacy secret-like keys still use a compatibility fallback until plugin manifests declare `secureStorage`
- prefer runtime-registered plugin actions for command palette, PDF preview actions, view title actions and view item actions
- expose reference-aware and PDF-aware runtime context through `context.references` and `context.pdf`
- allow plugins to query the current reference library, inspect PDF metadata/text, and run permission-gated local processes through the Rust-backed host bridge

## Architecture

- `src/app`: desktop lifecycle and shell orchestration
- `src/components`: Vue UI surfaces
- `src/composables`: UI composition and interaction helpers
- `src/domains`: frontend pure rules and state transitions
- `src/services`: Tauri bridge and side-effect boundary
- `src/stores`: Pinia coordination state
- `src-tauri/src`: Rust runtime authority for filesystem, workspace access, sessions, preferences, references, LaTeX, Python, extensions and updates

Boundary rules:

- Vue components, stores, domains and composables do not import Tauri APIs directly.
- Tauri `invoke`, Tauri plugin calls and event bridges belong in `src/services`.
- Rust owns filesystem authority, persisted app state, reference normalization, compile/runtime execution and workspace-scoped security checks.
- Rust owns plugin discovery, manifest validation, plugin host startup, command execution, task state and artifact access.
- Rust manifest validation enforces the single-container right-sidebar contract for normal plugins.
- Vue owns plugin prompt rendering, plugin sidebar rendering, command palette integration and runtime event presentation through the `src/services` bridge.
- JS remains a thin bridge and UI coordination layer, not a second backend.

Plugin architecture direction:

- runtime registration first
- manifest as bootstrap metadata
- Obsidian-style plugin model with Rust authority retained
- current platform contract is runtime-first for local owner-authored plugins; remaining work is additive host API growth rather than a direction reset

Current plugin result contract:

- plugin runtime can return `resultEntries`, `artifacts`, and `outputs` from task, capability, and view flows
- frontend merges host-generated default preview entries from `artifacts` and `outputs` only when explicit `resultEntries` leave gaps
- task-owned artifact metadata is anchored to the host invocation envelope
- direct view and pushed view-state artifacts may preserve explicit plugin metadata when they represent view-owned state instead of task-owned execution state

Current plugin lifecycle contract:

- disabling an extension is a real authority boundary, not only a UI toggle
- disabled extensions cannot execute commands, invoke capabilities, resolve views, or receive view-selection callbacks
- disabling an activated extension requests host-side runtime deactivation and then clears frontend runtime/view/controller state
- enabling an extension immediately re-activates its runtime registration so runtime-only commands and menus are visible again
- direct host deactivation is now probe-backed: `Activate -> Deactivate -> Reactivate` succeeds and plugin `deactivate()` state can be observed
- host-process crash recovery is now probe-backed: a crashing command tears down the dead process handle, and the next host request respawns the persistent runtime and succeeds
- host interruption during a pending window prompt is now probe-backed: waiting prompt flows fail fast when the host dies, the pending UI request is interrupted immediately, and the frontend prompt is cleared instead of lingering until timeout
- quick-pick multi-select is now probe-backed: picked defaults hydrate into the prompt, UI selection can accumulate multiple items, and the host roundtrip preserves an array result payload
- runtime state persistence is now probe-backed: plugin `globalState` survives across later host activations and spans workspaces, while `workspaceState` restores only within the originating workspace root

## Verification

Use one local engineering gate:

```sh
npm run verify
```

It runs:

- `npm run guard:ui-bridges`
- `npm run guard:pdf-runtime`
- `npm run guard:textmate-runtime`
- `npm run probe:extension-host`
- `npm run probe:extension-markdown-host`
- `npm run probe:extension-view-result-entries`
- `npm run probe:extension-pdf-view-result-entries`
- `npm run probe:extension-direct-view-host`
- `npm run probe:extension-capability-execution`
- `npm run probe:extension-capability-schema`
- `npm run probe:extension-activation-guards`
- `npm run probe:extension-permission-guards`
- `npm run probe:extension-disable-guards`
- `npm run probe:extension-enable-activation`
- `npm run probe:extension-deactivation-host`
- `npm run probe:extension-secure-settings-bridge`
- `npm run probe:extension-sidebar-routing`
- `npm run probe:extension-text-preview-fallback`
- `npm run probe:extension-artifact-preview-entries`
- `npm run probe:extension-task-timeline`
- `npm run probe:extension-host-recovery`
- `npm run probe:extension-window-interruption`
- `npm run probe:extension-host-ui-interruption`
- `npm run probe:extension-quickpick-multiselect`
- `npm run probe:extension-window-prompt-multiselect`
- `npm run probe:extension-quickpick-host-multiselect`
- `npm run probe:extension-host-state-persistence`
- `npm run build`
- `npm run check:bundle`
- `npm run check:rust`
- `npm run test:rust`

Current baseline:

- UI bridge guard passes
- PDF runtime boundary guard passes
- TextMate runtime boundary guard passes
- extension host runtime probe passes
- extension markdown host probe passes
- extension view result-entry merge probe passes
- extension PDF view result-entry merge probe passes
- extension direct-view host probe passes
- extension capability execution probe passes
- extension capability schema probe passes
- extension activation guard probe passes
- extension permission guard probe passes
- extension disable guard probe passes
- extension enable activation probe passes
- extension deactivation host probe passes
- extension secure settings bridge probe passes
- extension sidebar routing probe passes
- extension text preview fallback probe passes
- extension artifact preview mapping probe passes
- extension task timeline probe passes
- extension host recovery probe passes
- extension window interruption probe passes
- extension host UI interruption probe passes
- extension quick-pick multiselect logic probe passes
- extension window prompt multiselect probe passes
- extension quick-pick host multiselect probe passes
- extension host state persistence probe passes
- Vite build passes
- bundle budget passes
- Rust check passes
- Rust tests pass: 182 tests

Desktop feel, visual layout and interaction quality are user-owned manual checks.

## Runtime Contracts

Heavy runtime boundaries:

- PDFium / EmbedPDF stays behind PDF preview surfaces and `src/services/pdf/*`.
- TextMate / Oniguruma stays behind the LaTeX editor dynamic import path.
- Ordinary JS chunks stay below the bundle budget enforced by `scripts/check-bundle-budget.mjs`.

State contracts:

- workspace lifecycle state is stored under the global ScribeFlow config directory
- workspace-specific state is stored under the resolved workspace data directory
- reference library state is stored under global ScribeFlow references data
- old localStorage and old per-workspace migration paths are no longer part of the runtime contract

## Current Scope

Completed engineering scope:

- research-to-writing reference loop
- citation insertion and usage inspection
- leaf Rustification for read-only parsing, diagnostics, path status and resolver seams
- bundle size and heavy runtime loading guards
- cleanup of historical migration code
- rewritten current documentation and README

Not in scope:

- restoring removed `docs/` or `web/` trees
- reintroducing historical sidecar scripts
- adding automated desktop smoke, visual review or interaction QA
- continuing Rustification into editor shell, shared workflow or UI-local parser code without a new phase decision
