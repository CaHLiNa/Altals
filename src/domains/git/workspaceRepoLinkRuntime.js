import { ensureWorkspaceHistoryRepo } from '../../services/workspaceHistoryRepo.js'
import {
  enableWorkspaceAutoCommit,
  runWorkspaceAutoCommit,
} from '../../services/workspaceAutoCommit.js'

export function createWorkspaceRepoLinkRuntime({
  ensureWorkspaceHistoryRepoImpl = ensureWorkspaceHistoryRepo,
  enableWorkspaceAutoCommitImpl = enableWorkspaceAutoCommit,
  runWorkspaceAutoCommitImpl = runWorkspaceAutoCommit,
} = {}) {
  async function linkWorkspaceRepo({
    path = '',
    cloneUrl = '',
    setupRemoteImpl,
    ensureGitignoreImpl,
    historyOptions = {},
  } = {}) {
    if (!path) {
      return null
    }

    const historyRepo = await ensureWorkspaceHistoryRepoImpl(path, {
      seedInitialCommit: true,
      seedMessage: 'Initial history',
      ...historyOptions,
    })
    if (!historyRepo?.ok) {
      throw new Error('Failed to initialize a local Git repository for this workspace.')
    }

    const autoCommitEnabled = await enableWorkspaceAutoCommitImpl(path).catch(() => false)

    await setupRemoteImpl?.(path, cloneUrl)
    await ensureGitignoreImpl?.(path)
    await runWorkspaceAutoCommitImpl(path).catch(() => {})

    return {
      remoteUrl: cloneUrl,
      syncStatus: 'idle',
      historyRepo: {
        ...historyRepo,
        autoCommitEnabled,
      },
    }
  }

  return {
    linkWorkspaceRepo,
  }
}
