# Frontend Agents

Scope: everything under `src/`.

Read the root `AGENTS.md` and `docs/REFACTOR_BLUEPRINT.md` first.

## Mission

Frontend work must strengthen one integrated research loop:

- browse project files
- draft and edit documents
- work in notebooks
- run code and inspect results
- manage references
- build and preview outputs
- review changes and history
- launch auditable AI workflows

## Preferred Placement

Bias new code toward:

- `src/app` for shell-facing orchestration
- `src/domains/*` for workflow/runtime logic
- `src/services/*` for effectful integrations

Keep stores, components, and composables thinner over time.

## Hard Rules

- Do not add new business logic to `App.vue` unless it is a minimal migration bridge.
- Do not add new direct AI launch, Git sync, or Tauri side effects in presentation code when a shared seam can be introduced.
- Do not spread notebook/build/history logic across multiple UI surfaces without a named boundary.
- Do not treat terminal, notebook, references, and document flows as unrelated mini-products.

## Expected Shape

- components render and emit intent
- composables hold reusable UI glue
- stores hold reactive state and thin wrappers
- domains own workflow decisions
- services own provider/process/invoke adapters

If a change cuts across those lines, extract a clearer seam instead of layering on more glue.
