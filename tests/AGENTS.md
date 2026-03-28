# Test Agents

Scope: `tests/`

Tests are part of the refactor boundary work.

## Expectations

- add focused tests for new runtime and domain seams
- prefer contract tests over implementation-detail coupling
- keep safety-critical behavior covered: history, snapshots, document build flow, restore behavior, and sync boundaries

## Repo Policy Audits

Lightweight audit tests may guard:

- required docs
- required `AGENTS.md` files
- documented architectural boundaries

If you change repo policy or required docs, update the audit tests in the same slice.
