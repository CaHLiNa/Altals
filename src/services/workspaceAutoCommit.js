import { createWorkspaceAutoCommitRuntime } from '../domains/changes/workspaceAutoCommitRuntime.js'

const workspaceAutoCommitRuntime = createWorkspaceAutoCommitRuntime()

export const enableWorkspaceAutoCommit =
  workspaceAutoCommitRuntime.enableWorkspaceAutoCommit

export const canAutoCommitWorkspace =
  workspaceAutoCommitRuntime.canAutoCommitWorkspace

export const runWorkspaceAutoCommit =
  workspaceAutoCommitRuntime.runWorkspaceAutoCommit
