# Component Layer Agents

Scope: `src/components/`

Components should present state, collect user input, and emit clear intent.

## Principles

- keep side effects shallow
- keep state transitions visible
- prefer explicit status and recovery affordances over hidden magic
- split giant surfaces by responsibility when they become hard to reason about

## Avoid In Components

- direct compile orchestration that belongs in workflow runtimes
- direct Git or persistence sequencing
- raw Tauri invoke chains
- restore or migration logic that belongs in services or domains

Use components to make the product clearer, not to hide more logic inside large `.vue` files.
