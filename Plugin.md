# ScribeFlow Plugin Platform

Last updated: 2026-05-01

This document describes the current plugin platform implementation.

For the final architecture direction, read:

- [PLUGIN-ARCHITECTURE.md](/Users/math173sr/Documents/GitHub/ScribeFlow/PLUGIN-ARCHITECTURE.md)

## 1. Current Position

ScribeFlow already has a working plugin runtime:

- local plugin folder discovery
- canonical `package.json` manifest
- `activate(context)`
- persistent Node plugin host
- Rust authority for secure system capabilities
- Vue-rendered plugin UI surfaces

The platform currently still contains some VS Code-style contribution concepts, but those are now transitional bootstrap mechanisms, not the long-term architectural center.

## 2. Current Folder Model

Plugin roots:

```text
~/.scribeflow/extensions/
<workspace>/.scribeflow/extensions/
```

Example:

```text
.scribeflow/extensions/example-pdf-extension/
  package.json
  dist/extension.js
```

## 3. Current Runtime Capabilities

Plugins can already use:

- `commands.registerCommand(...)`
- `commands.executeCommand(...)`
- `menus.registerAction(...)`
- `views.registerTreeDataProvider(...)`
- `views.createTreeView(viewId)`
- `views.reveal(...)`
- `views.updateView(...)`
- `window.showInformationMessage(...)`
- `window.showWarningMessage(...)`
- `window.showErrorMessage(...)`
- `window.showQuickPick(...)`
- `window.showInputBox(...)`
- `workspace.rootPath`
- `workspace.hasWorkspace`
- `documents.resource`
- `documents.target`
- `references.current`
- `references.readCurrentLibrary()`
- `pdf.current`
- `pdf.extractText(filePath?)`
- `pdf.extractMetadata(filePath?)`
- `process.exec(command, options?)`
- `process.spawn(command, options?)`
- `process.wait(pid)`
- `invocation.current`
- `settings.onDidChange(...)`
- `workspaceState`

Runtime command behavior now follows the host registry first:

- plugins may register runtime-only commands inside `activate(context)` without mirroring every internal command in manifest bootstrap metadata
- command execution is accepted when the host runtime registry reports the command, even if the command is omitted from `contributes.commands`
- command palette visibility still follows explicit menu registration, so internal runtime commands do not leak into top-level UI by default

Tree view support already includes:

- host-resolved root and child items
- reveal / expand / select
- selection change events

Runtime action registration already covers:

- `commandPalette`
- `pdf.preview.actions`
- `view/title`
- `view/item/context`

## 4. Current Manifest Use

`package.json` is still used for:

- discovery
- versioning
- entrypoint
- permissions
- settings schema
- basic command / view bootstrap metadata

In practice this means:

- keep sidebar/view identity, default user-facing command metadata, permissions, and settings schema in manifest
- keep internal helper commands, richer behavior wiring, and action registration in runtime code when they do not need standalone bootstrap UI
- treat manifest permissions as the Rust-backed host capabilities that are actually enforced today: workspace files, reference library, and local process spawning
- keep capability ids and capability IO schema in manifest only when the plugin actually benefits from that bootstrap metadata; they are not mandatory for every plugin package

But the intended direction is runtime-registration-first.

That means:

- manifest should stay small
- plugin behavior should live mainly in runtime code
- future features should prefer host APIs over more static contribution schema growth

## 5. Current UI Surfaces

Plugins can currently appear in:

- command palette
- action buttons
- document right sidebar tabs and plugin-owned views inside those tabs
- tree item context actions
- plugin settings page
- host-rendered quick input surfaces

Current usage rule:

- Settings is for discovery, lifecycle control, permissions and configuration
- normal plugin workflows should run from the document right sidebar after setup
- plugin-owned PDF/document actions should focus the matching plugin right-sidebar tab by default

## 6. Current Gap

The platform contract is now aligned with the intended local owner-authored runtime model.

Remaining cleanup direction:

- keep expanding thick host APIs beyond `workspace`, `documents`, `references`, `pdf`, and `process`
- make settings and registered runtime capabilities clearer in the UI
- avoid growing the workbench model just for parity with VS Code

## 7. Translation Plugin Boundary

For a future PDF translation plugin such as `retain-pdf`, the current platform boundary should be:

- Settings stores provider defaults and non-secret configuration
- the document right sidebar hosts task state, source context, result summary, and artifact entry points
- plugin runtime may orchestrate work through `context.process` when a sidecar or local worker is needed
- password-like plugin settings are now redirected into secure host-managed storage instead of plain extension settings files

Current production-oriented guidance:

- prefer secure host-managed plugin secrets for API keys and tokens; use env-based or sidecar-managed credentials only when the plugin needs a more complex external auth model
- keep OCR / LLM execution outside the core UI layer
- keep translated PDFs and related outputs flowing back as normal plugin tasks and artifacts

## 7. Working Rule

When adding new plugin features:

- prefer runtime API design first
- keep manifest minimal
- keep Rust as system authority
- keep plugin business logic inside plugin code
- do not add plugin-specific core-app wiring unless absolutely necessary
