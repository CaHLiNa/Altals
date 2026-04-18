# AI Codex Phase 1 Runtime Boundary

Date: 2026-04-18
Status: Finalized boundary for Phase 1
Related master plan: `plan/2026-04-18-codex-desktop-replication-master-plan.md`

## Purpose

This document replaces the earlier Phase 1 runtime audit baseline.

Its job is no longer to propose a migration order. The migration spine has already been implemented.

Its job now is to freeze the current ownership boundary:

1. what is now definitively Rust-owned
2. what frontend code is still allowed to keep
3. what remains optional rather than mandatory to migrate

This is a runtime ownership document, not a UI redesign document.

## Final rule

AI runtime authority is Rust-owned.

Frontend code may keep:

- rendering
- user intent emission
- panel-local derived view state
- small input/composer helpers
- provider and model selection UI

Frontend code should not be the authority for:

- turn orchestration
- session schema ownership
- runtime event routing
- stop or interrupt resolution
- approval, ask-user, or exit-plan protocol semantics
- runtime thread synchronization
- message shaping based on runtime semantics

## What Phase 1 achieved

The current AI main path is now Rust-first:

- prepare runs in Rust through `ai_agent_prepare_current_config`
- send runs in Rust through `ai_agent_run_prepared_session`
- runtime thread bootstrap happens in Rust
- stop and interrupt resolution happen in Rust
- runtime event routing and reduction happen in Rust
- session normalization happens in Rust
- local session mutation semantics happen in Rust

The frontend store is no longer the runtime conductor.

## Canonical ownership map

### Rust-owned now

These are now the canonical runtime seams:

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
- session start, complete, fail, finalize, interrupt
- runtime event routing and reduction
- runtime-thread-to-session synchronization
- session normalization
- session local mutation semantics
- session overlay persistence
- attachment record creation
- approval, ask-user, exit-plan, plan-mode, and background-task runtime protocol

Primary backend files:

- `src-tauri/src/ai_agent_prepare.rs`
- `src-tauri/src/ai_agent_prompt.rs`
- `src-tauri/src/ai_agent_run.rs`
- `src-tauri/src/ai_agent_session_runtime.rs`
- `src-tauri/src/ai_runtime_thread_client.rs`
- `src-tauri/src/ai_runtime_turn_wait.rs`
- `src-tauri/src/ai_runtime_session_rail.rs`
- `src-tauri/src/ai_session_local_runtime.rs`
- `src-tauri/src/ai_session_storage.rs`
- `src-tauri/src/ai_tool_catalog.rs`
- `src-tauri/src/ai_skill_catalog.rs`
- `src-tauri/src/ai_attachment_runtime.rs`
- `src-tauri/src/codex_runtime/*`

### Frontend-owned now

The frontend still owns these categories, and that is acceptable:

- AI panel rendering
- session rail rendering and local interaction affordances
- composer input state binding
- file attachment picker wiring
- provider settings UI
- unified model pool UI aggregation
- toasts
- editor selection normalization and panel-readable derived state

Primary frontend files:

- `src/stores/ai.js`
- `src/components/panel/AiAgentPanel.vue`
- `src/components/panel/AiConversationMessage.vue`
- `src/components/panel/AiSessionRail.vue`
- `src/domains/ai/aiContextRuntime.js`

## Remaining frontend AI logic by category

### Allowed UI glue

These are allowed to remain in frontend code:

- `currentContextBundle`
- session getters such as `messages`, `artifacts`, `attachments`, `planModeState`
- `refreshProviderState`
- `refreshUnifiedModelPool`
- `setCurrentProvider`
- `setCurrentModel`
- `updateEditorSelection`
- `clearEditorSelection`
- toast display after failed actions

Reason:

- these are view-facing selectors or settings UI coordination
- they do not define the runtime contract

### Thin coordination still in the store

These still live in `src/stores/ai.js`, but are now thin wrappers over Rust commands:

- `runActiveSkill`
- `stopCurrentRun`
- `handleCodexRuntimeEvent`
- `syncSessionFromCodexRuntimeThread`
- `createSession`
- `switchSession`
- `renameSession`
- `deleteSession`
- `mutateSessionById`
- `ensureSessionState`

Reason:

- they coordinate panel behavior and apply returned session snapshots
- they no longer own the underlying runtime semantics

### Explicitly retained frontend-only local state

One small runtime-adjacent local state remains on purpose:

- `runtimePendingSessions`

It stores only:

- `pendingAssistantId`
- `stopRequested`

Reason:

- the panel still needs a minimal local bridge while a turn is in-flight and before the next runtime event arrives
- this is not authoritative runtime state
- it is UI stitching, not runtime ownership

## What is no longer a Phase 1 blocker

The following items are no longer required for Phase 1 completion:

- moving provider settings UI into Rust
- moving model-pool aggregation into Rust
- removing every AI helper from `src/stores/ai.js`
- forcing all derived getters into backend snapshots
- moving mention or composer UX helpers into Rust

Those would be optional cleanup or future simplification, not runtime-spine requirements.

## Optional future migrations

These can still be migrated later if they prove worth the complexity:

### 1. Pending message id generation

Current state:

- `userMessageId`
- `pendingAssistantId`

are still created in frontend code before submit.

Why it is optional:

- this is local message placeholder stitching
- it does not currently create split-brain runtime semantics

### 2. Context normalization policy

Current state:

- `src/domains/ai/aiContextRuntime.js` still builds and normalizes the context bundle

Why it is optional:

- part of it is UI-adjacent
- part of it may eventually belong in Rust if context eligibility rules become more complex

### 3. Provider/model pool aggregation

Current state:

- multi-provider model aggregation still happens in frontend code

Why it is optional:

- it is settings/composer UI behavior, not turn execution authority

## Phase 1 completion verdict

Phase 1 should now be considered complete.

Because the required bar was:

- Rust owns prepare and run: yes
- Rust owns stop and interrupt resolution: yes
- Rust owns event routing: yes
- Rust owns session normalization: yes
- frontend is no longer the runtime conductor: yes

## Practical rule for future changes

For any future AI work, use this decision test:

### Put it in Rust if it changes:

- runtime state transitions
- session schema
- turn execution
- tool behavior
- approval semantics
- event interpretation
- thread synchronization
- persistence shape

### Keep it in frontend if it changes:

- panel rendering
- local UI affordances
- user input widgets
- purely presentational derived state
- model/provider picker interaction

## Current risk

The main remaining risk is not architectural split-brain anymore.

The main risk is regression by drift:

- a future feature may reintroduce AI runtime behavior into `src/stores/ai.js`
- a new UI shortcut may bypass the Rust-owned path
- an experimental provider-specific behavior may land in frontend code for convenience

That should be treated as architectural regression, not harmless glue.

## Enforcement note

From this point forward:

- new AI runtime behavior should land in Rust first
- frontend changes should call stable Rust seams instead of recreating runtime branches
- if a new feature cannot clearly justify frontend ownership, it should default to Rust
