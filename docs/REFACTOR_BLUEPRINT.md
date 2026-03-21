# Refactor Blueprint

## Overview

This repository is being refactored from a broad, feature-heavy research application into a focused, local-first academic writing workspace centered on project-based document editing, references, builds, changes, and AI-assisted patch workflows.

This file is the living refactor execution plan. It must be kept current.

## Product Direction

Target product definition:

> A local-first, project-directory-centered academic writing workspace.

Primary workflow:

1. Open project
2. Browse files
3. Edit document
4. Manage references
5. Build / preview
6. Review changes
7. Use AI through auditable proposals

## Architectural Principles

- Domain-first structure
- Thin root components
- Thin Rust commands
- Shared operation model
- Patch-first AI
- Clear separation of autosave, snapshot, git commit, and remote sync
- Documentation maintained alongside code
- Controlled migration, not uncontrolled rewrite

## Current State Assessment

Initial assessment pending or incomplete.

Suggested assessment areas:
- giant root components
- giant global stores
- legacy naming and docs
- mixed product identity
- overlapping build paths
- hidden automation in git/sync
- AI behavior and control surfaces
- insufficient tests and validation

## Phase Plan

### Phase 0 - Inventory and Freeze
- inventory current architecture
- identify keep/refactor/delete/defer
- establish docs baseline

### Phase 1 - Architecture Skeleton
- create domain structure
- introduce operation-oriented boundaries
- establish new docs structure

### Phase 2 - Project and Document Migration
- split workspace logic
- migrate open/read/save/dirty/tab flows

### Phase 3 - Build and Diagnostics Migration
- unify build jobs and diagnostics

### Phase 4 - Changes, Snapshots, and Git Migration
- separate autosave, snapshot, git, sync

### Phase 5 - AI Workflow Migration
- move AI to proposal/patch/review flows

### Phase 6 - Cleanup and Stabilization
- delete dead paths
- clean docs
- improve tests and CI

## Task Backlog

- [ ] Audit current top-level architecture
- [ ] Identify largest legacy bottleneck files
- [ ] Create or refine product definition doc
- [ ] Create or refine architecture doc
- [ ] Introduce domain directory structure
- [ ] Introduce shared operation model
- [ ] Migrate project open/read/save flow
- [ ] Migrate build diagnostics flow
- [ ] Introduce snapshot abstraction
- [ ] Reduce hidden git automation
- [ ] Convert AI to patch-first workflow
- [ ] Delete obsolete legacy paths
- [ ] Add validation and tests

## In Progress

- None yet

## Completed

- Created initial refactor blueprint baseline

## Blocked / Risks

- Legacy code paths may be deeply coupled
- Product behavior may be partially undocumented
- Some large files may mix multiple responsibilities
- Existing user-facing flows may depend on hidden side effects

## Next Recommended Slice

1. Audit the existing repository structure and identify:
   - giant root components
   - giant stores
   - Rust command aggregation points
   - legacy docs and naming
2. Update this blueprint with concrete findings
3. Create or update `docs/PRODUCT.md`
4. Begin Phase 1 skeleton work

## Validation Checklist

For each meaningful refactor slice, verify:

- [ ] code still builds
- [ ] changed flows still run
- [ ] docs were updated
- [ ] old/new boundary is clear
- [ ] dead code candidates are identified
- [ ] next slice is documented

## Migration Notes

Keep migration incremental where possible:
- create new paths
- reroute usage
- validate behavior
- delete old paths after stabilization