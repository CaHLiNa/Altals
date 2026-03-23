# Iteration Plan

## Purpose

This document is the medium-term roadmap for Altals.

Use it to sequence multi-slice evolution.
Do not use it as a substitute for `docs/REFACTOR_BLUEPRINT.md`, which records current repository truth and current execution status.

## North Star

Altals should mature into a local-first, project-directory-centered research and academic operating system.

That means one coherent workspace for:

- Markdown drafting
- LaTeX and Typst paper authoring
- notebook-backed algorithm and experiment drafting
- Python / R / Julia execution through local kernels and terminal flows
- reference management and citation workflows
- build, preview, diagnostics, and review
- local save points, file history, and optional Git sync
- auditable AI assistance that proposes, explains, and patches through reviewable flows

## Current Reality

As of 2026-03-23:

- the document/reference/build/history loop is the strongest landed path
- notebook/kernel/terminal-backed computation exists, but is still fragmented across components, stores, services, and Rust modules
- the frontend has meaningful domain/runtime seams
- the backend is still flatter than the intended architecture
- AI already has workflow/checkpoint semantics, but launch entry points are still distributed
- product language in some older docs has been narrower than the actual research-compute scope

## Planned Roadmap

### Phase A — Product And Language Alignment

Goals:

- keep all active docs and agent instructions aligned with the research-operating-system definition
- remove wording that narrows Altals to only a paper-writing workspace
- make current maturity and current gaps explicit

Exit signals:

- product, architecture, domain, testing, and plan docs tell the same story
- directory-scoped `AGENTS.md` files exist for the main work surfaces

### Phase B — Execution / Notebook Boundary

Goals:

- define the first explicit execution/notebook domain boundary
- reduce notebook/kernel orchestration in components and stores
- unify notebook cell execution, chunk execution, and environment/kernel selection semantics

Likely slice candidates:

- extract kernel discovery/selection runtime
- extract notebook run orchestration boundary
- separate execution intent from notebook surface presentation

Exit signals:

- notebook and chunk execution no longer rely on scattered UI-owned workflow logic
- the execution stack is easier to explain than “component + store + service + Rust all at once”

### Phase C — Document And Build Consolidation

Goals:

- keep strengthening the document workflow seam
- unify Markdown / LaTeX / Typst action wording and status semantics
- reduce remaining compile/build glue in UI-heavy files

Likely slice candidates:

- thin remaining document workflow wrappers
- reduce oversized editor/build-adjacent components
- clarify build artifact and diagnostic affordances

### Phase D — Reference And Knowledge Workflow

Goals:

- keep references first-class in the research loop
- improve consistency between document citation actions, library views, and reference-oriented AI flows
- reduce distributed reference-specific UI logic

Likely slice candidates:

- tighten citation insertion and reference lookup seams
- shrink large library/editor reference surfaces

### Phase E — Change Safety And Git Sync

Goals:

- further simplify how users understand autosave, save points, file history, and remote sync
- keep workspace restore explicit and scoped
- keep Git sync supportive rather than dominant

Likely slice candidates:

- improve save-point wording and entry points
- tighten remote-link and sync affordances
- keep restore capabilities transparent instead of “smart”

### Phase F — AI Operation Model

Goals:

- create clearer shared AI operation seams
- reduce direct launch entry points in components
- keep AI context narrow, auditable, and patch-first

Likely slice candidates:

- introduce a broader app/domain AI launch boundary
- reroute notebook/reference/sidebar launch sites through that seam
- keep approval checkpoints explicit

### Phase G — Rust Backend Layering

Goals:

- begin the first real backend layering slice
- stop growing flat Rust command modules
- separate parsing/planning/process execution/error mapping

Likely slice candidates:

- audit and split `latex.rs`
- audit and split `fs_commands.rs`
- extract shared structs/errors from `kernel.rs` or `pdf_translate.rs`

### Phase H — Validation And Release Hardening

Goals:

- strengthen repo policy audits
- add better Rust-facing validation guidance
- eventually add lint/typecheck/E2E coverage where it provides real leverage

Likely slice candidates:

- expand lightweight repo audit tests
- add documented Rust validation commands
- add missing build/test scripts only when they reduce ambiguity

## Next Recommended Slices

1. Audit the notebook/kernel/terminal flow and define the first explicit `execution` boundary before adding more computation features.
2. Extract one narrow notebook or kernel orchestration runtime so execution logic stops living primarily in UI/store code.
3. Reroute one distributed AI launch surface through a shared app/domain seam after the execution boundary starts to exist.
4. Start the first Rust layering slice only after the execution-boundary direction is documented and stable enough to guide backend shape.

## Guardrails

- prefer narrow validated slices over broad rewrites
- do not reopen finished doc work as churn unless reality changed
- do not create worktrees unless the user explicitly asks
- keep blueprint, plan, and scoped `AGENTS.md` files aligned
- do not expand Git sync, notebook execution, or AI mutation in hidden ways

## Deferred / Not Now

Do not prioritize these ahead of the roadmap above unless the user explicitly asks:

- generic cloud collaboration features
- autonomous AI repo rewrites
- Git-commit-as-autosave behavior
- broad feature expansion that bypasses domain and safety work
