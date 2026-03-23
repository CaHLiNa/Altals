# Testing

## Purpose

This document records the current validation strategy for Altals.

It describes the test and build story as it exists today.

## Current Validation Stack

The repository currently relies on three main validation layers:

- focused Node runtime tests for the slice being changed
- full Node test sweeps through `tests/*.test.mjs`
- Vite production builds through `npm run build`

There is no single broad lint or typecheck gate in `package.json` today.

## Standard Commands

### Focused Runtime Validation

Run the narrowest relevant suites first.

Examples:

```bash
node --test tests/documentWorkflowAiRuntime.test.mjs
node --test tests/workspaceSnapshotRuntime.test.mjs tests/workspaceSnapshot.test.mjs
node --test tests/referenceCrudRuntime.test.mjs tests/referenceLibraryRuntime.test.mjs
```

### Full Frontend Regression Sweep

```bash
node --test tests/*.test.mjs
```

### Build Verification

```bash
npm run build
```

## Current Suite Coverage

The current Node test suite covers many runtime/domain seams, including:

- AI workflow launch/planner/run state
- document workflow preview/build/action/AI seams
- editor open routing
- files tree/content/mutation runtimes
- references library/load/migration/mutation/CRUD/assets
- chat runtimes
- terminal runtimes
- workspace bootstrap/settings/github/automation
- workspace history/snapshot/save-point runtimes
- notebook-adjacent helpers and document serialization
- small repo policy tests such as markdown snippets and selection/context-menu rules

## Repo Policy Audits

The repository also keeps lightweight audit tests for repository policy and documentation integrity.

These can guard:

- required top-level docs
- required `AGENTS.md` files
- the mandatory blueprint section headings
- other small repository-wide policy contracts

These are not product tests. They exist so the refactor does not silently drift into undocumented or contradictory states.

## Current Known Gaps

The biggest remaining validation gaps are:

- no dedicated lint script
- no dedicated typecheck script
- no broad browser E2E coverage
- no routine Rust test workflow documented for frontend refactor slices
- limited audit coverage for medium-term planning and execution/notebook boundaries

## Expected Build Warnings

Today `npm run build` may still report:

- Vite dynamic-import overlap warnings
- Vite chunk-size warnings

These warnings are not automatically treated as failures, but new warnings or larger regressions should not be ignored.

## Practical Rule

For a meaningful code slice, the safest normal close-out is:

1. run targeted tests
2. run `node --test tests/*.test.mjs`
3. run `npm run build`
4. update the blueprint and related docs

For a docs-and-policy slice, at minimum:

1. run the relevant repo audit tests
2. update the blueprint and related docs
