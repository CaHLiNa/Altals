# Overleaf-Style Single-Tab Document Preview Design

## Goal

Change document preview for `Markdown`, `LaTeX`, and `Typst` so the main user path matches Overleaf more closely:

- one document tab represents one source file
- the tab itself can render an internal two-column workspace
- the left side stays on the editable source document
- the right side shows preview only when a real preview is available
- preview should no longer require opening a separate preview tab or neighbor pane on the main path

This keeps Altals aligned with the local-first document workflow while making the preview experience calmer and more document-centered.

## Current State

The repository already has strong preview infrastructure, but it is pane-based rather than single-tab workspace-based.

- `src/components/editor/EditorPane.vue` renders one viewer per active tab path
- `src/composables/useEditorPaneWorkflow.js` wires document actions such as compile and preview
- `src/domains/document/documentWorkflowRuntime.js` reconciles preview tabs and neighbor panes
- `src/domains/document/documentWorkflowTypstPaneRuntime.js` adds Typst-specific preview/PDF pane coordination
- `src/components/editor/DocumentPdfViewer.vue`, `src/components/editor/MarkdownPreview.vue`, and `src/components/editor/TypstNativePreview.vue` already provide the main preview surfaces

Today the document workflow still treats source tabs and preview tabs as separate shell objects. That works, but it makes the experience feel like a window-management task instead of a single document workspace.

## User-Validated Direction

The validated target behavior is:

- `Markdown`, `LaTeX`, and `Typst` open as a single source-file tab
- that tab may internally become a left-right split workspace
- right-side preview appears automatically by default when a valid preview exists
- if there is no available PDF, HTML, or native preview, the tab remains single-column
- this should not rely on the external pane system for the default document path

The user explicitly prefers the single-tab internal split instead of reusing adjacent panes.

The user also explicitly confirmed that the first version should cover `Markdown`, `LaTeX`, and `Typst`, and that no split should appear when there is no real PDF, HTML, or native preview to show.

## Approaches Considered

### Approach A: Dedicated document workspace tab container

Create a new document workspace container that owns internal left-right composition for source + preview.

Pros:

- closest match to the requested Overleaf-style interaction
- keeps `EditorPane` from growing more special-case logic
- preserves existing preview components with smaller adapters
- creates a clearer seam for future document-only UI such as drag resize, preview mode switches, or synchronized scroll status

Cons:

- requires a new composition layer and some adapter work around preview inputs
- needs careful compatibility handling with old preview-tab state

### Approach B: Inline branching directly inside `EditorPane.vue`

Render all document split logic directly inside `EditorPane.vue` with more conditional branches.

Pros:

- lower initial file count
- may ship quickly for a first prototype

Cons:

- makes an already large component more coupled
- mixes shell tab concerns with document-workspace orchestration
- raises long-term maintenance cost

### Approach C: Keep real preview tabs and fake a unified tab UI

Leave preview tabs and pane runtime behavior mostly intact, but visually merge source and preview into one shell.

Pros:

- reuses more existing pane logic

Cons:

- creates two sources of truth between visible UI and underlying tab state
- increases edge-case risk around restore, close, focus, and cached panes
- does not honestly model the requested interaction

## Recommendation

Use Approach A.

It best matches the user request, fits the repository direction toward clearer app/domain/service seams, and avoids pretending a pane-based model is a true single-tab document workspace.

## Proposed Design

### 1. Add a document workspace component

Introduce a new editor component, tentatively `src/components/editor/DocumentWorkspaceTab.vue`, responsible for rendering a single source-file tab as either:

- single-column source editing, or
- two-column source + preview

This component becomes the presentation seam for `Markdown`, `LaTeX`, and `Typst` source files.

The left column hosts the editable source surface. The right column hosts the preview surface only when preview availability is true.

This component should stay render-only. It should not own compile-target resolution, preview availability rules, legacy preview compatibility interpretation, or workspace persistence decisions.

### 2. Route source document types through the new workspace tab

Update `src/components/editor/EditorPane.vue` so source document tabs for these kinds render through the new workspace tab instead of relying on separate preview tab activation:

- `Markdown` source files
- `LaTeX` source files
- `Typst` source files

Non-document viewers such as raw PDF tabs, images, notebooks, CSV, chat, and references keep their current paths.

### 3. Introduce a document preview availability view-model

Add a thin derived runtime that answers:

- whether the current source file should use the single-tab document workspace
- which preview mode is currently preferred
- whether a usable preview currently exists
- which preview component should render on the right

This runtime should not reopen the old pane-oriented preview path by default. Instead, it should interpret workflow/build state into tab-local preview display decisions.

The runtime should live under `src/domains/document/*`. A composable may adapt that runtime to Vue refs, but the rules themselves should not live in a component or become a UI-owned side path.

Expected preview resolution:

- `Markdown`: render preview inline from the source file. In the first slice, any source file that already enters the Markdown editing path should default to split layout and use the existing markdown preview pipeline. If preview rendering fails, keep the split and show the existing preview error state in the right column.
- `LaTeX`: render right-side `DocumentPdfViewer` only when a usable PDF artifact exists for the current file's resolved compile target or main document, not merely by guessing a sibling PDF path from the current source file. If the current file belongs to a larger multi-file project but no compile target can be resolved yet, keep single-column layout and show workflow status instead of forcing an empty preview column.
- `Typst`: prefer `TypstNativePreview` when the current file can be resolved into a valid Typst preview root or compile entry. If native preview is unavailable, fall back to `DocumentPdfViewer` only when a usable PDF artifact exists for the resolved compile target. If neither resolution path succeeds, keep single-column layout.

### 4. Preserve the document workflow header, but change its meaning

`src/components/editor/DocumentWorkflowBar.vue` remains the main control strip, but its actions change from pane-opening semantics to workspace-local preview semantics.

New intent model:

- `Preview` means show or refresh the right-side preview inside the current tab
- `Compile` means rebuild the document and update the right-side preview if an artifact becomes available
- `PDF` on Typst means switch the right-side preview mode to PDF inside the same tab

The control bar should still expose build and AI actions, but those actions should target the current document workspace rather than a neighboring preview pane.

`Preview` must not silently become a second compile button. It may reveal an already-available preview or request a lightweight refresh where the existing preview surface already supports that. Full artifact generation remains the responsibility of `Compile` and existing build actions.

### 5. Keep old preview tabs as compatibility-only behavior

The repository already persists and understands preview paths such as `preview:` and `typst-preview:` plus artifact PDF tabs. Those should not be broken immediately.

Compatibility policy:

- existing saved workspace state that still contains preview tabs can continue to load
- explicit direct opening of PDF files remains supported as an independent viewer path
- the new default source-document path no longer creates preview tabs or neighbor panes as its primary behavior
- old `preview:` / `typst-preview:` / artifact PDF tabs are read-compatibility objects, not the preferred write path for new source-document interactions
- when a user opens a `Markdown`, `LaTeX`, or `Typst` source file through the new path, that source file should render as one document workspace tab even if an older workspace also still contains legacy preview tabs
- first-slice migration should prefer compatibility over aggressive cleanup: legacy preview tabs may remain loadable until explicitly closed, but the new source-document path should not recreate them after close/reopen
- workspace persistence should stop writing newly created default document preview state as neighbor preview tabs or split preview panes; old restored preview tabs may remain serialized until a later dedicated cleanup slice defines one-time normalization
- if an old workspace restores both a legacy preview tab and the matching source file, the restored legacy tab may continue to exist until the user closes it, but reopening the source file must still use the new single-tab workspace path and must not create another legacy preview object
- this first slice does not require automatic deduplication or forced hiding of restored legacy preview tabs; it only requires that new default source-document interactions stop producing them
- restored legacy preview tabs are strictly read-only compatibility surfaces: they may display already-restored content, but they must not become the owner of new preview creation, preview refresh routing, compile-result attachment, neighbor-pane reconstruction, workspace-layout writeback, or source-tab preview state decisions
- all new preview state, preview-mode switching, compile/preview result ownership, and persistence write semantics belong to the source document workspace tab; legacy preview tabs must not drive that state machine in reverse

This keeps the migration incremental while shifting the main UX to the new model.

## Ownership and Source of Truth

The implementation should keep rendering and workflow decisions separate.

- `src/components/editor/DocumentWorkspaceTab.vue` owns layout, split rendering, and event emission only
- a runtime under `src/domains/document/*` owns preview availability, preview-mode selection, compile-target resolution, legacy preview compatibility interpretation, and the decision to write only the new default model
- `src/stores/documentWorkflow.js` may expose accessors and action entry points, but should not duplicate a second tab-local rules engine
- any Vue composable should remain a thin adapter over the runtime rather than becoming the real owner of document preview logic

The same runtime should reuse existing workflow/build state as the only fact source for artifact readiness and source-to-target relationships. The tab component must not invent a second local inference path.

## Persistence Migration Semantics

This slice needs explicit read/write semantics for workspace persistence.

- read-old: restored workspaces may still contain `preview:`, `typst-preview:`, artifact PDF tabs, or pane-based preview layouts, and those must remain loadable for compatibility
- write-new: opening `Markdown`, `LaTeX`, or `Typst` through the new default path must no longer serialize newly created legacy preview tabs or neighbor preview panes as part of document preview behavior
- owner: the interception that prevents new legacy preview serialization should live in a document runtime or persistence-facing seam, not in the rendering component
- round-trip expectation: after opening a source document through the new path and saving/restoring workspace state, the document should come back as a single source-file tab with internal split behavior rather than as a newly written preview-tab pair
- non-goal for this slice: automatic one-time normalization of every old saved workspace payload

## Data Flow

Primary source-file tab flow:

1. user opens a `Markdown`, `LaTeX`, or `Typst` source file
2. `EditorPane` routes the source tab into the document workspace component
3. the workspace view-model inspects file type plus workflow/build availability
4. left editor always renders the source file
5. right preview renders only when the chosen preview mode is actually available
6. compile/preview actions update the same workspace instead of creating another shell tab

This turns preview from a shell-layout concern into a document-surface concern.

The preview-availability runtime should reuse existing document workflow and build state as its only fact source for artifact readiness and compile-target resolution.

## Error Handling and Empty States

- If `LaTeX` or `Typst` has no generated PDF yet, keep source-only layout
- If `Typst` native preview cannot start, fall back to PDF only if a valid PDF artifact exists; otherwise keep source-only layout with status messaging
- If `Markdown` preview render fails, keep the right column visible only when the system still considers the preview available; show the existing preview error state inside the right column
- If a preview disappears because an artifact is removed or invalidated, collapse back to source-only layout instead of keeping an empty preview shell
- If a source file is part of a larger `LaTeX` or `Typst` project but the main build target cannot yet be resolved, do not guess; stay in source-only mode and surface the unresolved-target status through the existing document workflow state

## Layout and Interaction Rules

- default behavior is automatic: source document opens in the single-tab workspace path
- right column only appears when there is a real preview to show
- first version uses a stable fixed split ratio close to 50/50
- first version does not include a drag handle, hidden resize affordance, or user-facing ratio control
- split ratio is controlled only by implementation constants in the first slice
- the whole experience should feel like a wider single document tab rather than two separate shell tabs

This matches the user's explicit preference for one tab that effectively occupies the width of two previous tabs.

## Architectural Placement

- `src/components/editor/DocumentWorkspaceTab.vue`: visual layout and child composition only
- `src/domains/document/*`: derived document-workspace preview state, target resolution, preview-mode selection, compatibility interpretation, and migration-facing write rules
- `src/stores/documentWorkflow.js`: may expose thinner helper APIs for preview mode and artifact readiness, but should not regain pane-first assumptions on the new path or duplicate runtime decisions

The exact logic split should keep workflow decisions out of the component while avoiding unnecessary new store state if the data can be derived from existing workflow/build state.

## Migration Notes

- do not delete legacy preview-tab logic in the same slice unless it becomes dead and trivially removable
- do not break restored workspaces that still reference preview tabs
- do not regress direct raw PDF viewing behavior
- prefer adapting existing preview components over rewriting them
- keep preview-tab compatibility and migration interpretation out of presentation components as much as possible; compatibility decisions should stay in domain/runtime or store-facing seams
- first-slice persistence policy is read-old, write-new: read old preview-tab workspace state if present, but do not create new default preview-tab neighbors for source-document preview after this change
- do not attempt one-shot cleanup of old preview tabs during restore in the same slice; cleanup semantics should be explicit and can land later as a separate migration slice if needed

## Testing Strategy

Add focused coverage for the new document workspace decision path.

Recommended validation:

- unit tests for preview availability and preview-mode selection decisions
- targeted component or runtime tests for source-only vs split-workspace rendering rules
- regression checks that old preview paths can still be interpreted without breaking editor startup
- regression checks that newly opened `Markdown`, `LaTeX`, and `Typst` source files no longer create default neighbor preview panes or dedicated preview tabs
- regression checks that a restored old workspace with legacy preview tabs still loads without breaking the editor shell
- regression checks that saving workspace state after using the new source-document path does not write new `preview:` / `typst-preview:` / neighbor-pane preview state
- restore round-trip checks that a newly saved document workspace comes back as a single source-file tab using internal split behavior
- regression checks that closing a source tab from the new document workspace path does not leave behind a newly created preview object
- regression checks that compile or preview readiness transitions can switch a source document from single-column to split layout inside the same tab
- regression checks that unresolved `LaTeX` / `Typst` build-target cases stay single-column instead of showing an empty or guessed preview
- regression checks that the first slice exposes no draggable split affordance
- regression checks that restored legacy preview tabs remain read-only compatibility surfaces and cannot reintroduce pane-first write behavior or become the state source for the new single-tab workspace path
- full `node --test tests/*.test.mjs`
- `npm run build`

## Out of Scope for First Slice

- draggable split handle
- per-file persisted split ratios
- removing all old preview-pane runtime code
- redesigning non-document viewers around the same workspace model
- broad shell-level pane persistence migration

## Implementation Summary

The first slice should create a true single-tab document workspace for `Markdown`, `LaTeX`, and `Typst`, reuse the current preview renderers inside that tab, and demote neighbor-pane preview opening from the default document path to compatibility-only behavior.
