# Altals Agent Constitution

This file is the repository constitution for Codex and any other coding agent working in Altals.

Read it before doing meaningful work. Follow it together with the nearest directory-scoped `AGENTS.md` for the files you touch.

Altals is in an active refactor. Preserve stable value, not accidental architecture.

## 0. Prime Directive

Altals is not just a writing app.

Altals is being shaped into:

> A local-first, project-directory-centered research and academic operating system.

The product center must be the integrated local research loop:

1. open a local research project
2. browse files, notes, and references
3. draft in Markdown and notebooks
4. author papers in LaTeX and Typst
5. run code through notebook and terminal-backed execution flows
6. build and preview outputs
7. review changes, history, and restore points
8. optionally sync with Git
9. use AI through auditable proposal/patch workflows

Everything else is secondary.

If a system, panel, automation, or abstraction does not strengthen that loop, reduce it, isolate it, defer it, or remove it.

Do not optimize for feature count.
Optimize for product clarity, safe operations, explicit behavior, and maintainable boundaries.

## 1. Product Scope

Treat these as first-class product objects:

- Project
- Document
- Notebook
- Computation
- Reference
- Build
- Change
- Workflow

Treat these as supporting systems:

- Git sync
- remote linking/auth
- generic chat surfaces
- experimental panels
- migration shims
- packaging and release automation

If there is tension between the core research loop and a support system, the research loop wins.

## 2. Current Reality Bias

Work from the repository as it exists now, not from an imagined finished product.

Current truth:

- the strongest landed loop is still document-heavy: file browsing, editing, references, build/preview, history, and patch-first AI
- notebook/kernel/terminal-backed computation exists, but its boundaries are still uneven
- the frontend has meaningful runtime/domain seams
- the Rust/Tauri backend is still comparatively flat

Do not write docs or code as if unfinished architecture has already landed.

## 3. Non-Negotiable Rules

### 3.1 Read the blueprint

Before every meaningful refactor slice, read:

- `AGENTS.md`
- the nearest directory-scoped `AGENTS.md`
- `docs/REFACTOR_BLUEPRINT.md`

If the blueprint is stale, update it before and after the slice.

### 3.2 Keep docs truthful

Docs are part of the product and the refactor.

If product definition, architecture, operations, AI boundaries, or validation expectations change, update the relevant docs in the same change.

### 3.3 No worktree-by-default workflow

Do not create git worktrees or split work into worktree-based branches unless the user explicitly asks for that workflow.

### 3.4 No monolith growth

Do not keep adding logic to known monoliths when the right move is extraction.

Especially avoid deepening:

- giant stores
- giant editor components
- giant composables acting as hidden workflow engines
- giant Rust modules under `src-tauri/src`
- broad cross-domain service files

Preferred move:

1. create a target module
2. move one coherent responsibility
3. reroute callers
4. validate behavior
5. document the new and legacy boundaries

### 3.5 No fake refactor progress

Do not satisfy broad refactor requests with docs-only churn, file renames, or cosmetic wrapper extraction unless the repository is truly blocked or the user explicitly requested documentation work.

### 3.6 No hidden automation

Do not strengthen or introduce hidden behavior that reduces user understanding.

Especially forbidden as defaults:

- Git as silent persistence
- aggressive background commits
- invisible AI file mutation
- silent remote sync that behaves like data safety
- implicit cross-domain side effects

### 3.7 No unvalidated broad change sets

Prefer small, coherent, validated slices.

If validation is incomplete, say exactly what was not run and why.

## 4. Required Working Loop

For any meaningful task:

1. inspect repository state
2. read `AGENTS.md`, the nearest scoped `AGENTS.md`, and `docs/REFACTOR_BLUEPRINT.md`
3. update the blueprint if it is stale
4. choose the next smallest high-value slice
5. implement it
6. validate it
7. update the blueprint and relevant docs again
8. summarize what changed, what was validated, what remains, and the next recommended slice

When the user says `continue`, `keep going`, `proceed`, or equivalent, keep executing this loop until one of these is true:

- there is a real blocker needing human judgment
- validation fails and needs user input
- the requested phase is complete

Do not stop after planning alone unless blocked.

## 5. Mandatory Documentation Roles

The docs set has distinct roles:

- `docs/REFACTOR_BLUEPRINT.md`
  Current-state execution log and live refactor truth
- `docs/plan/README.md`
  Medium-term iteration roadmap and sequencing
- `docs/PRODUCT.md`
  Current product definition
- `docs/ARCHITECTURE.md`
  Current architecture truth
- `docs/DOMAINS.md`
  Current domain map and missing boundaries
- `docs/OPERATIONS.md`
  Current operation seams and gaps
- `docs/AI_SYSTEM.md`
  Current AI workflow truth
- `docs/GIT_AND_SNAPSHOTS.md`
  Safety and history model
- `docs/TESTING.md`
  Validation expectations

Do not collapse the blueprint and the plan into one file.
The blueprint tracks current truth; the plan tracks the next larger arcs.

## 6. Refactor Priority Order

Unless the user explicitly says otherwise, prefer work in this order:

### Priority 1 — product clarity

- describe Altals consistently as a local-first research and academic operating system
- remove stale framing that narrows the product to only a paper editor
- keep current docs aligned with actual capability and current limitations

### Priority 2 — core research workflow

- stabilize open / browse / edit / run / build / review
- keep Markdown, LaTeX, Typst, notebook, references, and change review working together
- make notebook/computation flows explicit instead of scattered

### Priority 3 — architectural boundaries

- thin root app hooks
- move orchestration into domain runtimes
- split giant stores, components, composables, and Rust modules
- reduce cross-domain leakage

### Priority 4 — safety model

- keep autosave, local snapshot, git commit, and remote sync separate
- keep recovery explicit
- keep notebook output, workspace restore, and Git history semantics understandable

### Priority 5 — AI workflow discipline

- keep AI scoped, auditable, and patch-first
- unify distributed AI entry points behind clearer operations
- never create direct mutation backdoors

### Priority 6 — cleanup, testing, and release hardening

- remove stale paths and docs
- strengthen tests
- improve build confidence
- harden packaging only after core boundaries improve

## 7. Frontend Direction

The frontend should continue moving toward:

- `src/app`
- `src/domains/*`
- `src/services/*`
- `src/shared` or shared utility modules

Biases:

- app layer composes top-level shell flows
- domains own workflow/runtime logic
- services wrap effectful integrations
- stores become narrower reactive shells
- components and composables focus on UI and thin bridging

Missing long-term boundary work is still real, especially around:

- execution/notebook/kernel flows
- broader AI workflow routing

Do not keep spreading that logic across components, stores, and services indefinitely.

## 8. Rust / Tauri Direction

The backend should move toward:

- `commands`
- `core`
- `services`
- `models`
- `errors`

Command handlers should:

1. validate and normalize inputs
2. call backend services/core logic
3. return structured results

Do not keep growing flat modules such as:

- `src-tauri/src/latex.rs`
- `src-tauri/src/fs_commands.rs`
- `src-tauri/src/kernel.rs`
- `src-tauri/src/pdf_translate.rs`
- `src-tauri/src/git.rs`

## 9. Operation Model Requirement

New behavior should move the codebase toward a shared operation model.

Target operations include:

- `OpenProject`
- `ListProjectFiles`
- `ReadDocument`
- `SaveDocument`
- `RunNotebookCell`
- `RunCodeSelection`
- `BuildDocument`
- `BuildProject`
- `SearchReferences`
- `InsertCitation`
- `CreateSnapshot`
- `RestoreSnapshot`
- `ListChanges`
- `CommitChanges`
- `PushRemote`
- `PullRemote`
- `RunAiWorkflow`

Do not create AI-only, component-only, or hidden mutation paths that bypass the normal operation boundary.

## 10. Safety Model

These concepts must stay separate:

1. autosave
2. local snapshot / save point
3. Git commit
4. remote sync

Notebook execution state must also stay explicit:

- cell output is not the same thing as saved document state
- workspace restore is not the same thing as replaying kernel state
- Git sync is not the same thing as local recovery

Never collapse these concerns for convenience.

## 11. AI Constitution

AI in Altals must remain conservative, scoped, auditable, and reviewable.

Allowed default pattern:

1. gather scoped context
2. generate a proposal or patch
3. show the proposed change
4. require approval when mutation is involved
5. apply through the normal operation path
6. associate recovery/snapshot metadata when appropriate

Forbidden defaults:

- direct invisible file rewrites
- direct commits or remote pushes
- broad autonomous rewrites
- bypassing review checkpoints

## 12. Documentation Constitution

Documentation must describe the current system, not the imagined end state.

When architecture or product definition changes, update the relevant docs in the same slice.

Move stale or misleading docs to `docs/LEGACY/` rather than leaving them in the active path.

## 13. Validation Requirement

Meaningful work should improve at least one of:

- testability
- module clarity
- type or data-shape confidence
- operation explicitness
- product clarity

Normal close-out for code changes:

1. run targeted tests
2. run `node --test tests/*.test.mjs`
3. run `npm run build`
4. update blueprint and relevant docs

For docs-and-policy slices, at minimum run the relevant audit tests that guard docs and repo policy.

## 14. Subagent Policy

Do not use subagents by default in this repository.

One main agent should keep the architectural picture coherent.
Only parallelize if the user explicitly asks for it and the workstreams are genuinely independent.

## 15. Definition Of Failure

A refactor turn is poor if it:

- narrows the product back down to a generic paper editor when code reality is broader
- keeps growing monoliths instead of extracting seams
- leaves the blueprint stale
- adds hidden automation
- turns Git into autosave
- lets AI mutate outside reviewable paths
- leaves dual systems undocumented
- makes broad changes without validation notes

## 16. Definition Of Success

A refactor turn is successful when Altals becomes easier to explain as:

- a local-first research project workspace
- a clearer open / draft / compute / build / review loop
- a codebase with thinner app roots, thinner stores, clearer domains, and safer operations
- an AI-assisted system that is more auditable, not more magical

When unsure whether to optimize for speed or repository quality, optimize for repository quality.
