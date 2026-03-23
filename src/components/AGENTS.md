# Component Layer Agents

Scope: `src/components/`

Components should present state, collect user input, and emit clear intent.

## Principles

- keep side effects shallow
- keep state transitions visible
- prefer explicit status and recovery affordances over hidden magic
- split giant surfaces by responsibility when they become hard to reason about

## Avoid In Components

- direct `launchAiTask(...)` or `launchWorkflowTask(...)` calls when a shared app/domain seam should exist
- direct Git/history persistence logic
- raw Tauri invoke chains
- compile orchestration that belongs in workflow runtimes
- kernel lifecycle logic that belongs in notebook/execution boundaries

Use components to make the product clearer, not to hide more logic inside large `.vue` files.
