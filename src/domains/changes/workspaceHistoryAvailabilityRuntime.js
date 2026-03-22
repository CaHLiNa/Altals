import { ensureWorkspaceHistoryRepo } from '../../services/workspaceHistoryRepo.js'
import {
  canAutoCommitWorkspace,
  enableWorkspaceAutoCommit,
} from '../../services/workspaceAutoCommit.js'

export function createWorkspaceHistoryAvailabilityRuntime({
  ensureWorkspaceHistoryRepoImpl = ensureWorkspaceHistoryRepo,
  canAutoCommitWorkspaceImpl = canAutoCommitWorkspace,
  enableWorkspaceAutoCommitImpl = enableWorkspaceAutoCommit,
} = {}) {
  async function ensureWorkspaceHistoryAvailable({
    workspacePath = '',
    options = {},
    onUnavailable,
    onAutoCommitEnabled,
  } = {}) {
    if (!workspacePath) {
      return null
    }

    const result = await ensureWorkspaceHistoryRepoImpl(workspacePath, options)
    if (!result?.ok) {
      onUnavailable?.()
      return null
    }

    let autoCommitEnabled = await canAutoCommitWorkspaceImpl(workspacePath).catch(() => false)
    if (options.enableAutoCommit && !autoCommitEnabled) {
      autoCommitEnabled = await enableWorkspaceAutoCommitImpl(workspacePath).catch(() => false)
    }
    if (autoCommitEnabled) {
      onAutoCommitEnabled?.()
    }

    return {
      ...result,
      autoCommitEnabled,
    }
  }

  return {
    ensureWorkspaceHistoryAvailable,
  }
}
