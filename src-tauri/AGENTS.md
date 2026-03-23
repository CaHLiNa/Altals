# Tauri Backend Agents

Scope: `src-tauri/`

The backend provides local-first system access. It must become clearer and thinner over time.

## Direction

Move toward:

- command handlers
- core logic
- services
- models
- errors

## Command Handler Rules

- validate inputs
- normalize paths and arguments
- call backend services/core helpers
- return structured results

## Avoid

- growing flat mega-modules further
- mixing parsing, process execution, data shaping, and command wiring in one file
- hidden Git or AI mutation paths that bypass frontend review semantics

When touching `latex.rs`, `fs_commands.rs`, `kernel.rs`, `pdf_translate.rs`, or `git.rs`, prefer extracting one coherent slice instead of adding more branches inline.
