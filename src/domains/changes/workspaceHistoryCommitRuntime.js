import { gitAdd, gitCommit, gitLog, gitStatus } from '../../services/git.js'
import {
  buildWorkspaceHistorySaveMessage,
  formatWorkspaceHistoryTimestamp,
} from './workspaceHistoryMessageRuntime.js'

export const formatWorkspaceHistoryCommitTimestamp = formatWorkspaceHistoryTimestamp
export const buildDefaultWorkspaceHistoryCommitMessage = buildWorkspaceHistorySaveMessage

export function createWorkspaceHistoryCommitRuntime({
  gitAddImpl = gitAdd,
  gitCommitImpl = gitCommit,
  gitLogImpl = gitLog,
  gitStatusImpl = gitStatus,
  nowImpl = () => new Date(),
} = {}) {
  async function resolveCommitMessage({
    preferredCommitMessage = '',
    requestCommitMessage,
    fallbackCommitMessage = '',
    t,
  } = {}) {
    const preferred = String(preferredCommitMessage || '').trim()
    if (preferred) return preferred

    const requested = String(await requestCommitMessage?.() || '').trim()
    if (requested) return requested

    const fallback = String(fallbackCommitMessage || '').trim()
    if (fallback) return fallback

    return buildDefaultWorkspaceHistoryCommitMessage({
      t,
      now: nowImpl(),
    })
  }

  async function commitPreparedWorkspaceHistory({
    workspacePath = '',
    preferredCommitMessage = '',
    requestCommitMessage,
    fallbackCommitMessage = '',
    t,
  } = {}) {
    if (!workspacePath) {
      return { committed: false, reason: 'missing-workspace' }
    }

    await gitAddImpl(workspacePath)
    const status = await gitStatusImpl(workspacePath)
    if (!status || !status.trim()) {
      return { committed: false, reason: 'no-changes' }
    }

    const commitMessage = await resolveCommitMessage({
      preferredCommitMessage,
      requestCommitMessage,
      fallbackCommitMessage,
      t,
    })

    try {
      await gitCommitImpl(workspacePath, commitMessage)
    } catch (error) {
      if (String(error || '').includes('nothing to commit')) {
        return { committed: false, reason: 'no-changes' }
      }
      throw error
    }

    const latestHistory = await gitLogImpl(workspacePath, null, 1).catch(() => [])
    const historyEntry = Array.isArray(latestHistory) ? (latestHistory[0] || null) : null

    return {
      committed: true,
      reason: 'committed',
      commitMessage,
      historyEntry,
    }
  }

  return {
    resolveCommitMessage,
    commitPreparedWorkspaceHistory,
  }
}
