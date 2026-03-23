# Contributing

## Purpose

This document records the expected contribution workflow for Altals.

It is intentionally aligned with the repository `AGENTS.md` hierarchy.

## Before Meaningful Work

Read and follow:

- the root `AGENTS.md`
- the nearest directory-scoped `AGENTS.md` for the files you will touch
- `docs/REFACTOR_BLUEPRINT.md`

When choosing the next medium-term arc or sequencing a larger tranche of work, also read:

- `docs/plan/README.md`

## Refactor Expectations

Contributions should prefer:

- narrow, validated slices
- explicit product and operation boundaries
- new runtime/domain seams over more logic in monoliths
- patch-first AI flows over direct mutation paths
- truthful docs over aspirational docs

Do not treat cosmetic renames or formatting-only edits as architectural progress.

## Current Repository Rules

When contributing to the active refactor:

- do not keep growing large central files when a seam should be extracted
- do not skip the blueprint
- do not let docs fall behind code
- do not collapse autosave, local snapshot, Git commit, and remote sync back together
- do not turn notebook runtime state into hidden persisted project state
- do not introduce direct AI file mutation outside reviewable workflow/checkpoint paths
- do not create git worktrees unless the user explicitly asks for that workflow

## Validation Expectations

At minimum, contributors should run the narrowest relevant validation plus the shared regression commands before claiming a slice is complete.

Current common commands:

```bash
node --test tests/*.test.mjs
npm run build
```

When a focused runtime/domain slice is changed, run the relevant targeted suites first.
When a docs/policy slice changes required docs or required `AGENTS.md` files, run the repo audit tests as well.

## Docs Expectations

If product definition, architecture, domain boundaries, operations, AI workflow semantics, or testing expectations change, update the corresponding docs in `docs/` as part of the same slice.

Keep these aligned with reality:

- `docs/REFACTOR_BLUEPRINT.md`
- `docs/plan/README.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAINS.md`
- `docs/OPERATIONS.md`
- `docs/AI_SYSTEM.md`
- `docs/GIT_AND_SNAPSHOTS.md`
- `docs/TESTING.md`

## Review Standard

A change is not complete just because it compiles.

Expected completion means:

- the code path is rerouted or clarified
- the blueprint is current
- relevant docs are current
- validation notes are concrete
