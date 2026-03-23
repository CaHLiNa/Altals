# Altals UI / UX Modernization Brief
## From IDE-like Tool Shell to a Local-First Academic Research Workspace

This document defines the next product design and implementation direction for Altals.

It is intended for Codex to execute as a product-focused engineering task brief.

---

# 1. Mission

Altals should no longer feel like a classic multi-pane IDE with research features attached.

Altals should feel like:

> A local-first academic research workspace where writing, references, builds, changes, recovery, and AI-assisted revision are organized around the user’s work, not around tool panels.

The goal of this effort is not cosmetic modernization alone.

The goal is to shift Altals from:
- tool-centered
- pane-centered
- tab-centered
- IDE-like interaction patterns

toward:
- workflow-centered
- document-centered
- project-centered
- recovery-aware
- research-oriented interaction patterns

---

# 2. Core Product Positioning

Altals is not just:
- a Markdown editor
- a LaTeX editor
- a Typst editor
- a note app
- a code IDE
- a citation manager
- an AI chat shell

Altals is:

> A local-first academic work platform that unifies writing, references, builds, changes, recovery, and AI-assisted patch workflows.

The UI and interaction model must communicate this clearly.

---

# 3. Primary UX Problem

Current product capabilities are increasingly system-like, but the surface experience still feels too much like an IDE.

Symptoms of the current problem may include:
- too many equally weighted panes
- too much panel switching
- too much tool-first navigation
- too much exposure of internal mechanics
- weak distinction between primary workflow and secondary utilities
- document tabs acting like generic files instead of first-class research objects
- AI appearing as a chat panel rather than a contextual system capability
- changes/history/recovery feeling like developer tooling instead of a writing safety system

The result is that Altals may be understood as:
- a powerful desktop IDE for research writing

instead of:
- a research operating workspace designed around scholarly work

---

# 4. High-Level UX Goal

The interface should make the user feel:

- I am in a project
- I am working on a document with context
- the system knows my references, build state, changes, and recovery options
- AI is assisting my current task, not just sitting in a side chat
- low-level tools exist, but they do not define the product

The interface should prioritize:
1. current project
2. current document
3. current task
4. current problems
5. current recovery options
6. current next actions

---

# 5. Design Principles

## 5.1 Workflow over tools
Do not prioritize surfacing tools just because they exist.
Prioritize the user’s current research workflow.

## 5.2 Documents are first-class objects
A document should not feel like a generic file tab.
A document should feel like a research object with:
- content
- build state
- reference context
- change state
- recovery state
- AI actions

## 5.3 Recovery must feel product-level, not developer-level
Snapshot, save point, version history, and restore must feel like a safety/revision system for writing.
They must not feel like raw Git mechanics.

## 5.4 AI must feel contextual, scoped, and operational
AI should not primarily be surfaced as a generic chat pane.
AI should primarily appear as contextual actions tied to:
- current selection
- current paragraph
- current document
- current build issue
- current reference task
- current diff / restore view

## 5.5 Low-level tools remain available but visually secondary
Terminal, raw logs, and deep technical tooling should remain available, but they should not dominate the primary experience.

## 5.6 The product should feel calm, not dense
Reduce the sense of a crowded engineering workspace.
Increase:
- hierarchy
- focus
- whitespace
- semantic grouping
- task orientation

---

# 6. Structural UX Shift

Altals should move from an IDE shell to a workspace shell.

## 6.1 IDE shell model
Common IDE shell traits:
- equal-weight panels
- tool-centric navigation
- generic file tabs
- raw logs surfaced early
- UI optimized for developer mechanics

## 6.2 Workspace shell model
Target workspace shell traits:
- project awareness
- document awareness
- contextual work modes
- visible writing/build/reference/change state
- guided task actions
- recovery visible as part of work

---

# 7. Information Architecture Redesign

Reorganize the product around research workflow rather than tool categories.

## 7.1 Top-level navigation should become workflow-oriented

Avoid top-level navigation that is just:
- Files
- References
- History
- Terminal
- AI

Preferred top-level navigation should be closer to:
- Project
- Writing
- Evidence
- Build
- Changes
- Assist

These labels may be refined, but the structure must be workflow-oriented.

## 7.2 Recommended navigation model

### Project
For:
- project overview
- recent documents
- workspace state
- high-level project activity

### Writing
For:
- current documents
- outline
- preview
- active writing flow
- current draft surfaces

### Evidence
For:
- references
- citations
- paper metadata
- attached PDFs
- notes related to sources

### Build
For:
- build health
- diagnostics
- preview generation state
- problem summaries
- output readiness

### Changes
For:
- file version history
- workspace save points
- comparison
- restore
- recovery

### Assist
For:
- AI proposals
- selection rewrite actions
- explain/fix flows
- context-aware research help

Low-level tools like terminal should be nested or secondary, not first-class top-level identity drivers.

---

# 8. App Shell Redesign

## 8.1 Objective
The top-level shell should communicate:
- where the user is
- what they are working on
- what state the workspace is in
- what the next important action might be

## 8.2 Requirements

### A. Add a project-focused shell header
The application shell should expose a clear project header showing useful context such as:
- project name
- workspace identity
- primary active document
- global build state summary
- save point / recovery state summary
- relevant mode or current activity

Do not expose low-level status details by default if they do not help the user work.

### B. Introduce a project home / continue-work surface
When appropriate, the app should provide a project-centric resume surface, not just a blank editor shell.

Potential sections:
- continue working on recent document
- unresolved build issues
- recent save points
- recently used references
- active AI suggestions or pending review items

### C. Reduce “everything is open at once” feel
Avoid making the default shell feel like every subsystem must be visible simultaneously.

The default layout should bias toward:
- current work
- relevant context
- a calm center of gravity

---

# 9. Document Workspace Redesign

This is the highest-priority UI area.

## 9.1 Problem
Current documents may still feel like generic file tabs in an editor.

## 9.2 Goal
A document should feel like a first-class research object.

## 9.3 Required addition: Document Context Header

Every active document workspace should include a visible document context header.

This header should present:

### Identity
- document title
- document type (LaTeX / Typst / Markdown)
- project association
- path or location in a lightweight form

### State
- build status
- reference/citation status
- change state
- save point / recovery state

### Actions
- preview
- build
- cite
- compare
- save point
- ask AI / apply proposal workflow

This should make the user feel they are working on a research object, not just editing a raw file.

## 9.4 Reduce generic tab dominance
Tabs can remain, but they should not be the primary carrier of document identity.
The document context header should carry more semantic weight than the tab strip alone.

## 9.5 Improve focus around the central writing area
The active writing area should feel like the center of the product.
Secondary context should support it, not compete with it.

---

# 10. Writing Mode UX

## 10.1 Goal
Writing mode should feel like a focused academic workspace.

## 10.2 Recommendations
- emphasize the current draft
- keep preview tightly coupled to the current document
- surface citations and build state as context, not detached panels
- make “continue writing” the dominant emotional tone

## 10.3 Avoid
- too many always-open utility panes
- too many tiny controls
- panel sprawl
- raw system state dominating the page

---

# 11. Preview UX

## 11.1 Goal
Preview should feel like part of document work, not an external tool pane.

## 11.2 Requirements
- preview access should be obvious from the document header
- preview state should be reflected as document state
- preview errors should first show meaningful summaries, then detailed logs
- Typst / LaTeX / Markdown preview affordances should feel unified where possible

## 11.3 Desired mental model
The user should feel:
- “this document has an output state”
not
- “I opened another tool window”

---

# 12. Build and Diagnostics UX

## 12.1 Problem
Build surfaces often inherit the feel of IDE compile output.

## 12.2 Goal
Build should feel like document readiness and writing quality state.

## 12.3 Requirements

### A. Introduce readable build summaries
Prefer summaries like:
- ready
- needs attention
- bibliography issue
- preview unavailable
- output out of date

before exposing raw log text.

### B. Order problems by writing impact
Prioritize:
- blockers to output generation
- reference-related failures
- errors relevant to current document or section

### C. Push raw logs deeper
Logs should remain accessible, but should not dominate the primary diagnostic experience.

---

# 13. References / Evidence UX

This is a major opportunity for product differentiation.

## 13.1 Problem
References often feel like a separate library tool rather than part of writing.

## 13.2 Goal
References should feel like an evidence layer tightly integrated with the current document and project.

## 13.3 Requirements

### A. Surface document-specific reference context
The current document experience should expose:
- references used in this document
- recent references
- likely citation opportunities
- citation completeness or missing-reference signals

### B. Reframe references as evidence work
The reference area should support views like:
- recently used
- used in this document
- used in this project
- needs review
- recently imported

### C. Make insertion contextual
Common actions should emphasize:
- insert citation into current location
- suggest references for current paragraph
- open source PDF / metadata / notes
- inspect source relevance to active section

---

# 14. Changes / Recovery UX

This is one of Altals’ strongest product opportunities.

The system already distinguishes between:
- file version history
- workspace save points
- local payload-backed restore behavior

The UI must fully express this as a user-facing recovery system.

## 14.1 Goal
Changes and recovery should feel like:
> a writing safety and revision system

not:
> developer history tooling

## 14.2 Naming guidance
Prefer product-language such as:
- Changes
- Saved Versions
- Recovery
- Revision

Avoid overexposing raw Git language as the primary user mental model.

## 14.3 Required structure

### A. Separate file-level and workspace-level recovery clearly
The UI should clearly distinguish:
- file version history
- workspace save points

This distinction already exists in system behavior and should remain explicit.

### B. Present diffs in writer-friendly language
Differences should be understandable as:
- text changes
- section changes
- added material
- removed material
- file additions/removals when relevant

### C. Surface safe recovery actions
Examples:
- restore selected text
- restore this file to saved version
- remove files added after this save point
- recover captured workspace files

## 14.4 Goal for user perception
The user should feel:
- my work is protected
- I can inspect before restoring
- restore is granular and understandable
- the system is helping me revise safely

---

# 15. AI UX Repositioning

## 15.1 Problem
If AI is primarily surfaced as a chat pane, it feels like an add-on.

## 15.2 Goal
AI should feel like an integrated, constrained, task-aware system capability.

## 15.3 Primary AI surfaces should be contextual actions

Examples:
- explain this build issue
- rewrite this selection
- suggest citations for this paragraph
- summarize this paper note
- compare current draft to saved version
- propose a patch for this section
- explain this diff
- suggest partial restore strategy

## 15.4 Secondary AI surface
A general chat interface can remain, but it should not be the main expression of AI in Altals.

## 15.5 Safety requirement
Do not introduce silent AI-only mutation paths.
AI actions should stay aligned with explicit proposal / patch / review flows.

---

# 16. Visual Design Direction

This effort is not just about styling, but visual changes are required.

## 16.1 Tone
Target tone:
- calm
- serious
- scholarly
- modern
- focused
- trustworthy

Avoid tone that feels:
- overly technical
- noisy
- retro desktop IDE-like
- overly playful
- visually cramped

## 16.2 Layout principles
- reduce heavy border density
- increase visual hierarchy
- give the central content area more calm
- make supporting surfaces feel contextual, not equally dominant
- use spacing and grouping instead of hard segmentation wherever reasonable

## 16.3 Typography and emphasis
- strengthen page and section hierarchy
- distinguish document identity from tool chrome
- improve readability of headers, state summaries, and action groups

## 16.4 Button and control density
Reduce visible control clutter.
Prioritize:
- a few strong, frequent actions
- secondary actions tucked into menus
- less noise around the main work surface

## 16.5 State language
Prefer user-comprehensible product language over raw system jargon.

Prefer:
- saved
- ready
- needs attention
- recovery available
- reference missing

Avoid surfacing internal terminology unless it provides clear value.

---

# 17. Priority Implementation Plan

## Priority 0 — Highest-value changes
1. Redesign top-level navigation from tool-oriented to workflow-oriented
2. Add a strong document context header for active documents
3. Elevate changes / recovery / save-point visibility into the document workflow
4. Reposition AI toward contextual actions instead of chat-first presence
5. Change build state from log-first to summary-first

## Priority 1 — Second wave
6. Rework references to feel document- and project-contextual
7. Add a project home / continue-work surface
8. Clarify naming and entry hierarchy for file history vs workspace save points
9. Reduce classic pane/border-heavy IDE visual feel
10. Move terminal and raw technical utilities into a visually secondary role

## Priority 2 — After shell/workflow improvements
11. Refine multi-document workspace behavior
12. Improve empty states and onboarding cues
13. Improve preview-state and build-state transitions
14. Improve revision compare / restore affordances
15. Tighten AI action entry points across writing, evidence, build, and changes

---

# 18. Implementation Constraints

## 18.1 Do not regress core systems
Do not break or regress:
- snapshot / restore flows
- local-first behavior
- build / preview workflows
- reference workflows
- current safety model boundaries

## 18.2 Do not turn this into a cosmetic-only pass
This effort must not become only:
- color tweaks
- icon swaps
- spacing-only cleanup
- superficial polish

The interaction model and information architecture must change.

## 18.3 Avoid broad uncontrolled rewrites
Prefer narrow, testable slices.
Refactor only as needed to support the UX shift.

## 18.4 Preserve explicit safety semantics
Do not collapse:
- autosave
- save points / snapshots
- git commit
- remote sync

Do not reintroduce Git-centric user-facing recovery as the dominant model.

---

# 19. Expected Execution Style

For each implementation slice:

1. identify one high-value user-facing UX boundary
2. make the smallest coherent structural change
3. preserve current behavior where possible
4. validate that the flow still works
5. summarize what changed
6. note what still feels too IDE-like
7. recommend the next UX slice

Do not stop at planning.
Do not produce docs-only progress unless blocked by a real design decision.

---

# 20. Deliverables Per Slice

For every meaningful slice, report:

1. what UI/interaction changed
2. what code paths changed
3. whether any docs were updated
4. what validation was run
5. what still feels too IDE-like
6. what the next highest-value UX slice is

---

# 21. First Recommended Slice

Start with the highest-leverage user-facing shift:

> Introduce a workflow-oriented shell and a document context header so the current document becomes the primary semantic object of the interface.

Suggested first slice:
- redesign or restructure top-level navigation to be workflow-oriented
- add a document context header for active documents
- surface build / references / changes / recovery / AI actions in that header
- keep current panes working, but visually and semantically demote raw tooling

This slice should create visible product-level change without requiring a full UI rewrite.

---

# 22. Success Criteria

This effort is successful when Altals feels less like:
- an IDE with academic features

and more like:
- a local-first research workspace

Concrete signs of success:
- users can tell what they are working on immediately
- current document state is obvious
- references/build/changes are clearly tied to writing
- AI appears as contextual help, not just chat
- recovery feels integrated and trustworthy
- terminal/raw tooling no longer defines the app’s identity
- the interface feels calmer, clearer, and more product-like

---

# 23. Final Instruction to Codex

Use this brief to guide implementation.

Default behavior:
- prioritize user-facing workflow improvements over abstraction cleanup
- preserve current safety and recovery semantics
- do not drift into low-value naming cleanup
- do not stop after one cosmetic slice
- keep changes incremental, validated, and product-oriented

The target is not “a prettier IDE”.

The target is:

> Altals as a modern academic research workspace with operating-system-like clarity around writing, evidence, builds, changes, recovery, and AI-assisted revision.