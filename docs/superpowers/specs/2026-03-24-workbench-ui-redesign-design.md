# Altals Workbench UI Redesign Design

Status: Approved for planning
Date: 2026-03-24
Scope: Top-level workbench shell, information architecture, visual system, phased migration

## 1. Context

Altals is not a generic editor shell. The product is a local-first, project-directory-centered research and academic operating system. The current top-level interface still centers too much of its navigation around `workspace / library / ai` surfaces. That structure exposes implementation history more than the user's real academic workflow.

The approved redesign replaces surface-first framing with a research workbench that directly reflects the end-to-end academic loop:

1. load references into the library
2. read papers and translate when needed
3. capture early ideas in Markdown drafts
4. write formal papers in LaTeX or Typst with references, compilation, and PDF preview
5. run simulation and analysis in Python or R
6. use AI throughout all of the above workflows

This redesign is not a visual polish pass. It is a shell-level reorganization of the product so the interface matches the actual research loop.

## 2. Goals

- Reframe the product as one integrated academic workbench instead of several parallel surfaces.
- Rebuild the shell into five stable regions with explicit responsibilities.
- Make the navigation model match research workflows, not implementation modules.
- Keep AI embedded across reading, writing, and computation instead of isolating it as a side product.
- Support phased migration without rewriting the entire editor, viewer, notebook, terminal, or build stack at once.

## 3. Non-Goals

- Do not rewrite the editor core in the first phase.
- Do not replace existing PDF, notebook, terminal, citation, or build capabilities before the shell is stable.
- Do not introduce a fully free-form dockable desktop system in this redesign.
- Do not use the top header as a business workflow surface.

## 4. Approved Product Direction

### 4.1 Primary product axis

The interface should prioritize the research workflow:

- references and reading
- drafting and formal writing
- computation and simulation
- AI assistance across all stages

This is not a document-only editor and not a computation-only IDE. It is one academic project workspace.

### 4.2 Shell framing

The redesign adopts a desktop workbench direction with five persistent regions:

1. fixed left rail
2. collapsible left sidebar
3. main editing canvas
4. right inspector sidebar
5. bottom footer region that can expand into a workbench

### 4.3 Header policy

The top header remains, but only as ultra-thin system chrome. It should contain:

- project identity
- global search / command entry
- window-level actions

It should not act as the main business toolbar.

### 4.4 Footer policy

The footer acts as:

- a thin status bar by default
- an expandable workbench when terminal, build logs, run logs, translation tasks, or AI task queues need more space

This keeps the main shell calm while still supporting heavyweight research workflows.

### 4.5 Delivery policy

Implementation will happen through phased replacement:

1. rebuild the five-region shell
2. migrate content into the new shell one space at a time
3. unify the visual system after structural migration is stable

## 5. Five-Region Shell

### 5.1 Region 1: Fixed left rail

Purpose:

- hold stable first-level workbench spaces
- act as the main product navigation spine

Approved first-level spaces:

- Project
- Literature
- Writing
- Computation
- AI

The fixed rail should remain visually stable across the whole application.

### 5.2 Region 2: Collapsible left sidebar

Purpose:

- hold second-level navigation for the active first-level space
- show trees, lists, grouped items, queues, and filtered views

It is not just a file tree host. Its content changes meaningfully with the active workbench space.

### 5.3 Region 3: Main editing canvas

Purpose:

- host the user's active task surface
- support reading, writing, compiling, previewing, running, and reviewing

This remains the highest-priority visual region.

### 5.4 Region 4: Right inspector sidebar

Purpose:

- show contextual inspection for the current task
- surface outline, metadata, diagnostics, references, summaries, and contextual tools

It is an inspector, not a second navigation column.

### 5.5 Region 5: Footer and expandable bottom workbench

Purpose:

- show global and task-specific status at rest
- expand into a working surface for terminal, logs, build output, run output, and task queues

This region carries operational weight without permanently stealing height from the main canvas.

## 6. Workbench Spaces

The product should move from implementation-driven surfaces toward workflow-driven spaces.

### 6.1 Project

Purpose:

- return to project-wide control
- provide recovery, orientation, and overview

Approved left sidebar sections:

- Overview
- Files
- Recent
- Builds
- Changes

Main canvas priorities:

- project dashboard
- recent work
- current build state
- resume points

Inspector priorities:

- project metadata
- selected item details
- recent build summary
- change summary

Footer expansion priorities:

- build logs
- snapshot and change history
- project-level operational output

### 6.2 Literature

Purpose:

- support import, reading, translation, excerpting, and literature organization

Approved left sidebar sections:

- Library
- Reading Queue
- Tags and Groups
- Translation Tasks
- Excerpts

Main canvas priorities:

- PDF reading
- original / translated text switching or side-by-side reading
- excerpt capture
- movement from reading into note-taking

Inspector priorities:

- metadata
- tags
- citation details
- summary cards
- reading progress

Footer expansion priorities:

- translation progress
- OCR or parsing logs
- bulk import results
- AI reading-assistance tasks

### 6.3 Writing

Purpose:

- support Markdown drafting and formal paper writing in LaTeX and Typst

Approved left sidebar sections:

- Drafts
- Manuscripts
- References
- Build Targets
- Review

Main canvas priorities:

- Markdown drafting
- LaTeX / Typst editing
- source and preview coordination
- citation insertion
- PDF preview after build

Inspector priorities:

- outline
- reference checks
- diagnostics
- comments and review context
- build summary

Footer expansion priorities:

- compile logs
- error lists
- PDF build records
- citation repair suggestions
- AI writing tasks

Writing is the highest-priority production space in the overall redesign.

### 6.4 Computation

Purpose:

- support notebooks, scripts, simulations, run history, and research outputs

Approved left sidebar sections:

- Notebooks
- Scripts
- Run History
- Data and Results
- Environment

Main canvas priorities:

- notebook editing
- Python / R editing
- run execution
- result viewing
- artifact generation

Inspector priorities:

- variable or runtime summary
- artifact metadata
- result summary
- error summary

Footer expansion priorities:

- terminal
- run logs
- kernel status
- job queues
- long-running task output

Computation is a first-class academic workflow, not a secondary terminal panel.

### 6.5 AI

Purpose:

- host long AI sessions, workflows, proposals, patches, and research artifacts

Approved left sidebar sections:

- Sessions
- Workflows
- Artifacts
- Prompts
- History

Main canvas priorities:

- long-form conversation
- workflow execution
- proposal review
- artifact inspection

Inspector priorities:

- context sources
- change previews
- approval state
- related references

Footer expansion priorities:

- task queues
- tool-call logs
- generation status
- failure recovery

AI still needs to remain accessible inside Literature, Writing, and Computation. The dedicated AI space is for longer-lived orchestration, not for isolating AI from the rest of the product.

## 7. Region Behavior Rules

These rules keep the shell coherent across all spaces.

### 7.1 Global rules

- The fixed rail always keeps the same first-level navigation identity.
- The collapsible left sidebar always represents the active space's second-level navigation and collections.
- The main canvas always hosts the active task.
- The right sidebar always behaves as an inspector.
- The footer always rests as a status surface and expands for operational depth when needed.

### 7.2 Interaction rules

- Switching first-level spaces updates the left sidebar meaning and the default main canvas entry point.
- Space switches should preserve active task context when feasible rather than aggressively resetting the canvas.
- The right inspector should respond to the active task and selected entity, not become an alternate navigation system.
- Footer expansion content follows the active workflow, but terminal and long-running operational tasks may maintain continuity across spaces.
- Flows from Literature to Writing, Computation to Writing, and AI to any other space should be modeled as insertions, attachments, citations, or proposals rather than product-level context switches.

## 8. Visual System

### 8.1 Design direction

Approved visual direction:

- desktop workbench
- graphite shell
- paper-informed content surfaces

The shell should feel like a research operating surface, not a generic web dashboard and not just a reskinned code editor.

### 8.2 Visual hierarchy

- Fixed left rail: darkest and most stable layer
- Collapsible left sidebar: one step lighter, clearly navigational
- Main canvas: strongest contrast and highest task priority
- Right inspector: lighter and quieter than the main canvas
- Footer: thin and calm at rest, operationally distinct when expanded

### 8.3 Typography

Recommended typography roles:

- UI chrome: `Geist`
- reading and writing surfaces: `STIX Two Text`
- code and terminal: `JetBrains Mono`
- selective high-level editorial emphasis: `Crimson Text`

The current UI-wide `Inter` bias should not remain the sole shell voice.

### 8.4 Color

Approved color direction:

- deep graphite shell
- restrained borders and separations
- lighter paper-like reading and writing surfaces where appropriate
- a primary accent that is closer to cool green / patinated cyan than blue-purple

Status colors must remain explicit and operational:

- success
- warning
- error
- running / syncing / active information

### 8.5 Component language

- more desktop-like panel edges and weight
- less soft, web-dashboard-style rounding everywhere
- clearer distinction between hover, active, selected, and focused states
- separators should provide structural rhythm, not merely decoration
- navigation surfaces and inspector surfaces must not look interchangeable

### 8.6 Motion

Motion should remain restrained and purposeful. It should primarily communicate:

- first-level space switching
- left and right sidebar expand / collapse
- footer expand / collapse
- operational state changes

Motion is for state clarity, not spectacle.

## 9. Architecture Implications

This redesign should not be implemented by continuing to grow `App.vue` or by scattering new shell logic across unrelated components.

Recommended architectural direction:

- keep `App.vue` as thin composition shell
- introduce a dedicated workbench shell runtime for first-level space state and region coordination
- move top-level navigation semantics out of ad hoc surface checks
- make left sidebar and right inspector selection explicit and space-aware
- keep existing editor, viewer, terminal, reference, and AI capabilities behind adapter seams during migration

The current `workspace / library / ai` model should be treated as a legacy transition boundary, not the long-term product IA.

## 10. Phased Migration

### Phase 1: Shell reconstruction

- create the five-region shell
- replace current first-level surface framing with the approved workbench spaces
- keep existing feature components mounted through transitional adapters

### Phase 2: Space-by-space migration

- Project space takes over project overview, files, recent work, and changes
- Literature space reorganizes references, reading, translation, and excerpts
- Writing space consolidates Markdown, LaTeX, Typst, citations, build, and PDF preview
- Computation space formalizes notebooks, scripts, results, and runtime surfaces
- AI space becomes the home of long workflows, proposals, and artifacts

### Phase 3: Visual unification

- unify tokens, typography, panel hierarchy, iconography, and state presentation
- remove leftover visual cues from the legacy surface model

## 11. First Recommended Implementation Slice

The first implementation slice should not attempt the full redesign at once.

Recommended first slice:

- establish new first-level workbench spaces
- rebuild the fixed left rail to represent those spaces
- introduce a new shell state layer that maps first-level spaces to left sidebar, main canvas, and right inspector defaults
- keep the existing main content components alive behind transitional mappings

This creates the structural foundation needed for the rest of the redesign without destabilizing the core editor stack.

## 12. Validation Notes

- This design was iteratively reviewed and approved section by section in-session on 2026-03-24.
- User-approved decisions:
  - overall shell starts from the whole interface
  - five-region layout is the core frame
  - first-level navigation uses a mixed model
  - header remains ultra-thin system chrome
  - footer is a status bar plus expandable workbench
  - rollout uses phased replacement
  - the product axis follows the academic workflow from literature through writing and computation with AI throughout

## 13. Open Items For Implementation Planning

- define exact mappings from current `workspace / library / ai` state to the new first-level workbench spaces
- decide which existing components can be directly repurposed in Project and Literature first
- decide whether writing space defaults to split source / preview for LaTeX and Typst or remembers file-specific layouts
- define how AI entry points are invoked consistently inside Literature, Writing, and Computation without duplicating launch logic
- define state persistence rules for footer workbench continuity across space switches
