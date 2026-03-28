# App Layer Agents

Scope: `src/app/`

This layer is for top-level shell orchestration close to the application surface.

## Allowed Responsibilities

- workspace lifecycle wiring
- shell event bridges
- prompt and dialog coordination
- high-level action composition
- teardown and visibility handling

## Not Allowed Here

- deep document workflow logic
- compile pipeline details
- file persistence internals
- broad product policy that belongs in a domain runtime

## Rule Of Thumb

If code in `src/app/` starts carrying logic that would also be useful from another entry point, extract it into `src/domains/*` and keep the app hook as a thin bridge.
