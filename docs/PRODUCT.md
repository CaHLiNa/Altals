# Product

## Purpose

This document records the current product definition of Altals.

It describes the product as it exists today and the refactor direction already chosen in the repository.

## Current Product Definition

Altals is a local-first, project-directory-centered academic writing workspace.

The product center is:

1. open a local project
2. browse files
3. edit documents
4. manage references
5. build and preview outputs
6. review changes
7. optionally use AI through auditable proposal/patch workflows

## First-Class Product Objects

The current refactor treats these objects as first-class:

- Project
- Document
- Reference
- Build
- Change
- Workflow

These objects are the basis for the current architecture work in `src/app`, `src/domains/*`, and the refactor blueprint.

## Secondary Systems

These systems still matter, but they are secondary to the writing workflow:

- Git
- remote sync
- terminal
- AI chat
- experimental panels
- migration shims

If there is tension between these systems and the main writing loop, the writing loop wins.

## Current Real User Flow

Today the clearest supported user flow is:

1. open a workspace folder
2. browse the file tree
3. edit Markdown / LaTeX / Typst or related project files
4. build and preview document outputs
5. inspect file history or workspace save points
6. optionally ask AI to diagnose or propose a patch for a narrow task

This flow is supported by:

- file tree and editor panes
- document workflow toolbar and preview surfaces
- reference library/workspace collections
- Git-backed file version history
- app-managed workspace save points above Git-backed content history
- workflow-bound AI sessions with explicit approval checkpoints for edit paths

## Current Non-Goals

The current refactor is not trying to make Altals into:

- a generic research everything-app
- a Git-first interface where commits are the default persistence model
- an autonomous AI mutator that edits files without review
- a whole-project rewind system for every workspace save point

## Current Product Clarity Rules

These distinctions must stay explicit:

- autosave is not a snapshot
- a local workspace save point is not the same thing as a Git commit
- remote sync is not a local recovery layer
- file version history is not the same thing as workspace save-point restore
- AI chat is not an approval-free mutation path

## Current Product Risks

The main remaining product risks are:

- some support systems still have too much architectural weight compared with the core writing workflow
- file-scoped history is still Git-backed while workspace save points use a hybrid local-payload-plus-Git model
- AI launch entry points are still distributed outside the now-landed document workflow seam
