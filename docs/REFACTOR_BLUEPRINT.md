# Refactor Blueprint

## Overview

This blueprint tracks the current refactor truth for Altals as a local-first, project-directory-centered research and academic operating system. It records the smallest validated slices that improve product clarity, workflow stability, and architectural boundaries without pretending unfinished architecture has already landed.

## Product Direction

- Keep the product centered on the local research loop: open, browse, draft, compute, build, review, and optionally sync.
- Preserve explicit safety boundaries between autosave, snapshots, Git history, remote sync, and AI mutation.
- Prefer operational clarity over feature count, especially in document, notebook, PDF, and review flows.

## Architectural Principles

- `src/app` composes shell-facing orchestration.
- `src/domains/*` owns reusable workflow/runtime decisions.
- `src/services/*` wraps effectful integrations and adapters.
- Components and composables stay thinner over time.
- Refactor in small, validated slices instead of broad rewrites.

## Current State Assessment

- The frontend is the strongest landed surface and already exposes meaningful seams across app, domain, service, and store layers.
- The document-heavy loop is stable enough to refine, but performance hot spots remain around large preview surfaces such as PDF workflows.
- The repository now has a restored docs baseline again, but many of those docs are still intentionally concise and should grow only with real code truth.
- The backend remains flatter than the frontend and still needs boundary extraction over time.

## Phase Plan

1. Stabilize the core research workflow surfaces with small runtime and UI performance fixes.
2. Continue thinning shell and store logic by moving reusable decisions into domain runtimes.
3. Rebuild the missing docs baseline so repo policy audits reflect current truth instead of drift.

## Task Backlog

- Reduce residual PDF and preview-surface resize cost inside viewer boundaries.
- Continue splitting large frontend surfaces where orchestration and rendering are still mixed.
- Expand newly restored docs as code boundaries become clearer.
- Improve validation confidence around workspace, history, and preview operations.

## In Progress

- No active slice is currently in progress.

## Completed

- March 24, 2026: restored the missing refactor blueprint file so future slices can update a live execution log instead of referring to a missing path.
- March 24, 2026: reduced sidebar-toggle jank for visible PDF panes by disabling app-shell sidebar width transitions while a PDF pane is on screen, which avoids repeated PDF viewer relayout during left/right sidebar open-close animations.
- March 24, 2026: added a focused pane-tree runtime helper and tests that detect whether a visible PDF pane is present from the active tabs in the current pane tree.
- March 25, 2026: unified shell chrome so Header now only owns fixed left and right sidebar toggles while shared panel-switching chrome lives inside the left and right sidebars.
- March 25, 2026: extracted shared workbench chrome metadata plus shared `ShellChromeButton` and `SidebarChrome` components so Header and sidebars reuse one button primitive and one panel-entry source.
- March 25, 2026: removed old Header panel DOM measurement coupling from `useAppShellLayout`, simplified sidebar minimum-width rules, and removed shell width animations to avoid repeated relayout during sidebar open/close.
- March 25, 2026: restored the required docs baseline under `docs/` and added `docs/AGENTS.md`, which brings the repo policy docs audit back into line with the current repository contract.
- March 25, 2026: traced remaining sidebar drag jank to PDF viewer work during continuous shell resize, then added shared shell-resize signals so the PDF viewer can defer toolbar/UI sync and temporarily veil the iframe until drag end instead of redoing expensive work every frame.
- March 25, 2026: tightened sidebar width constraints so left and right sidebars now clamp to more deliberate minimum and maximum widths instead of allowing very narrow or overly wide drag states.
- March 25, 2026: established a first frontend UI baseline by adding semantic design tokens, a shared `ui.css` layer, and shared `UiButton` / `UiInput` / `UiModalShell` / `UiSwitch` primitives instead of continuing to grow page-local button, input, and dialog styles.
- March 25, 2026: moved the main shell chrome, key settings sections, and confirmation/history dialogs toward the new UI baseline, reducing several high-traffic `inline style` cases and replacing duplicated controls with shared primitives where the flow is stable enough.
- March 25, 2026: added `docs/FRONTEND_SPEC.md` plus spec/plan documents for this slice so the repository now has a concrete frontend baseline to reference instead of only ad hoc page-local conventions.
- March 25, 2026: removed the shared button hover translate effect after it conflicted with Header's absolute centering transform, and tightened sidebar chrome density so panel switch buttons behave like compact secondary controls instead of oversized primary actions.
- March 25, 2026: migrated the remaining settings-heavy legacy controls in `SettingsPdfTranslate`, `SettingsGitHub`, and `SettingsUpdates` onto shared `UiButton` / `UiInput` / `UiSwitch` primitives instead of leaving older local toggle and button patterns in the new settings baseline.
- March 25, 2026: added a first repository lint/format baseline with `eslint.config.js`, Prettier config, and npm scripts, but scoped lint coverage to the new frontend baseline surfaces so the repo gains enforceable standards without pretending the legacy codebase is already clean.
- March 25, 2026: finished the settings-form baseline by adding shared `UiSelect` and `UiTextarea`, migrating `SettingsEnvironment` plus the remaining `select`/`textarea` usage in `SettingsModels` and `SettingsPdfTranslate`, and deleting the unused legacy settings form-shell CSS that those pages no longer need.
- March 25, 2026: finished the settings-control baseline by extending `UiButton` for active/raw-content usage, then migrating settings navigation, choice cards, segmented toggles, disclosure rows, and dropdown items so `src/components/settings` no longer contains raw `button` elements either.
- March 25, 2026: fixed the immediate settings-baseline regressions by restoring normal switch sizing in `SettingsPdfTranslate`, moving the usage inline helper copy off the shared negative-margin `settings-hint` style, and restoring column layout for theme preview cards after the shared-button migration.
- March 25, 2026: restored the PDF translation settings surface to an intentional two-column layout by keeping dual columns but giving each toggle row a dedicated text column plus a fixed switch column so long labels wrap instead of collapsing the switch space.
- March 25, 2026: audited literal `t('...')` usage across `src/` and filled the missing `ZH_MESSAGES` entries, bringing the current missing-key scan for the Chinese language pack down to zero.
- March 25, 2026: extended the i18n audit to dynamic settings keys such as `labelKey`, `hintKey`, and `placeholderKey`, which caught the remaining untranslated PDF translation option copy and brought that scan to zero as well.
- March 25, 2026: replaced the fixed sidebar width ceilings/floors in `useAppShellLayout` with viewport-adaptive width rules and resize-time re-clamping, so smaller app windows no longer let left/right sidebars consume a disproportionate share of the shell.
- March 25, 2026: extended the frontend baseline into `TabBar`, `ReferenceList`, `NotebookEditor`, and the top-level `PdfViewer` chrome by replacing many raw toolbar/menu controls with shared UI primitives and token-based classes instead of continuing local button/input skins.
- March 25, 2026: extracted `src/services/ai/workbenchTaskLaunchers.js` so editor/sidebar components can launch notebook and reference AI flows through named seams instead of importing `launchAiTask(...)` directly from presentation code.
- March 25, 2026: expanded the scoped lint/format baseline from `settings/shared` into the highest-traffic editor/sidebar entry points, while still keeping the broader legacy repository out of mandatory lint coverage for now.
- March 25, 2026: updated the AI launch boundary audit to match the new workbench launcher seam truth, so the repository now explicitly asserts that `NotebookEditor` and `ReferenceList` launch notebook/reference AI flows through named service seams instead of direct `launchAiTask(...)` calls.
- March 25, 2026: extended the shared UI baseline one step further into `DocumentWorkflowBar`, `WorkbenchRail`, `SyncPopover`, and `ToastContainer`, replacing more high-frequency raw buttons with `UiButton` and removing another hardcoded toast-layer z-index.
- March 25, 2026: upgraded `shellResizeSignals` from a single boolean into a multi-source shared resize state, then reused that same path for PDF-sensitive sidebar open/close pulses so drag resize and sidebar toggles no longer fight over the embedded viewer's throttling path.
- March 25, 2026: added a first-render readiness handshake plus one-shot self-recovery path in `PdfViewer`, which waits for the embedded viewer app to settle, nudges resize/render once, and retries a stalled open before surfacing a blank PDF pane to the user.
- March 25, 2026: tightened sidebar chrome geometry so the left and right sidebar separator lines now align with the tab bar baseline instead of sitting on a taller chrome row.
- March 25, 2026: compressed sidebar chrome further with a new compact `icon-xs` button size, smaller sidebar icons, and a shorter strip height so the sidebar top rule reads closer to the editor tab-bar baseline instead of feeling visually lower.
- March 25, 2026: compressed sidebar chrome one more step by moving the strip down to 26px with a 20px icon-button footprint, because the previous 28px row still read visually lower than the editor tab baseline in dense workspace layouts.
- March 25, 2026: compressed the AI workbench sidebar header to the same 26px shell row height, reducing its legacy padded top bar so AI recent-chat chrome no longer sits visibly taller than the compact sidebars.
- March 25, 2026: hardened `PdfViewer` open recovery by requiring a non-zero `pagesCount` before treating the embedded viewer as render-ready, delaying `pdfUi.ready` until the document actually opens, and recreating the iframe on stalled first-render retries instead of reusing a half-initialized pdf.js shell.
- March 25, 2026: added `PdfViewer` activation recovery for cached workspace surfaces, so returning from the library or AI workbench now health-checks the cached pdf.js iframe and rebuilds it when the restored viewer comes back with `pagesCount = 0` or a blank first page.
- March 25, 2026: tightened `TabBar` overflow handling so the tab strip no longer picks up an unwanted vertical scrollbar while still preserving the intended horizontal tab scrollbar for crowded editor panes.
- March 25, 2026: fixed the async `VersionHistory` first-open path by moving its visibility/file reload decision into a small view runtime and making the modal load immediately on first visible mount, so file version history no longer opens to a false empty state after the app lazy-loads that component.
- March 25, 2026: hardened `.github/workflows/release.yml` so release dispatches now distinguish between a safe rerun of an existing tag on the same commit and an invalid attempt to reuse the same version tag on a newer commit, with explicit version-bump guidance instead of a generic tag-exists failure.

## Blocked / Risks

- Residual PDF lag, if any remains, is now more likely to come from viewer-internal resize/event churn than shell chrome movement.
- The new drag-time PDF veil is a deliberate tradeoff: smoother shell resize over live PDF redraw during drag.
- The newly restored docs baseline is intentionally high level; it should only gain detail when backed by current code truth.
- Backend boundary work still lags behind the frontend direction.
- The frontend baseline is still partial: deeper editor-heavy surfaces, Notebook cell internals, and PDF viewer-local form controls still use older styling and interaction patterns.
- Reference detail/edit surfaces, notebook cell-local toolbars, and file-tree/dialog history surfaces still contain many raw form controls and legacy button skins.
- The embedded PDF viewer is more resilient now, but it still depends on pdf.js iframe behavior; deeper viewer-internal render cost and occasional upstream viewer edge cases remain a risk area.
- The embedded PDF viewer no longer accepts a `pagesCount = 0` shell as "ready", but upstream pdf.js iframe timing can still produce new edge cases that may need deeper event-level instrumentation if blank states continue.
- Cached workspace surfaces now actively revalidate embedded PDF iframes on re-entry, but pdf.js lifecycle timing inside `KeepAlive` remains a risk area if future viewer updates change what "initialized but blank" looks like.
- Lint/format enforcement now reaches the main settings/shared surfaces plus the highest-traffic editor/sidebar entry points, but the scope is still intentionally narrower than the full repository.
- Release automation is still intentionally version-driven: rerunning the workflow on a newer `main` commit without bumping the checked-in version will now fail with clearer guidance, but it still requires an explicit version-bump commit before a new release can be tagged.

## Next Recommended Slice

- Continue migrating deeper PDF viewer controls, notebook cell-local UI, and additional editor/sidebar surfaces onto the shared UI baseline.
- If PDF lag is still noticeable after this slice, profile viewer-internal event churn next, especially repeated `syncPdfUi()` triggers around scale/search/sidebar events and any expensive annotation overlay work.
- Prioritize `ReferenceView`, `NotebookCell`, `FileTree`, and reference import/add dialogs next, because they still carry the densest cluster of raw buttons/inputs in high-traffic research workflows.
- Expand lint coverage outward from the current settings/shared/editor entry-point baseline once the next batch of legacy frontend rule violations is worth fixing instead of ignoring.

## Validation Checklist

- Add or update focused tests for any extracted runtime/helper logic.
- Run targeted tests for the changed slice.
- Run `node --test tests/*.test.mjs`.
- Run `npm run build`.
- Record any pre-existing validation failures explicitly.

Validation status for the current slice:

- Added and updated focused tests for shell chrome metadata, header geometry, and app-shell width rules.
- Added focused tests for shared shell-resize signals used by layout resize handles and PDF drag-time throttling.
- Updated layout tests to cover the tighter left/right sidebar minimum and maximum width clamps.
- Added a first frontend UI baseline in code and documentation, then verified the slice with a full test suite and build instead of docs-only churn.
- Migrated the remaining settings sections onto the shared UI primitives and added scoped lint/format tooling so the new baseline has enforceable guardrails.
- Added shared `UiSelect` and `UiTextarea` primitives, then verified that the settings directory no longer contains raw `input`, `select`, or `textarea` controls.
- Extended `UiButton` with active/raw-content support and verified that the settings directory no longer contains raw `button`, `input`, `select`, or `textarea` controls.
- Re-scanned literal `t('...')` usage plus common dynamic i18n key fields across `src/` and verified the current Chinese language pack has zero missing keys for those calls.
- Updated app-shell layout tests to cover viewport-adaptive sidebar minimum/maximum widths instead of only fixed pixel clamps.
- Added a focused launcher-seam test for notebook and reference workbench task launches so component-facing AI entry points can be validated without importing the full live launch runtime.
- Updated the AI launch boundary audit so the full suite now checks the new named workbench launcher seam instead of the older presentation-layer direct launcher pattern.
- Verified the newly normalized editor/sidebar files with targeted ESLint before expanding the repository lint scope to include them.
- Verified the additional workbench chrome files (`DocumentWorkflowBar`, `WorkbenchRail`, `SyncPopover`, `ToastContainer`) with targeted ESLint before folding them into the scoped lint baseline.
- Added focused tests for PDF render-readiness helpers and multi-source shell resize behavior before reusing that resize path for sidebar open/close with visible PDFs.
- Tightened the PDF render-ready helper to require non-zero document pages before passing first-render checks, and verified the helper with its focused test file before rewiring the viewer retry path.
- Added a focused runtime helper test for cached PDF activation recovery so the viewer can distinguish a healthy cached iframe from a `pagesCount = 0` restored shell before deciding whether to rebuild.
- Added a focused file-version-history view-runtime test so the lazily loaded `VersionHistory` modal now explicitly covers its first-visible mount, reopen, file-switch, and hidden reset decisions instead of relying on an untested component watcher edge case.
- Corrected `TabBar` overflow handling to keep horizontal tab scrolling visible while explicitly suppressing vertical overflow, which removes the stray vertical scrollbar without deleting the intended left-right tab scrollbar.
- Tightened shell chrome geometry again by switching the editor tab strip to `border-box` sizing and matching sidebar chrome separators to the same border token, removing the 1px drift between sidebar top-strip rules and the tab-bar baseline.
- Embedded workspace sidebar views now suppress their own top divider when mounted under `SidebarChrome`, so the shell shows one aligned top separator instead of stacking a second line below the left sidebar toolbar.
- The left sidebar now renders file/reference utility actions inside the shared `SidebarChrome` trailing area and removes the old embedded `FileTree` / `ReferenceList` header row entirely, so workspace sidebars no longer consume a second top strip under the panel-switch chrome.
- The right sidebar `Backlinks` panel now also honors embedded shell mode and drops its legacy title row when mounted under `SidebarChrome`, so the visible top separator can align with the editor tab bar instead of sitting one row lower.
- Sidebar chrome now uses a denser 24px button footprint and reduced strip height, intentionally tightening the sidebars' secondary controls so their visual weight matches the compact editor tab row more closely.
- The AI workbench sidebar still has its own single-purpose header instead of shared `SidebarChrome`, but its row height and border geometry now match the compact shell baseline so the AI surface no longer stands out as a taller exception.
- `npm run lint` passes for the scoped frontend baseline surfaces.
- `npm run format:check` passes for the scoped frontend baseline files and docs.
- `node --test tests/workbenchChromeEntries.test.mjs tests/headerChromeGeometry.test.mjs tests/appShellLayout.test.mjs` passes.
- `node --test tests/shellResizeSignals.test.mjs tests/appShellLayout.test.mjs tests/headerChromeGeometry.test.mjs tests/workbenchChromeEntries.test.mjs` passes.
- `node --test tests/*.test.mjs` passes.
- `npm run build` passes.
- Release-workflow tag handling was updated and validated with local git-state checks against the current `v1.0.1` tag/HEAD mismatch scenario plus a YAML syntax parse.

## Migration Notes

- This blueprint currently reflects the repository as it exists now, not the intended end-state architecture.
- The restored docs baseline should stay concise and truthful until deeper architectural seams land in code.
