import { createWorkspaceLocalSnapshotStoreRuntime } from './workspaceLocalSnapshotStoreRuntime.js'
import { createWorkspaceHistoryVisibilityRuntime } from './workspaceHistoryVisibilityRuntime.js'

export function isNamedWorkspaceSnapshot(snapshot = null) {
  return String(snapshot?.kind || '') === 'named'
}

export function isFileWorkspaceSnapshot(snapshot = null) {
  return String(snapshot?.scope || '').trim() === 'file'
}

export function getWorkspaceSnapshotDisplayMessage(snapshot = null) {
  return String(snapshot?.message || '').trim()
}

export function createWorkspaceSnapshotRuntime({
  localSnapshotStoreRuntime = createWorkspaceLocalSnapshotStoreRuntime(),
  historyVisibilityRuntime = createWorkspaceHistoryVisibilityRuntime(),
} = {}) {
  async function listWorkspaceSavePointEntries({
    workspacePath = '',
    workspaceDataDir = '',
    limit = 50,
  } = {}) {
    if (!workspacePath) {
      return []
    }

    const snapshots = await localSnapshotStoreRuntime.loadWorkspaceSavePointEntries({
      workspaceDataDir,
    })
    const visibleSnapshots = await historyVisibilityRuntime.filterVisibleEntries({
      workspaceDataDir,
      snapshots,
    })

    if (!Number.isInteger(limit) || limit <= 0) {
      return visibleSnapshots
    }

    return visibleSnapshots.slice(0, limit)
  }

  return {
    listWorkspaceSavePointEntries,
  }
}
