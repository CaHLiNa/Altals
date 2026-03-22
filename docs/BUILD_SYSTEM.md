# Build System

## Purpose

This document records the current build and packaging system used by Altals.

It describes the current repository truthfully.

## Current Stack

The application currently builds with:

- Vue 3
- Pinia
- Vite
- Tailwind CSS + PostCSS
- Tauri 2
- Rust backend code under `src-tauri/`

## Frontend Build

The main frontend build command is:

```bash
npm run build
```

This runs `vite build`.

Current frontend build configuration lives in:

- `package.json`
- `vite.config.js`
- `tailwind.config.js`
- `postcss.config.js`

### Chunking

`vite.config.js` currently defines manual chunk groups for major dependency families, including:

- Vue
- AI SDKs
- CodeMirror
- ProseMirror/Tiptap
- PDF.js
- Markdown/KaTeX
- citations
- xterm
- Handsontable

This reduces some bundle pressure, but build output still reports large chunk warnings today.

## Desktop Build

Tauri configuration lives in:

- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

Important current build wiring:

- Tauri reads frontend assets from `../dist`
- `beforeDevCommand` runs `npm run dev`
- `beforeBuildCommand` runs `npm run build`

Main desktop command:

```bash
npm run tauri
```

## macOS Packaging

Current repository scripts include:

- `npm run build:macos:app`
- `npm run build:macos:dmg`

The helper DMG flow is implemented by:

- `scripts/build-macos-dmg.mjs`

## Release Automation

The repository currently has a release workflow:

- `.github/workflows/release.yml`

Current release facts:

- it is triggered manually with `workflow_dispatch`
- it validates version/tag consistency
- it builds release artifacts for macOS, Linux, and Windows
- it publishes through `tauri-apps/tauri-action`

This is a release pipeline, not a fast day-to-day validation loop for refactor work.

## Current Validation Reality

For normal refactor work, the practical validation commands are still:

```bash
node --test tests/*.test.mjs
npm run build
```

There is currently no dedicated `lint` or `typecheck` script in `package.json`.

## Current Known Warnings And Gaps

- Vite still reports dynamic-import overlap warnings for some modules.
- Vite still reports chunk-size warnings for some bundles.
- The backend build is real, but the backend architecture is still flat and not yet split into command/core/service layers.
- Frontend validation is stronger than before, but it still depends mainly on Node runtime tests plus the Vite build rather than a broader CI matrix for every refactor slice.
