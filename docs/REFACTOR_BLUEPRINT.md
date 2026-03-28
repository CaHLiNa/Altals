# Refactor Blueprint

## Overview

This blueprint tracks the active cleanup path for the document-only Altals shell. The goal is to keep the repository truthful to the shipped product: one local workspace focused on Markdown, LaTeX, and Typst.

## Product Direction

- Keep the desktop shell centered on documents, previews, and build feedback.
- Prefer a smaller but cleaner workspace over restoring removed product areas.
- Preserve explicit safety boundaries around autosave, save points, and Git sync.

## Architectural Principles

- Thin top-level shell files over time.
- Put workflow decisions in `src/domains/*`.
- Keep `src/services/*` effectful but narrow.
- Keep stores reactive and coordination-light.
- Delete dead surfaces instead of keeping compatibility shells indefinitely.

## Current State Assessment

- The visible shell has already been reduced to files, editor/preview, outline, and document-run panels.
- PDF viewing is now document-only and no longer carries research or translation sub-products.
- Some migration guards still exist for old saved editor state and retired virtual tabs.
- Bundle size is still heavier than ideal around PDF and editor tooling.

## Phase Plan

1. Finish removing retired shell seams and stale product language.
2. Keep simplifying restore, persistence, and settings paths around the current document scope.
3. Reduce bundle and backend breadth without regressing the document workflow.

## Task Backlog

- continue trimming unused runtime helpers and compatibility code
- reduce bundle weight around PDF and editor dependencies
- keep docs and audit tests aligned with the actual product
- continue flattening broad backend modules

## In Progress

- no active feature expansion; current focus is truthful cleanup and stabilization

## Completed

- March 28, 2026: reduced the shell to a single document workspace for Markdown, LaTeX, and Typst.
- March 28, 2026: replaced the old PDF stack with a document-only pdf.js viewer that keeps search, outline, thumbnails, zoom, and source sync.
- March 28, 2026: removed retired AI, notebook, reference, terminal, and conversion modules plus their tests and package dependencies from the active app path.
- March 28, 2026: removed the remaining retired shell compatibility branches, rewrote active docs to the current product truth, and deleted stale historical planning/spec files from the repository.

## Blocked / Risks

- `pdf.js` and editor dependencies still produce large chunks at build time.
- Some backend areas are still broader than the cleaned frontend shell.
- Old local caches from pre-prune versions may still be encountered in user workspaces, so restore paths need to stay conservative.

## Next Recommended Slice

- focus on bundle-size reduction and backend module slimming without expanding product scope

## Validation Checklist

- `npm run format:check`
- `npm run lint`
- `node --test tests/*.test.mjs`
- `npm run build`

## Migration Notes

- removed shell surfaces should not be reintroduced through hidden localStorage or editor-state restore paths
- active docs now describe only the document workspace
- stale planning history was removed from the live repository; Git history remains the archive
