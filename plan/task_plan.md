# Task Plan: AI Workflow Implementation

## Goal
Deliver a usable grounded AI workflow for Altals: provider settings, skill execution, session UI, and artifact application inside the desktop workbench.

## Phases
- [x] Phase 1: Inspect current workbench, sidebar, editor-selection, and references architecture
- [x] Phase 2: Write the implementation plan document
- [x] Phase 3: Implement AI workflow foundation across domains, services, stores, and UI
- [x] Phase 4: Run targeted verification
- [x] Phase 5: Review outputs and summarize next execution slice

## Key Questions
1. What is the smallest useful AI workflow slice that fits the current desktop shell?
2. Which context sources already exist and can be reused immediately?
3. Where should AI workflow policy live so it does not become a detached chat subsystem?
4. Which UI surface can host AI workflow entry without disrupting current writing and references flows?

## Decisions Made
- The first slice will use the right inspector area as the AI workflow entry instead of introducing a new full-screen chat surface.
- The implementation ships a grounded AI panel, skill registry, context bundle builder, session UI, and prepared-brief generator.
- The first slice will use active document, editor selection, and selected reference as the initial context sources.
- AI execution uses an OpenAI-compatible settings flow with local key storage and real model calls.
- Artifact application is included for document patching and note-draft generation.

## Errors Encountered
- `npm run build` reports existing Vite chunking warnings around mixed static and dynamic imports, but the build completes successfully.

## Status
**Completed** - AI workflow is implemented with provider settings, grounded chat/skill execution, and artifact application. The next slice is deeper reader/PDF grounding and richer artifact types.
