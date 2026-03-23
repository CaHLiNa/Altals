# App Layer Agents

Scope: `src/app/`

This layer is for top-level shell orchestration close to the application surface.

## Allowed Responsibilities

- workspace lifecycle wiring
- shell event bridges
- prompt/dialog coordination
- high-level action composition
- teardown and visibility handling

## Not Allowed Here

- deep document/build business logic
- notebook execution engines
- kernel protocol handling
- Git/history persistence details
- raw AI task construction when it belongs in a domain operation

## Rule Of Thumb

If code in `src/app/` starts carrying product logic that would also be useful from another surface, extract it into `src/domains/*` and keep the app hook as a thin bridge.
