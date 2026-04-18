# Altals Rust-Native Editor Migration Closeout

> **For agentic workers:** this document is a closeout record for the migration itself. Do not reopen this plan to track post-cutover feature recovery. Use the follow-up plan instead: `docs/superpowers/plans/2026-04-19-rust-native-editor-feature-recovery.md`.

**Goal:** Replace Altals' former WebView-hosted CodeMirror editor with a Rust-native editor runtime and make that runtime the only active workbench text surface.

**Outcome:** Completed. The desktop workbench now routes text editing through the native runtime path, and the old CodeMirror surface/dependencies have been removed.

---

## Final Verdict

- Migration status: complete
- Cutover status: complete
- CodeMirror removal status: complete
- Remaining editor-assist gaps: intentionally moved out of this plan and tracked separately

This closeout means the repository no longer treats “replace CodeMirror with the Rust-native runtime” as open migration work. Any remaining missing ergonomics or presentation features are follow-up product/runtime tasks, not migration blockers.

---

## Scope That This Plan Covers

This migration plan is closed once all of the following are true:

- the active workbench editor surface is `NativePrimaryTextSurface.vue`
- text state, selection sync, dirty state, persistence, and runtime document state flow through the native runtime
- Markdown and LaTeX still participate in toolbar, preview, outline, diagnostics, citation, and SyncTeX/document workflow paths
- CodeMirror source files and npm dependencies are removed from the active product path

This plan does **not** remain open for post-cutover feature rebuilding such as syntax highlighting, autocomplete, snippets, or context-menu parity. Those now live in a separate recovery plan.

---

## Delivered Migration Outcomes

### Runtime and cutover

- [x] Editor runtime contract extracted
- [x] Rust editor core scaffolded
- [x] Native helper/runtime bridge landed
- [x] Tauri runtime lifecycle and document bridge landed
- [x] Workbench switched to the native primary text surface
- [x] Native runtime became the active text source-of-truth path

### Workflow preservation

- [x] diagnostics bridge
- [x] outline bridge
- [x] Markdown preview sync bridge
- [x] LaTeX SyncTeX bridge
- [x] citation insert/update bridge
- [x] file-tree drag insertion bridge
- [x] Markdown toolbar and preview shell flow preserved
- [x] LaTeX toolbar, compile, preview, and sync shell flow preserved

### Deletion and cleanup

- [x] `TextEditor.vue` removed from the active path
- [x] `src/editor/*` CodeMirror-era editor modules removed
- [x] CodeMirror npm dependencies removed
- [x] workbench surface routing consolidated on the native path

---

## Closeout Notes

### What changed architecturally

- Rust/Tauri-native runtime now owns the editor state path.
- Vue remains the workbench shell and host surface.
- The former WebView-hosted CodeMirror editor is no longer part of the active desktop product architecture.

### What is intentionally not tracked here anymore

The following are real follow-up tasks, but they are no longer classified as “migration incomplete”:

- syntax highlighting and token theming
- gutter and visual feedback rebuilding
- Markdown assist recovery
- LaTeX assist recovery
- context menu and editor-shell interaction parity

They are tracked in:

- `docs/superpowers/plans/2026-04-19-rust-native-editor-feature-recovery.md`

---

## Verification Record

The migration closeout should continue to rely on the verification evidence already gathered during cutover:

- `cargo test --manifest-path src-tauri/Cargo.toml -p altals-editor-core`
- `cargo build --manifest-path src-tauri/Cargo.toml`
- `npm run build`
- desktop/manual verification of:
  - Markdown open/edit/save/preview
  - LaTeX open/edit/compile/preview/SyncTeX
  - citations
  - outline/diagnostics
  - file-tree drag insertion

If a later regression appears in one of those already-landed paths, fix it under the current product/runtime workstream without reopening this migration plan.

---

## Explicit Boundary After Closeout

Do not use this file to track:

- parser-backed presentation work
- autocomplete/snippet rebuilding
- hover/context-menu restoration
- advanced editor visuals

Those belong to the dedicated follow-up plan.

---

## Next Plan

Continue in:

- `docs/superpowers/plans/2026-04-19-rust-native-editor-feature-recovery.md`
