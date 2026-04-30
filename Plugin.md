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
- `invocation.current`
- `workspaceState`

Tree view support already includes:

- host-resolved root and child items
- reveal / expand / select
- selection change events

## 4. Current Manifest Use

`package.json` is still used for:

- discovery
- versioning
- entrypoint
- permissions
- settings schema
- basic command / view bootstrap metadata

But the intended direction is runtime-registration-first.

That means:

- manifest should stay small
- plugin behavior should live mainly in runtime code
- future features should prefer host APIs over more static contribution schema growth

## 5. Current UI Surfaces

Plugins can currently appear in:

- command palette
- action buttons
- sidebar view containers
- tree item context actions
- plugin settings page
- host-rendered quick input surfaces

## 6. Current Gap

The platform is functional, but it is not yet the final Obsidian-style shape.

Remaining cleanup direction:

- reduce contribution-schema-first assumptions
- move more behavior to runtime registration APIs
- keep expanding thick host APIs beyond `workspace` and `documents`
- make settings and registered runtime capabilities clearer in the UI
- avoid growing the workbench model just for parity with VS Code

## 7. Working Rule

When adding new plugin features:

- prefer runtime API design first
- keep manifest minimal
- keep Rust as system authority
- keep plugin business logic inside plugin code
- do not add plugin-specific core-app wiring unless absolutely necessary
