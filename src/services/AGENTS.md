# Service Layer Agents

Scope: `src/services/`

Services wrap effectful integrations. They are not the product architecture.

## Service Responsibilities

- Tauri invoke wrappers
- filesystem and process helpers
- compiler and preview adapters
- transport and serialization helpers

## Constraints

- do not mutate UI state directly here
- do not import components here
- do not turn services into policy hubs that decide user intent
- do not let one service file absorb multiple domains indefinitely

If a service starts deciding when or why a workflow should run, move that logic into `src/domains/*` or `src/app/*`.
