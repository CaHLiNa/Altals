# AI Codex Desktop Replication

Date: 2026-04-19  
Status: active consolidated record  
Related master plan: `plan/2026-04-18-codex-desktop-replication-master-plan.md`

This document merges the former Phase 1 through Phase 4 Codex-replication docs into one place so the repository keeps one AI desktop parity reference instead of four overlapping phase files.

---

## Overall intent

Turn the current Altals AI surface into a Codex Desktop-like agent workspace while keeping it grounded in the existing desktop workbench.

The stable split is:

- Rust owns runtime behavior, session semantics, approvals, interrupts, tool orchestration, and persistence
- frontend owns rendering, user intent emission, panel-local interaction, and low-level UI glue

---

## Phase status snapshot

- Phase 1: complete
- Phase 2: complete
- Phase 3: complete
- Phase 4: active

---

## Phase 1: Runtime Boundary

### Final rule

AI runtime authority is Rust-owned.

Frontend may keep:

- rendering
- user intent emission
- panel-local derived view state
- small input/composer helpers
- provider and model selection UI

Frontend should not own:

- turn orchestration
- session schema ownership
- runtime event routing
- stop or interrupt resolution
- approval, ask-user, or exit-plan protocol semantics
- runtime thread synchronization
- message shaping based on runtime semantics

### What Phase 1 achieved

The current AI main path is Rust-first:

- prepare runs in Rust
- send runs in Rust
- runtime thread bootstrap happens in Rust
- stop and interrupt resolution happen in Rust
- runtime event routing and reduction happen in Rust
- session normalization happens in Rust
- local session mutation semantics happen in Rust

### Canonical ownership

Rust-owned seams include:

- provider config loading and saving
- provider credential lookup
- provider readiness resolution
- model listing
- tool catalog resolution
- skill catalog loading
- prompt construction
- turn prepare
- turn run
- runtime thread creation and waiting
- session start / complete / fail / finalize / interrupt
- runtime event routing and reduction
- runtime-thread-to-session synchronization
- session normalization
- session local mutation semantics
- session overlay persistence
- attachment record creation
- approval / ask-user / exit-plan / plan-mode / background-task runtime protocol

Frontend-owned and acceptable:

- AI panel rendering
- session rail rendering
- composer input binding
- file attachment picker wiring
- provider settings UI
- unified model pool UI aggregation
- toasts
- editor selection normalization and panel-readable derived state

### Optional, not blockers

These are optional future migrations rather than required runtime-spine work:

- pending message id generation
- context normalization policy in `src/domains/ai/aiContextRuntime.js`
- provider/model pool aggregation

### Enforcement rule

From this point forward:

- new AI runtime behavior should land in Rust first
- frontend changes should call stable Rust seams
- if ownership is unclear, default to Rust

---

## Phase 2: Desktop Interaction Parity

### Goal

Make the right-side AI panel feel like a Codex Desktop task surface instead of an outline inspector with an AI widget attached.

### Completion outcome

Phase 2 is complete. The shipped result now has:

- lighter, more operational session switching
- a denser agent-work-log thread
- a dominant composer control surface
- a panel hierarchy that reads more like an agent workspace

### Design stance

The panel should feel:

- direct
- keyboard-first
- low-ceremony
- dense but readable
- quiet by default, explicit when user intervention is needed

It should not feel:

- like a generic chat app
- like a settings-driven assistant shell
- like a badge-heavy dashboard
- like a second product hidden inside the inspector rail

### Stable Phase 2 rules

- one dominant default path: select session, type task, send, observe, intervene only when needed
- session chrome stays lightweight
- messages read like an agent work log
- intervention states stay obvious and singular
- the composer belongs to the panel shell rather than a nested card

---

## Phase 3: Control-State Parity

### Goal

Make plan mode, approvals, resume, compacting, and background task progress read like one runtime control layer instead of a loose collection of banners and pills.

### Completion outcome

Phase 3 is complete. The shipped result includes:

- a unified runtime control-state layer above the composer
- blocking-state coherence for `ask-user`, `permission`, and `exit-plan`
- non-blocking runtime state cards for `plan`, `resume`, `compacting`, and `background tasks`
- density control for runtime summaries and cards
- explicit composer-side controls for plan mode and permission policy

### Stable Phase 3 rules

- one blocking state wins
- non-blocking state stays compact
- plan approval is part of the same control system as permission approval
- the user must be able to distinguish running, waiting, blocked, and finished states at a glance

---

## Phase 4: Extension and MCP Parity

### Goal

Close the main ecosystem gap between the current Altals AI panel and Codex-style extension workflows by defining and implementing a first working MCP client path.

### Current baseline

The panel already has:

- a coherent control-state layer
- explicit plan mode and permission controls
- denser session and composer behavior
- a Rust-owned runtime spine for the main execution path

### Current implementation state

The active Phase 4 slice now includes:

- Rust-owned MCP config discovery across workspace and user roots
- Rust-owned stdio probe and runtime tool-call wiring
- a Rust-owned runtime extension status summary used by the desktop UI
- low-emphasis desktop visibility for ready versus degraded MCP state in Settings and the AI panel
- a Rust-owned runtime tool catalog that can surface MCP-backed tools alongside built-in tools
- unified `#tool` suggestion plumbing so agent-mode composer suggestions no longer stop at built-in tools

Still pending:

- skills versus MCP precedence and presentation rules
- richer transport support beyond the current stdio-first slice
- deeper failure recovery and invocation UX beyond summary visibility

### Stable Phase 4 rules

- extensions stay low-emphasis
- MCP and skills need one mental model
- runtime truth lives in Rust
- the desktop surface only shows decision-relevant extension state

### Validation focus

- `npm run lint`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- one real desktop task flow that exercises the first MCP-backed slice

Key checks:

- extension availability is understandable from the desktop surface
- missing or disconnected MCP capability degrades cleanly
- MCP presence does not overload the default composer path
- skills and MCP do not present contradictory mental models

---

## Practical rule for future AI work

Put the change in Rust if it affects:

- runtime state transitions
- session schema
- turn execution
- tool behavior
- approval semantics
- event interpretation
- thread synchronization
- persistence shape

Keep it in frontend if it affects:

- panel rendering
- local UI affordances
- user input widgets
- purely presentational derived state
- model/provider picker interaction
