# Git And Snapshots

## Purpose

This document records the current safety model in Altals and the gaps that still remain between:

1. autosave
2. local snapshot
3. Git commit
4. remote sync

The current implementation does not fully separate these concepts yet. This file exists to describe the real current state and the target direction.

## Current Truth

Altals now has a first explicit history-repo boundary, but it does not yet have a first-class local snapshot system separate from Git.

Today:

- autosave exists as normal file/editor persistence behavior
- named “snapshots” still map to Git commits
- explicit workspace save points now stamp a small manifest trailer into the Git-backed history subject
- Git history is the current recovery/history backend
- remote sync is layered on top of the same Git repository

This means the four concepts are still only partially separated.

## Current Components

### History Repo Bootstrap

`src/services/workspaceHistoryRepo.js` is the first concrete Phase 4 boundary.

It is responsible for:

- rejecting invalid targets such as the home directory
- initializing a workspace-local Git repository when needed
- optionally seeding an initial commit

It is intentionally separate from auto-commit execution.

### Auto-Commit

`src/services/workspaceAutoCommit.js` currently owns:

- auto-commit marker lookup and enablement
- workspace eligibility guard checks
- Git add/status/commit execution for timed auto-commit

That service is now a thin shell over `src/domains/changes/workspaceAutoCommitRuntime.js`, which owns the actual marker gating, shared auto-history message construction, and timed commit orchestration.

This is still Git-centric safety behavior, not an app-level snapshot system.

### Explicit Save + Commit

`src/domains/changes/workspaceSnapshot.js` now exposes `createWorkspaceSnapshot`, which is the explicit save-point path used by the UI.

Current flow:

1. ensure the history repo exists
2. optionally enable auto-commit
3. persist dirty editors and in-memory file contents
4. resolve the explicit history message / fallback label
5. append a Git-backed snapshot manifest trailer for explicit workspace save points
6. `git add`
7. `git status`
8. create an explicit commit

This is useful, but it means explicit save history is still coupled to Git commit behavior.

The public snapshot boundary now composes these lower seams:

- `src/domains/changes/workspaceHistoryAvailabilityRuntime.js`
- `src/domains/changes/workspaceSnapshot.js`
- `src/domains/changes/workspaceHistoryPointRuntime.js`
- `src/domains/changes/workspaceHistoryPreparationRuntime.js`
- `src/domains/changes/workspaceHistoryCommitRuntime.js`
- `src/domains/changes/workspaceSnapshotManifestRuntime.js`

### Named Snapshot UI

The current snapshot UI is not a separate snapshot backend.

`src/components/layout/Footer.vue` and `src/components/layout/SnapshotDialog.vue` currently collect an optional name for the explicit save-point action, and that name still becomes the Git commit message used by `createWorkspaceSnapshot`.

`src/domains/changes/workspaceHistoryMessageRuntime.js` now centralizes the current message-generation and message-classification rules so history UI no longer depends on hard-coded English `Save:` prefix checks.

`src/domains/changes/workspaceHistoryPointRuntime.js` now makes the app-level history-point intent explicit before the Git commit layer runs.

`src/domains/changes/workspaceSnapshotRuntime.js` and `src/domains/changes/workspaceSnapshot.js` now provide the first explicit Git-backed snapshot object and operation boundary above those history runtimes.

`src/domains/changes/workspaceSnapshotMetadataRuntime.js` now attaches explicit title/named/capability metadata above those records.

`src/domains/changes/workspaceSnapshotManifestRuntime.js` now persists and parses a minimal manifest trailer so explicit workspace save points keep `scope` / `kind` metadata even when they later show up inside file-scoped Git history.

`src/app/changes/snapshotLabelPromptRuntime.js` plus `src/app/changes/useSnapshotLabelPrompt.js` now isolate the Footer prompt timer, dialog visibility, and pending label resolution from the rest of the Footer status UI.

User-facing wording is now more honest than before:

- the Footer prompt still offers to name the saved version
- the dialog title now uses version-history wording instead of “Create Snapshot”
- initial seed history labels now use `Initial history` rather than `Initial snapshot`

So, in current Altals terminology:

- naming a saved version in the footer is functionally creating a named Git-backed snapshot that is still stored as a Git commit

That is a key current-state limitation, not just a wording issue.

### Version History

`src/components/VersionHistory.vue` is backed by Git history:

- list entries via `git log`
- preview entries via `git show`
- restore from Git history

The Git IO behind that UI now lives in `src/domains/changes/workspaceVersionHistoryRuntime.js`, and the component now consumes file-scoped snapshot objects through `src/domains/changes/workspaceSnapshot.js` instead of raw Git entries.

The app-facing file-history entry points are now explicit:

- `openFileVersionHistoryBrowser({ workspace, filePath, ... })`
- `listFileVersionHistory({ workspacePath, filePath })`
- `loadFileVersionHistoryPreview(...)`
- `restoreFileVersionHistoryEntry(...)`

### Workspace Save Points

`src/components/WorkspaceSnapshotBrowser.vue` is now the dedicated user-facing browser for repo-wide workspace save points.

Its current app-facing feed entry point is:

- `listWorkspaceSavePoints({ workspacePath })`

Its lower runtime entry point is now also explicit:

- `listWorkspaceSavePointEntries({ workspacePath })`

That feed still lists Git-backed milestones rather than a separate local snapshot backend, and it still does not support workspace-level preview/restore.

### Remote Link Preparation

Remote-link preparation is now split more explicitly.

`src/domains/git/workspaceRepoLinkRuntime.js` owns:

- local history repo bootstrap before remote binding
- optional auto-commit enablement before the remote is configured
- remote setup / gitignore ordering
- initial local auto-commit swallow-on-failure behavior

`src/services/workspaceGitHub.js` now delegates that sequence instead of inlining it.

### Remote Sync

Remote sync currently lives in:

- `src/services/workspaceGitHub.js`
- `src/domains/workspace/workspaceAutomationRuntime.js`

Current behavior:

- auto-commit may trigger auto-sync
- fetch/pull cycles can reload open files after remote updates
- linking a remote can initialize history, enable auto-commit, and perform an initial auto-commit

So remote sync is still coupled to the same Git-backed local safety path.

## Separation Status

### Autosave

Current state:

- partially separate
- implemented through document/file persistence paths
- not presented as user history

This is the closest concept to being separate already.

### Local Snapshot

Current state:

- now has a first explicit Git-backed snapshot object and operation boundary
- snapshot scope is explicit: workspace-level save points vs file-level version-history entries
- explicit workspace save points now also persist a small manifest trailer in Git-backed history subjects
- backend behavior still resolves to Git commit creation
- no separate local snapshot store exists yet
- no dedicated UI/browser exists yet for the repo-wide workspace snapshot feed

This is the largest remaining safety-model gap.

### Git Commit

Current state:

- explicit save+commit exists
- timed auto-commit exists behind enablement markers
- version history and named safety points still rely on Git commits

Git is still carrying too much safety responsibility.

### Remote Sync

Current state:

- explicit GitHub/runtime layer exists
- sync timers are runtime-managed
- still depends on the same Git repository and history flows

Remote sync is more explicit than before, but it is not yet independent from local safety concepts.

## Current Risks

The main current risks are:

- the app still lacks a true local snapshot backend
- the repo-wide workspace snapshot feed exists only as an operation seam, not a user-facing browser
- explicit save history and auto-commit still both feed Git history directly
- remote link/setup can also influence local history behavior
- users and maintainers can still misread Git history as the whole safety model
- manifest metadata is still encoded inside Git-backed history subjects rather than stored in a separate app-level snapshot store

## Target Direction

The repository target remains:

- autosave for frequent local persistence
- local snapshots as app-level restore points
- Git commits as explicit history/milestone actions
- remote sync as visible networked state synchronization

That target has not landed yet.

## Next Safety Slice

The next Phase 4 slice is no longer choosing whether to start with a Git-backed wrapper. That wrapper path has already landed.

The remaining high-value gap is choosing and wiring the user-facing surface for the repo-wide workspace snapshot feed. The recommended next step is:

1. decide whether that feed reuses `VersionHistory.vue` or becomes a separate workspace-snapshot browser
2. preserve the new `workspace` vs `file` scope distinction instead of collapsing save points back into file history
3. keep Git history as an implementation detail rather than the whole visible safety model
