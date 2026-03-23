# Store Layer Agents

Scope: `src/stores/`

Stores are migration shells and reactive state holders. They are not the long-term home for broad orchestration.

## Allowed

- reactive state
- getters/selectors
- thin wrapper actions
- runtime accessors
- UI preference and surface state

## Avoid

- long workflow methods
- file watching/bootstrap internals
- compile/build pipelines
- AI task shaping
- Git sync sequencing
- notebook kernel protocol logic
- hidden timers that really belong to a domain runtime

When editing a large store, bias toward net simplification.
If a new behavior needs real workflow logic, add or extend a domain/runtime module first and then bridge it through the store.
