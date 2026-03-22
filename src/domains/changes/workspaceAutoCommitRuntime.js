import { invoke } from '@tauri-apps/api/core'

import { gitAdd, gitCommit, gitStatus } from '../../services/git.js'
import { pathExists } from '../../services/pathExists.js'
import { getHomeDirCached, normalizePathValue } from '../../services/workspacePaths.js'
import {
  buildWorkspaceHistoryAutoMessage,
  formatWorkspaceHistoryTimestamp,
} from './workspaceHistoryMessageRuntime.js'

const AUTO_COMMIT_MARKER = 'altals-auto-commit-enabled'

export function createWorkspaceAutoCommitRuntime({
  pathExistsImpl = pathExists,
  getHomeDirCachedImpl = getHomeDirCached,
  normalizePathValueImpl = normalizePathValue,
  writeFileImpl = async (path, content) => invoke('write_file', { path, content }),
  gitAddImpl = gitAdd,
  gitStatusImpl = gitStatus,
  gitCommitImpl = gitCommit,
  buildAutoMessageImpl = buildWorkspaceHistoryAutoMessage,
  formatTimestampImpl = formatWorkspaceHistoryTimestamp,
} = {}) {
  function autoCommitMarkerPath(path = '') {
    const normalizedPath = normalizePathValueImpl(path)
    if (!normalizedPath || normalizedPath === '/') {
      return ''
    }
    return `${normalizedPath}/.git/${AUTO_COMMIT_MARKER}`
  }

  async function enableWorkspaceAutoCommit(path = '') {
    const normalizedPath = normalizePathValueImpl(path)
    const markerPath = autoCommitMarkerPath(normalizedPath)
    if (!markerPath) {
      return false
    }

    const repoPath = `${normalizedPath}/.git`
    if (!(await pathExistsImpl(repoPath))) {
      return false
    }

    await writeFileImpl(markerPath, '1\n')
    return true
  }

  async function canAutoCommitWorkspace(path = '') {
    if (!path) {
      return false
    }

    const normalizedPath = normalizePathValueImpl(path)
    const normalizedHome = await getHomeDirCachedImpl()
    if (normalizedHome && normalizedPath === normalizedHome) {
      return false
    }

    return pathExistsImpl(autoCommitMarkerPath(normalizedPath))
  }

  async function runWorkspaceAutoCommit(path = '') {
    const normalizedPath = normalizePathValueImpl(path)
    if (!(await canAutoCommitWorkspace(normalizedPath))) {
      return { committed: false }
    }

    await gitAddImpl(normalizedPath)
    const status = await gitStatusImpl(normalizedPath)
    if (!String(status || '').trim()) {
      return { committed: false }
    }

    const now = new Date()
    const timestamp = formatTimestampImpl(now)
    const message = buildAutoMessageImpl({ now })

    await gitCommitImpl(normalizedPath, message)
    return {
      committed: true,
      timestamp,
    }
  }

  return {
    autoCommitMarkerPath,
    enableWorkspaceAutoCommit,
    canAutoCommitWorkspace,
    runWorkspaceAutoCommit,
  }
}
