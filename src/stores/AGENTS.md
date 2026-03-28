# Store Layer Agents

Scope: `src/stores/`

Stores are reactive state holders and migration shells. They are not the long-term home for broad orchestration.

## Allowed

- reactive state
- getters and selectors
- thin wrapper actions
- runtime accessors
- UI preference and surface state

## Avoid

- long workflow methods
- file bootstrap internals
- compile pipelines
- Git sync sequencing
- hidden timers that belong in a domain runtime

When editing a large store, bias toward net simplification.
If a new behavior needs real workflow logic, add or extend a domain/runtime module first and then bridge it through the store.
