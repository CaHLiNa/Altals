# ScribeFlow Final Plugin Architecture

Last updated: 2026-05-01

## 1. Decision

ScribeFlow plugins follow an Obsidian-style runtime model, not a full VS Code contribution platform.

The target shape is:

- local folder installed plugins
- canonical `package.json` manifest
- one runtime entrypoint (`main`)
- plugin code registers behavior at runtime through host APIs
- Rust remains system authority
- Vue remains UI rendering layer
- static manifest contributions are reduced to bootstrap metadata, not the primary product model

This is the final direction for ScribeFlow unless product goals change.

## 2. Product Goal

The plugin system exists to let ScribeFlow load self-contained optional features without moving their business logic into the core app.

The plugin system is not designed for:

- public third-party marketplace scale
- arbitrary untrusted code without permission boundaries
- reproducing the full VS Code workbench model

The plugin system is designed for:

- owner-authored plugins
- GitHub-downloaded plugin folders
- local-first desktop workflows
- plugin-specific settings, commands, sidebar views, and document actions
- plugins that call ScribeFlow runtime capabilities instead of patching core source

## 3. Installation Model

Plugin roots:

```text
~/.scribeflow/extensions/
<workspace>/.scribeflow/extensions/
```

Each plugin lives in its own directory:

```text
<plugin-root>/<plugin-id>/
  package.json
  dist/extension.js
  styles.css (optional)
```

Workspace plugins override global plugins with the same `id`.

Users install plugins by downloading a plugin folder and placing it into one of the plugin roots.

## 4. Manifest Role

`package.json` remains the canonical manifest.

The manifest is a bootstrap contract, not the primary behavior contract.

The manifest should keep only:

- `name`
- `displayName`
- `version`
- `main`
- `engines.scribeflow`
- `permissions`
- `configuration`
- optional minimal UI bootstrap metadata

The `permissions` field should describe only host capabilities that ScribeFlow actually enforces at runtime.
Capability ids and capability IO metadata are optional bootstrap metadata, not a required manifest surface for every plugin.

Recommended minimal UI bootstrap metadata:

- plugin settings presence
- sidebar view identity
- optional default command metadata

The manifest should not become the main place where plugin behavior is modeled.

If a capability needs complicated UI or behavior, that behavior belongs in plugin runtime code.

## 5. Runtime Model

Plugin runtime entrypoint:

- `activate(context)`
- optional `deactivate()`

Plugin runtime code is the primary place to define behavior.

Plugins should register behavior directly through runtime APIs such as:

- `context.commands.registerCommand(...)`
- `context.views.registerTreeDataProvider(...)`
- `context.views.createTreeView(...)`
- `context.window.showQuickPick(...)`
- `context.window.showInputBox(...)`
- `context.window.showInformationMessage(...)`
- `context.workspaceState`
- future `context.settings`, `context.toolbar`, `context.menus`, `context.statusBar`

Static declaration is allowed for bootstrap, discovery, permissions, and defaults.
Runtime registration is the main execution model.

## 6. Host Boundary

Rust remains runtime authority for:

- filesystem access
- workspace scope enforcement
- process spawning
- reference library mutation
- PDF and document runtime capabilities
- persistence
- plugin security and permission enforcement

The Node plugin host remains runtime execution surface for:

- plugin code loading
- `activate(context)`
- runtime API objects
- plugin event dispatch
- plugin-local state and subscriptions

Vue remains presentation layer for:

- rendering plugin-owned surfaces
- showing prompts, toasts, and plugin panels
- translating user interaction back to host events

Plugins should not need to understand Rust/Tauri internals to build normal features.

## 7. API Philosophy

ScribeFlow should expose a thick host API instead of a large static contribution schema.

The long-term top-level runtime API families should be:

- `context.commands`
- `context.window`
- `context.views`
- `context.workspace`
- `context.documents`
- `context.pdf`
- `context.references`
- `context.storage`
- `context.process`

This is the core architectural difference from the earlier VS Code-heavy direction.

## 8. UI Extension Points

The first-class UI extension points should be limited and explicit:

- command palette
- toolbar / action buttons
- document right sidebar tabs and plugin-owned views inside those tabs
- item context actions
- settings section / settings tab
- modal / prompt surfaces

Product rule:

- Settings is a plugin management surface, not the normal operational work surface
- a normal plugin should map to one document right-sidebar tab/container
- document and PDF actions should route users into that plugin-owned sidebar tab instead of into Settings

Do not model every UI surface through generic manifest contribution tables unless there is a strong need.

If a plugin needs a more custom surface later, add a dedicated runtime API rather than growing a generic static schema first.

## 9. State Model

Plugins should get two persistence scopes:

- `globalState`
- `workspaceState`

`workspaceState` is already the more important one for ScribeFlow.

Long-term plugin settings should be treated as host-managed configuration data, not ad hoc plugin file IO.

## 10. Settings Model

Plugin settings remain declared in manifest schema so the host can render a settings surface without hardcoding per-plugin UI.

But settings behavior should still be runtime-oriented:

- manifest defines the keys and defaults
- runtime reads resolved values from host APIs
- plugin logic interprets settings locally

The settings page should communicate:

- install source
- runtime entrypoint
- permissions
- available runtime capabilities
- registered commands and views
- settings schema

It should not imply that manifest contributions alone define the whole plugin.

## 11. Current Compatibility Rule

Current extension code already uses:

- commands
- tree views
- reveal
- selection events
- quick pick
- input box

These stay valid.

But future work should favor:

- runtime registration over more static `contributes.*` growth
- dedicated host APIs over larger contribution normalization layers
- plugin runtime ownership over core-app special casing

## 12. What To Avoid

Do not continue toward:

- full VS Code workbench parity as the main architecture
- contribution-schema-first feature design
- plugin behavior that depends on core app custom wiring for each plugin
- exposing raw Tauri implementation details to plugin authors

## 13. Migration Direction

The platform should evolve in this order:

1. Keep current manifest and host compatibility.
2. Reframe the platform as runtime-registration-first.
3. Move more surfaced behavior behind direct runtime APIs.
4. Reduce frontend dependence on normalized manifest contribution tables where runtime registrations can own the same responsibility.
5. Keep Rust authority unchanged.

## 14. Acceptance Standard

ScribeFlow plugin architecture is considered “correct” when:

- a new plugin can be added by dropping a folder into the plugin root
- the plugin can declare settings and permissions in manifest
- the plugin can register commands and views from `activate(context)`
- the plugin can call host APIs without modifying core product files
- core app code does not need plugin-specific UI logic for normal plugin features

That is the target standard for future refactors.
