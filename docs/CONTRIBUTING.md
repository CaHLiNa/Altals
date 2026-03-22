# Contributing

## Purpose

This document records the current expected contribution workflow for Altals.

It is intentionally aligned with the refactor rules in `AGENTS.md`.

## Before A Meaningful Refactor Slice

Read and follow:

- `AGENTS.md`
- `docs/REFACTOR_BLUEPRINT.md`

If you change code, update the relevant docs as part of the same slice.

## Refactor Expectations

Contributions should prefer:

- narrow, validated slices
- new runtime/domain boundaries over more logic in monoliths
- explicit behavior over hidden automation
- patch-first AI flows over direct mutation paths
- truthful docs over aspirational docs

Do not treat cosmetic renames or formatting-only edits as architectural progress.

## Current Repository Rules

When contributing to the active refactor:

- do not keep growing large central files when a seam should be extracted
- do not skip `docs/REFACTOR_BLUEPRINT.md`
- do not let docs fall behind code
- do not collapse autosave, local snapshot, Git commit, and remote sync back together
- do not route workspace snapshot restore back through `git checkout`
- do not introduce direct AI file mutation outside reviewable workflow/checkpoint paths

## Validation Expectations

At minimum, contributors should run the narrowest relevant validation plus the shared regression commands before claiming a slice is complete.

Current common commands:

```bash
node --test tests/*.test.mjs
npm run build
```

When a focused runtime/domain slice is changed, also run the relevant targeted suites first.

## Docs Expectations

If the architecture changes, update the relevant docs in `docs/`.

At minimum, keep these aligned with reality:

- `docs/REFACTOR_BLUEPRINT.md`
- `docs/OPERATIONS.md`
- `docs/DATA_MODEL.md`
- `docs/GIT_AND_SNAPSHOTS.md`
- `docs/AI_SYSTEM.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`

## Commit Scope

Prefer one coherent refactor slice per commit.

If old and new systems coexist temporarily, document:

- what is new
- what is legacy
- what has been rerouted
- what still depends on old paths
- what should be deleted next

## Current Review Standard

A change is not considered complete just because it compiles.

Expected completion means:

- the code path is rerouted or stabilized
- the blueprint is current
- relevant docs are current
- validation notes are concrete
