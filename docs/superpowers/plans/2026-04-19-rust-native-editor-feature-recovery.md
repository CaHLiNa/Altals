# Altals Rust-Native Editor Feature Recovery Plan

> **For agentic workers:** this plan starts after the Rust-native editor migration cutover is already closed. Do not reintroduce CodeMirror, do not add a user-facing fallback editor, and do not turn `NativePrimaryTextSurface.vue` back into a large semantics component.

**Goal:** Rebuild the missing editor presentation and assist-layer capabilities on top of the Rust-native editor path so Markdown and LaTeX authoring regain the usability that existed before CodeMirror was removed.

**Architecture:** Rust owns editor semantics, context inspection, completion/snippet planning, and presentation snapshot generation. Vue owns host DOM, popups, menus, overlays, and workbench-level side effects.

**Non-goal:** This is not a migration plan and not a visual redesign. It is a post-cutover capability recovery plan.

---

## Current Gap Inventory

The active native primary surface is still missing these capability groups:

1. syntax highlighting and token theming
2. gutter rendering for line numbers and fold affordances
3. active-line / selection-match / bracket-match / drop-cursor visual feedback
4. Markdown footnote and math hover preview
5. Markdown formatting shortcuts
6. Markdown slash snippets popup
7. wiki-link autocomplete
8. Markdown inline semantic decorations for wiki links and citations
9. Markdown table insert / format commands
10. LaTeX autocomplete popup
11. project-aware LaTeX completions for cite/ref/input/bibliography flows
12. LaTeX inline citation decorations and annotation
13. editor context menu parity

---

## Guardrails

- Do not reintroduce CodeMirror code or dependencies.
- Do not rebuild long-term editor semantics as Vue-only regex logic if the same logic belongs in Rust.
- Keep `NativePrimaryTextSurface.vue` thin; move policy and semantic planning into Rust or `src/domains/editor/*`.
- Preserve the existing desktop shell look and feel unless a minimal visual change is required to restore parity.
- Maintain Markdown and LaTeX workflow compatibility while rebuilding assist layers.

---

## Primary Files

### Native/runtime side

- `src-tauri/src/native_editor_bridge.rs`
- `src-tauri/src/native_editor_runtime.rs`
- `src-tauri/src/lib.rs`
- `src/services/editorRuntime/nativeBridge.js`
- `src/stores/editorRuntime.js`

### Domain and host side

- `src/domains/editor/nativePrimarySurfaceRuntime.js`
- `src/components/editor/NativePrimaryTextSurface.vue`
- `src/components/editor/EditorContextMenu.vue`

### Existing workflow surfaces that must keep working

- `src/components/editor/DocumentWorkflowBar.vue`
- `src/services/documentWorkflow/adapters/markdown.js`
- `src/services/documentWorkflow/adapters/latex.js`
- `src/services/markdown/previewSync.js`
- `src/services/latex/previewSync.js`
- `src/domains/document/documentWorkspacePreviewRuntime.js`

---

## Task 1: Rebuild Rust-Native Presentation Primitives

**Status:** pending

**Goal:** restore the visual/editorial affordances that disappeared when CodeMirror rendering was removed.

- [ ] **Step 1: Define a native presentation snapshot contract**

Rust should expose a typed visible-slice snapshot that can describe:

- per-line visible spans
- token classes for syntax highlighting
- semantic marks for wiki links and citations
- active line
- selection ranges
- selection-match ranges
- bracket-match ranges
- optional drop-cursor position

- [ ] **Step 2: Implement Rust-side visible-slice tokenization hooks**

Start with Markdown and LaTeX token classes only. The first version must not hardcode tokenization in Vue.

Minimum Rust-provided token/semantic coverage:

- headings
- emphasis and strong
- code spans and fences
- links and URLs
- list markers
- LaTeX commands
- LaTeX math-ish command spans
- comments where applicable
- citation and wikilink semantic spans

- [ ] **Step 3: Add a Vue host rendering layer without reintroducing CodeMirror**

`NativePrimaryTextSurface.vue` should render a visual text layer using Rust-provided presentation spans.

Expected output:

- syntax-highlighted visible text
- semantic decoration classes for wiki links and citations
- active-line visual state
- selection and reveal visuals consistent with the current editor chrome

- [ ] **Step 4: Restore gutter rendering**

Requirements:

- stable line-number alignment
- no layout jitter on scroll
- current-line emphasis remains intact
- gutter does not break Markdown/LaTeX preview sync interactions

- [ ] **Step 5: Restore editor visual feedback primitives**

Restore:

- active line
- selection matches
- bracket match
- reveal target highlight
- drop cursor visualization for file drops

- [ ] **Step 6: Verify presentation parity**

Run:

```bash
npm run build
```

Then manually verify on both Markdown and LaTeX files:

- syntax colors are present
- gutter is present
- active line and reveal highlight are visible
- file-drop insertion still shows an intelligible target

---

## Task 2: Rebuild Markdown Assist and Semantic Editing

**Status:** pending

**Goal:** restore Markdown authoring ergonomics without putting long-term editor semantics back into Vue-only logic.

- [ ] **Step 1: Rebuild Markdown formatting shortcuts**

Restore:

- `Mod-b` bold toggle
- `Mod-i` italic toggle
- `Mod-Shift-x` strikethrough toggle
- `Mod-e` inline code toggle
- `Mod-k` insert link
- blockquote toggle
- ordered-list toggle
- unordered-list toggle

Transformation planning should come from Rust.

- [ ] **Step 2: Rebuild Markdown slash snippets**

Restore commands such as:

- `/h1`, `/h2`, `/h3`
- `/quote`
- `/list`, `/olist`
- `/code`
- `/math`
- `/footnote`
- `/image`
- `/table`

Requirements:

- Rust identifies snippet-trigger context and candidate set
- Vue hosts the popup and applies the selected replacement plan
- snippets must not trigger inside code spans or fences

- [ ] **Step 3: Rebuild wiki-link autocomplete**

Restore:

- file name completion
- heading completion after `#`
- proper replacement and cursor placement
- no activation inside code contexts

- [ ] **Step 4: Rebuild Markdown inline semantic decorations**

Restore visible differentiation for:

- valid wiki links
- broken wiki links
- citation groups
- broken citation keys

- [ ] **Step 5: Rebuild Markdown hover affordances**

Restore:

- footnote hover preview
- inline math hover preview
- display math hover preview

- [ ] **Step 6: Rebuild Markdown table commands**

Restore:

- insert table action
- format current table action
- keyboard shortcuts for table commands
- context menu exposure where previously available

- [ ] **Step 7: Verify Markdown assist parity**

Manual acceptance must cover:

- shortcut toggles
- slash snippets
- wikilink completion
- broken-link styling
- footnote/math hover
- table insert/format

---

## Task 3: Rebuild LaTeX Assist and Semantic Editing

**Status:** pending

**Goal:** restore LaTeX authoring assist, project-aware completions, and visual semantic cues.

- [ ] **Step 1: Rebuild static LaTeX command autocomplete**

Restore structured completion for:

- sectioning commands
- text formatting commands
- environment snippets
- math commands
- include / bibliography commands
- document setup commands

- [ ] **Step 2: Rebuild project-aware LaTeX completions**

Restore completion flows for:

- cite / nocite
- ref / eqref / pageref / autoref / cref
- input / include / subfile
- bibliography / addbibresource

This work should reuse existing project graph/document intelligence services as data inputs while keeping completion context parsing in Rust.

- [ ] **Step 3: Rebuild LaTeX citation decorations**

Restore visible differentiation for:

- LaTeX citation commands
- citation keys
- broken citation keys
- optional post-citation inline annotation such as author/year

- [ ] **Step 4: Preserve formatter integration on the native path**

Ensure the native path still fully supports:

- explicit format-document command
- format-on-save
- no cursor corruption after formatting
- no dirty-state desynchronization after formatting

- [ ] **Step 5: Verify LaTeX assist parity**

Manual acceptance must cover:

- autocomplete popup appearance and insertion
- cite/ref/input completions against a real project graph
- citation decoration visibility
- format document
- format on save

---

## Task 4: Rebuild Shell-Level Editor Interaction Parity

**Status:** pending

**Goal:** restore the remaining shell behaviors that were previously provided by the old editor path.

- [ ] **Step 1: Reconnect the editor context menu**

Restore `EditorContextMenu.vue` integration for:

- right-click / control-click open behavior
- selection-aware actions
- Markdown table actions where applicable
- LaTeX format-document action where applicable

- [ ] **Step 2: Rebuild command routing for context-sensitive actions**

The native surface should expose:

- format document
- insert Markdown table
- format Markdown table
- citation edit/insert where contextually valid

- [ ] **Step 3: Verify selection and interaction fidelity**

Check:

- double-click behavior
- right-click does not destroy selection unexpectedly
- keyboard save and formatting commands still work
- drag insertion still works after context-menu and presentation changes

- [ ] **Step 4: Document the final host/runtime responsibility split**

Update docs so the architecture is explicit:

- Rust owns editor semantics, context inspection, completion planning, and presentation snapshots
- Vue owns host DOM, popups, menus, and workbench-level side effects

---

## Task 5: Final Recovery Audit and Sign-Off

**Status:** pending

**Goal:** close the feature recovery work with a verification loop that matches the real editor feature surface.

- [ ] **Step 1: Run code-level verification**

Run the smallest complete set available for the changed slice:

```bash
cargo test --manifest-path src-tauri/Cargo.toml -p altals-editor-core
```

```bash
cargo build --manifest-path src-tauri/Cargo.toml
```

```bash
npm run build
```

- [ ] **Step 2: Run desktop workflow verification**

Run:

```bash
npm run tauri -- dev
```

Verify at minimum:

- Markdown draft with toolbar and preview
- Markdown formatting shortcuts
- Markdown snippets and wikilinks
- LaTeX toolbar, compile, preview, and SyncTeX
- LaTeX autocomplete and formatter integration
- file-tree drag insertion
- citation insert and citation edit

- [ ] **Step 3: Run a checklist against the full missing-groups inventory**

This work cannot be signed off until all 13 missing groups listed at the top are marked resolved with evidence.

- [ ] **Step 4: Run final postflight audit**

If the repository script is usable, run:

```bash
npm run agent:codex-postflight -- --plan docs/superpowers/plans/2026-04-19-rust-native-editor-feature-recovery.md
```

If that script is not usable in the environment, perform a manual audit and record:

- completed tasks
- pending tasks
- deviations
- risks
- verification evidence
- next step

- [ ] **Step 5: Only then declare feature recovery complete**

Completion criteria:

- all 13 missing groups are resolved
- no user-visible workflow still depends on deleted CodeMirror code
- docs describe the native editor architecture accurately

---

## Recommended Execution Order

1. Task 1: presentation primitives
2. Task 2: Markdown assist
3. Task 3: LaTeX assist
4. Task 4: shell interaction parity
5. Task 5: final audit and sign-off

Do not stop after restoring only one or two obvious regressions.
