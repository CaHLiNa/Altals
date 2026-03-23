# UI OS Redesign Phase 1

## Purpose

This document tracks the first user-directed UI / UX restructuring slice for Altals.

It does not replace `docs/REFACTOR_BLUEPRINT.md`.
The blueprint remains the current-state execution log.
This file describes the first concrete redesign arc and its implementation boundaries.

## Status

As of 2026-03-23, the first slice is landed in code:

- workflow-oriented shell header
- upgraded project continue surface
- document context header above active files
- calmer, more secondary footer

The next redesign work is now in progress and moves from shell semantics into sidebar / evidence / build / changes hierarchy.

## Why This Slice Exists

As of 2026-03-23, Altals already has meaningful local-first research-workspace capability, but the frontend still presents too much of that capability through an IDE-shaped shell:

- tool-first top navigation
- generic tab dominance
- dense footer status mechanics
- sidebars and panels that feel equally weighted
- weak project-home and document-context affordances

The result is a product that behaves more like a research operating system than it looks.

## Phase 1 Thesis

The first redesign slice should not attempt a full frontend rewrite.

It should deliver a visible semantic shift by changing what the interface treats as primary:

- from pane / tab / surface
- to project / document / task / recovery

## User-Facing Goals

Phase 1 should make these changes visible immediately:

1. the shell reads as a research workflow shell rather than a tool switcher
2. opening a project exposes a real continue-work surface
3. active documents gain a strong context header
4. build, changes, recovery, and AI are visible as document/workspace state
5. terminal and low-level utilities remain available but become visually secondary

## Planned Scope

### 1. Workflow Shell

- replace the old tool/surface emphasis in the header
- make project identity and current work more legible
- surface build / recovery / proposal state in calmer summary form

### 2. Project Home / Continue

- upgrade `WorkspaceStarter.vue` into a real project continue surface
- emphasize recent documents, attention items, recovery, and fast-start actions
- keep library and AI reachable without presenting them as the product center

### 3. Document Context Header

- introduce a semantic header above the active document
- show document identity, lightweight path context, state, and next actions
- surface build summary, change state, recovery entry points, and AI entry points here

### 4. Footer Demotion

- preserve existing save/status hooks
- reduce the feeling that the footer is carrying the product
- keep terminal, saved versions, and environment signals secondary

## Explicit Non-Goals

Phase 1 does not aim to do the following:

- introduce a new routing system
- rewrite notebook execution architecture
- change snapshot / restore semantics
- replace current build backends
- remove advanced pane behavior
- solve the broader execution/notebook boundary problem

## Architectural Guardrails

- preserve the current operation seams for build, AI, and snapshot actions
- use app events or existing store/domain seams instead of adding new hidden side effects
- do not expand `App.vue` or move orchestration back into root components
- keep the redesign incremental and shippable in narrow slices

## Implementation Order

1. update blueprint and plan docs
2. rework shell header and lightweight footer hierarchy
3. land the upgraded project continue surface
4. land the document context header
5. validate build behavior and repository docs/tests

## Expected Follow-Up

If Phase 1 lands cleanly, the next redesign slices should likely be:

1. writing-mode sidebar and evidence-layer restructuring
2. build and changes surfaces with more writer-facing language
3. AI entry-point tightening across writing, evidence, build, and recovery
