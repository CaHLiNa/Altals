# Operations

This doc tracks repository operations, contributor workflow, and build/release expectations that keep the desktop app and its review workflow coherent.

## Contributor workflow

### Before changing code

- read `AGENTS.md`
- for meaningful product work, start with `docs/PRODUCT.md` and `docs/ARCHITECTURE.md`
- consult `docs/DOCUMENT_WORKFLOW.md` when changing preview, compile, or editor workflow behavior
- use this document when the change touches agent workflow, release steps, validation commands, or environment-dependent operations

### Working expectations

- investigate first, then change
- update docs in the same slice when behavior or repo policy changes
- prefer deleting stale architecture over preserving dead systems
- do not let the `web/` directory drive desktop app decisions unless explicitly requested
- keep the desktop app as the primary product surface for decision-making

### Practical contribution flow

1. identify the smallest meaningful slice
2. read the relevant product, architecture, and subsystem docs
3. inspect the live code before proposing structural changes
4. implement the change without speculative expansions
5. run the minimum relevant validation command for the touched slice
6. run broader checks when the slice affects meaningful frontend or integration behavior
7. update docs when repository expectations changed

### When docs must change too

Update docs in the same slice when you change:

- product scope or boundaries
- architectural ownership or directory responsibilities
- document workflow behavior
- repository validation or release expectations
- required contributor workflow commands

## Local development operations

### Core commands

- install dependencies: `npm ci`
- run the frontend dev server: `npm run dev`
- run the desktop shell: `npm run tauri -- dev`
- build the frontend: `npm run build`
- build the Rust backend directly: `cargo build --manifest-path src-tauri/Cargo.toml`
- build the native editor helper: `cargo build --manifest-path src-tauri/Cargo.toml -p altals-native-editor-app`
- run the native editor helper protocol directly: `src-tauri/target/debug/altals-native-editor-app`
- query the current helper-backed native editor session snapshot from Tauri: call `native_editor_session_state`
- query a specific helper-backed document snapshot from Tauri: call `native_editor_document_state`
- query the helper-backed interaction context used by the active editor host: call `native_editor_inspect_interaction_context`
- query the helper-backed citation replacement plan used by the active editor host: call `native_editor_plan_citation_replacement`

### Typical local flow

1. install dependencies
2. open or rebuild the desktop shell with `npm run tauri -- dev`
3. make the smallest relevant code change
4. run targeted tests for the touched slice
5. run broader checks such as `npm run build` when the slice affects meaningful frontend or integration behavior

For native editor work, prefer helper-backed slices that keep the active workbench surface coherent:

- move buffer, selection, viewport, and transaction mechanics into `altals-editor-core`
- keep helper session state ownership in `src-tauri/src/native_editor_runtime.rs`
- keep save-time document materialization aligned with `native_editor_document_state`
- keep interaction analysis and text replacement planning aligned with Rust-backed inspection commands
- avoid reintroducing legacy Web-editor fallbacks, user-visible experimental settings, or placeholder editor panes

## Build and packaging system

### Public script entry points

The root `package.json` currently exposes these main build-related scripts:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run tauri -- dev`
- `npm run tauri -- build`
- `npm run build:macos:app`
- `npm run build:macos:dmg`
- `npm run version:check`
- `npm run version:bump:*`

### Tooling entry points

- `package.json` defines public scripts
- `scripts/frontendBaselineTooling.mjs` owns the frontend lint/format baseline
- `scripts/run-tauri.mjs` is the main Tauri entry
- `scripts/version-utils.mjs` and `scripts/bump-version.mjs` manage version checks and bumps
- `scripts/build-macos-dmg.mjs` builds the helper DMG
- `.github/workflows/release-on-version-bump.yml` handles version-bump-to-tag flow
- `.github/workflows/release.yml` builds and publishes release artifacts from tags or manual dispatch

### Build layers

- Vite builds the frontend bundles used by the desktop app
- Tauri packages the desktop shell around the frontend build output
- the Rust backend under `src-tauri/` provides the native integration layer

## Environment-dependent operations

Some operations depend on local tools being present.

- LaTeX compile readiness is checked through `ensureLatexCompileReady()` in `src/services/environmentPreflight.js`

When these tools are missing, the app surfaces settings-oriented recovery actions instead of failing silently.

## AI review workflow

The repo has explicit AI review commands implemented in `scripts/agentReviewWorkflow.mjs`.

### Commands

- enable the Codex review gate: `npm run agent:enable-codex-gate`
- run a Codex review: `npm run agent:codex-review`
- run the Claude plan audit: `npm run agent:claude-plan-audit -- --plan <path>`

### Current intent

- keep the Codex stop-time review gate enabled for Claude-authored code work
- use Codex review before sign-off on code changes
- use the Claude postflight audit to compare implementation against an explicit plan when that workflow is in play

## Release operations

Release automation lives in:

- `.github/workflows/release-on-version-bump.yml`
- `.github/workflows/release.yml`

Current release flow:

- pushing a version bump commit to the default branch can auto-create the matching `v*` tag
- the version bump workflow explicitly dispatches the release workflow after pushing the tag, so release builds do not depend on GitHub re-triggering workflows from bot-created tag pushes
- no release is triggered when the version files did not change, when the version matches the latest tag, or when the tag already exists
- pushing a `v*` tag builds and publishes the actual release artifacts
- `Altals Release` also supports manual `workflow_dispatch` runs with a tag input as a fallback when a specific tag needs to be rebuilt
- build and publish release artifacts for macOS, Linux, and Windows
- the Windows release job currently builds the NSIS installer path instead of the full default bundle set on hosted runners
- generate and upload a helper DMG for macOS builds

## Operational focus

- keep the desktop app as the source of truth
- keep agent and release workflows documented in the repo, not only in local habits
- prefer explicit automation over undocumented manual steps
- keep environment requirements visible when they block user-facing workflows

## See also

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
