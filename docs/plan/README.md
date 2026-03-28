# Iteration Plan

This file tracks medium-term priorities. It is not the execution log; `docs/REFACTOR_BLUEPRINT.md` is the live slice record.

## Current Iteration Priorities

1. Keep the Markdown / LaTeX / Typst workspace clean and trustworthy.
2. Continue thinning app-shell and store-heavy paths into explicit domain and service seams.
3. Keep docs, audit tests, and active code aligned with the shipped product.

## Near-Term Frontend Work

- reduce remaining restore and preview compatibility branches
- improve PDF and preview performance
- keep large document surfaces split by responsibility

## Near-Term Backend Work

- flatten broad Tauri modules toward command, core, and service boundaries
- keep filesystem and process execution concerns separate

## Ongoing Quality Work

- expand tests when new seams land
- remove stale assumptions quickly instead of letting them linger in active docs
