import { invoke } from '@tauri-apps/api/core'

import { gitLog, gitShow } from '../../services/git.js'

export function createWorkspaceVersionHistoryRuntime({
  gitLogImpl = gitLog,
  gitShowImpl = gitShow,
  writeFileImpl = async (path, content) => invoke('write_file', { path, content }),
} = {}) {
  async function loadWorkspaceHistory({
    workspacePath = '',
    limit = 50,
  } = {}) {
    if (!workspacePath) {
      return []
    }

    return gitLogImpl(workspacePath, null, limit)
  }

  async function loadFileHistory({
    workspacePath = '',
    filePath = '',
    limit = 50,
  } = {}) {
    if (!workspacePath || !filePath) {
      return []
    }

    return gitLogImpl(workspacePath, filePath, limit)
  }

  async function loadFileHistoryPreview({
    workspacePath = '',
    filePath = '',
    commitHash = '',
  } = {}) {
    if (!workspacePath || !filePath || !commitHash) {
      return ''
    }

    return gitShowImpl(workspacePath, commitHash, filePath)
  }

  async function restoreFileHistoryEntry({
    workspacePath = '',
    filePath = '',
    commitHash = '',
    reloadFileImpl,
  } = {}) {
    if (!workspacePath || !filePath || !commitHash) {
      return { restored: false, reason: 'missing-input' }
    }

    const content = await loadFileHistoryPreview({
      workspacePath,
      filePath,
      commitHash,
    })
    await writeFileImpl(filePath, content)
    await reloadFileImpl?.(filePath)

    return {
      restored: true,
      content,
    }
  }

  return {
    loadWorkspaceHistory,
    loadFileHistory,
    loadFileHistoryPreview,
    restoreFileHistoryEntry,
  }
}
