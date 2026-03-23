# Domain Layer Agents

Scope: `src/domains/`

This is the target home for workflow and runtime boundaries.

## Expectations

- each file should own one coherent responsibility
- prefer explicit inputs, outputs, and dependency injection
- keep UI framework concerns out of domain code
- keep provider-specific details behind service boundaries

## Good Domain Work

- state machines
- workflow branching
- orchestration across multiple services
- shared operation helpers
- data normalization above raw service calls

## Bad Domain Work

- direct component rendering logic
- ad hoc DOM manipulation
- large Pinia-specific state containers
- hidden global singletons

When a workflow is currently scattered across components, stores, and services, pull the decision-making center into a domain runtime first.
