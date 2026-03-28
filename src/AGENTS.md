# Frontend Agents

Scope: everything under `src/`.

Read the root `AGENTS.md` and `docs/REFACTOR_BLUEPRINT.md` first.

## Mission

Frontend work must strengthen one document workspace loop:

- browse project files
- edit Markdown, LaTeX, and Typst documents
- preview or build those documents
- review outline, run state, and history safely

## Preferred Placement

- `src/app` for shell orchestration
- `src/domains/*` for workflow and runtime logic
- `src/services/*` for effectful integrations

Keep stores, components, and composables thinner over time.

## Hard Rules

- Do not add broad business logic to `App.vue` unless it is a short migration bridge.
- Do not add new non-document shell surfaces.
- Do not spread build, preview, or restore logic across multiple UI entry points without a named boundary.

## Expected Shape

- components render and emit intent
- composables hold reusable UI glue
- stores hold reactive state and thin wrappers
- domains own workflow decisions
- services own invoke, filesystem, and process adapters
