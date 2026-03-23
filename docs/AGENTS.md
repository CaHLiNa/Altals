# Docs Agents

Scope: `docs/`

Documentation is part of the system, not post-hoc commentary.

## File Roles

- `docs/REFACTOR_BLUEPRINT.md` is the live current-state refactor log
- `docs/plan/README.md` is the medium-term iteration roadmap
- the other top-level docs describe current product, architecture, domains, operations, AI, safety, and testing truth

## Rules

- document current reality, not aspirational architecture
- update docs in the same change when code or policy meaning changes
- keep terminology consistent with the current product definition
- move stale docs to `docs/LEGACY/` instead of leaving them active

Do not let the blueprint, plan, and current-system docs drift into contradictory stories.
