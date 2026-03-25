# Editor Workbench UI Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the frontend UI baseline from settings and shell surfaces into the highest-traffic editor, sidebar, notebook, and PDF toolbar entry points.

**Architecture:** Reuse the existing shared UI primitives instead of introducing another button/input system, and move component-local AI launch calls behind named launcher seams in `src/services/ai`. Keep viewer runtime logic in place while swapping only the visible control chrome.

**Tech Stack:** Vue 3, scoped CSS, shared UI primitives, ESLint, Prettier, node:test

---

### Task 1: Add Named Workbench AI Launcher Seams

**Files:**

- Create: `/Users/math173sr/Documents/GitHub项目/Altals/src/services/ai/workbenchTaskLaunchers.js`
- Test: `/Users/math173sr/Documents/GitHub项目/Altals/tests/workbenchTaskLaunchers.test.mjs`

- [ ] Write focused tests for notebook assistant, reference maintenance, and compare launch request builders.
- [ ] Implement pure request builders that preserve pane targeting, source, and entryContext metadata.
- [ ] Add lazy `launchAiTask` wrappers so components can call named seams without importing the generic launcher directly.
- [ ] Run `node --test tests/workbenchTaskLaunchers.test.mjs`.

### Task 2: Normalize TabBar Controls

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/TabBar.vue`

- [ ] Replace raw icon buttons with `UiButton`.
- [ ] Collapse static `inline style` tab chrome into token-based classes.
- [ ] Keep drag/reorder behavior unchanged.
- [ ] Run `npx eslint /Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/TabBar.vue`.

### Task 3: Normalize Reference Sidebar Controls

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/sidebar/ReferenceList.vue`

- [ ] Replace header, search, filter, style, and compare controls with shared UI primitives.
- [ ] Move reference-maintenance and compare launches onto named launcher seams.
- [ ] Replace local color/border inline styles with scoped token classes where practical.
- [ ] Run `npx eslint /Users/math173sr/Documents/GitHub项目/Altals/src/components/sidebar/ReferenceList.vue`.

### Task 4: Normalize Notebook Toolbar and Setup Controls

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/NotebookEditor.vue`

- [ ] Replace toolbar buttons, status chip, kernel picker, setup actions, and add-cell actions with shared primitives.
- [ ] Move notebook AI launch onto the named launcher seam.
- [ ] Keep notebook runtime behavior unchanged.
- [ ] Run `npx eslint /Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/NotebookEditor.vue`.

### Task 5: Normalize PDF Toolbar and Context Controls

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/PdfViewer.vue`

- [ ] Replace high-frequency toolbar, search-toggle, tools-menu, annotation action, and context-menu buttons with `UiButton`.
- [ ] Leave PDF viewer runtime, page/search inputs, and render synchronization logic intact.
- [ ] Fix any newly surfaced lint issues in the file instead of suppressing them.
- [ ] Run `npx eslint /Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/PdfViewer.vue`.

### Task 6: Expand Tooling and Docs Baseline

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/package.json`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/docs/FRONTEND_SPEC.md`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/docs/REFACTOR_BLUEPRINT.md`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/tests/aiLaunchBoundaryAudit.test.mjs`

- [ ] Expand `lint`, `lint:fix`, `format`, and `format:check` to the newly normalized workbench files plus the launcher seam and its test.
- [ ] Update the AI launch boundary audit so it reflects the new named workbench launcher seam instead of presentation-layer direct launcher imports.
- [ ] Update the frontend spec so the documented baseline matches the newly normalized editor/sidebar files.
- [ ] Update the refactor blueprint with the completed slice, validation, and remaining gaps.

### Task 6A: Normalize Additional Workbench Chrome

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/DocumentWorkflowBar.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/layout/WorkbenchRail.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/layout/ToastContainer.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/layout/SyncPopover.vue`

- [ ] Replace remaining high-frequency workbench rail, workflow bar, toast, and sync popover buttons with `UiButton`.
- [ ] Remove the remaining local hardcoded button chrome and old toast z-index from this high-traffic cluster.
- [ ] Validate the cluster with targeted ESLint.

### Task 6B: Stabilize PDF Open And Sidebar Toggle Behavior

**Files:**

- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/App.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/PdfViewer.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/shared/shellResizeSignals.js`
- Create: `/Users/math173sr/Documents/GitHub项目/Altals/src/domains/editor/pdfViewerRuntime.js`
- Create: `/Users/math173sr/Documents/GitHub项目/Altals/tests/pdfViewerRuntime.test.mjs`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/tests/shellResizeSignals.test.mjs`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/shared/SidebarChrome.vue`

- [ ] Reuse the shared shell-resize path for sidebar open/close when a visible PDF pane is on screen.
- [ ] Make shell-resize tracking multi-source safe so drag resize and sidebar toggles cannot cancel each other out.
- [ ] Add a lightweight first-render handshake and one-shot recovery path for occasional blank embedded PDF loads.
- [ ] Align sidebar chrome height with the tab bar baseline so the separator lines land on the same y-position.

### Task 7: Full Validation

**Files:**

- Test only

- [ ] Run `npm run lint`.
- [ ] Run `npm run format:check`.
- [ ] Run `node --test tests/*.test.mjs`.
- [ ] Run `npm run build`.
