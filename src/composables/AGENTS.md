# Composable Layer Agents

Scope: `src/composables/`

Composables should hold reusable UI glue and local interaction state.

## Good Uses

- shared UI behavior
- derived view state
- event wiring for one surface family
- component reuse helpers

## Bad Uses

- becoming a hidden application service layer
- owning cross-surface product state machines
- directly coordinating build, AI, history, or notebook workflows when those should live in domains

If a composable becomes the real owner of a workflow, extract a domain runtime and keep the composable as a thin bridge.
