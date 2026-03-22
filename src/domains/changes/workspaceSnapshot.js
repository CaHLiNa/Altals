import { createWorkspaceHistoryAvailabilityRuntime } from './workspaceHistoryAvailabilityRuntime.js'
import { createWorkspaceHistoryPointRuntime } from './workspaceHistoryPointRuntime.js'
import { createWorkspaceLocalSnapshotStoreRuntime } from './workspaceLocalSnapshotStoreRuntime.js'
import {
  attachWorkspaceSnapshotMetadata,
  attachWorkspaceSnapshotMetadataList,
  createWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotTitle,
} from './workspaceSnapshotMetadataRuntime.js'
import {
  createWorkspaceSnapshotRuntime,
  createWorkspaceSnapshotRecord,
  getWorkspaceSnapshotDisplayMessage,
  isNamedWorkspaceSnapshot,
} from './workspaceSnapshotRuntime.js'

export function createWorkspaceSnapshotOperations({
  availabilityRuntime = createWorkspaceHistoryAvailabilityRuntime(),
  historyPointRuntime = createWorkspaceHistoryPointRuntime({
    availabilityRuntime,
  }),
  snapshotRuntime = createWorkspaceSnapshotRuntime(),
  localSnapshotStoreRuntime = createWorkspaceLocalSnapshotStoreRuntime(),
  attachSnapshotMetadataImpl = attachWorkspaceSnapshotMetadata,
  attachSnapshotMetadataListImpl = attachWorkspaceSnapshotMetadataList,
  logErrorImpl = (...args) => console.error(...args),
} = {}) {
  async function createWorkspaceSnapshot({
    workspace,
    filesStore,
    editorStore,
    preferredSnapshotLabel = '',
    requestSnapshotLabel,
    showNoChanges,
    showCommitFailure,
    onUnavailable,
    onAutoCommitEnabled,
    t,
  } = {}) {
    if (!workspace?.path) {
      return null
    }

    try {
      const result = await historyPointRuntime.createHistoryPoint({
        workspace,
        filesStore,
        editorStore,
        preferredHistoryLabel: preferredSnapshotLabel,
        requestHistoryLabel: requestSnapshotLabel,
        showNoChanges,
        onUnavailable,
        onAutoCommitEnabled,
        t,
      })

      if (!result?.snapshot) {
        return result
      }

      const gitSnapshot = attachSnapshotMetadataImpl(result.snapshot)
      const localSnapshotRecord = await localSnapshotStoreRuntime.recordWorkspaceSavePoint({
        workspaceDataDir: workspace?.workspaceDataDir || '',
        snapshot: result.snapshot,
      })
      const localSnapshot = attachSnapshotMetadataImpl(localSnapshotRecord)
      const snapshot = localSnapshot || gitSnapshot
      return {
        ...result,
        gitSnapshot,
        localSnapshot,
        snapshot,
        snapshotMetadata: snapshot?.metadata ?? null,
      }
    } catch (error) {
      logErrorImpl('Create snapshot error:', error)
      showCommitFailure?.(error)
      return null
    }
  }

  async function openFileVersionHistoryBrowser({
    workspace,
    filePath = '',
    onUnavailable,
    onAutoCommitEnabled,
    onReady,
    options = {},
  } = {}) {
    const workspacePath = workspace?.path || ''
    if (!workspacePath || !filePath) {
      return null
    }

    const historyAvailability = await availabilityRuntime.ensureWorkspaceHistoryAvailable({
      workspacePath,
      options,
      onUnavailable,
      onAutoCommitEnabled,
    })
    if (!historyAvailability) {
      return null
    }

    onReady?.(filePath)
    return {
      historyAvailability,
      filePath,
    }
  }

  async function listFileVersionHistory({
    workspacePath = '',
    filePath = '',
    limit = 50,
    t,
  } = {}) {
    if (!workspacePath || !filePath) {
      return []
    }

    const snapshots = await snapshotRuntime.listFileVersionHistoryEntries({
      workspacePath,
      filePath,
      limit,
      t,
    })
    return attachSnapshotMetadataListImpl(snapshots)
  }

  async function listWorkspaceSavePoints({
    workspacePath = '',
    workspaceDataDir = '',
    limit = 50,
    t,
  } = {}) {
    if (!workspacePath) {
      return []
    }

    const snapshots = await snapshotRuntime.listWorkspaceSavePointEntries({
      workspacePath,
      workspaceDataDir,
      limit,
      t,
    })
    return attachSnapshotMetadataListImpl(snapshots)
  }

  async function loadFileVersionHistoryPreview(input = {}) {
    return snapshotRuntime.loadFileVersionHistoryPreview(input)
  }

  async function restoreFileVersionHistoryEntry(input = {}) {
    return snapshotRuntime.restoreFileVersionHistoryEntry(input)
  }

  return {
    createWorkspaceSnapshot,
    openFileVersionHistoryBrowser,
    listFileVersionHistory,
    listWorkspaceSavePoints,
    loadFileVersionHistoryPreview,
    restoreFileVersionHistoryEntry,
  }
}

const workspaceSnapshotOperations = createWorkspaceSnapshotOperations()

export const createWorkspaceSnapshot = workspaceSnapshotOperations.createWorkspaceSnapshot
export const openFileVersionHistoryBrowser = workspaceSnapshotOperations.openFileVersionHistoryBrowser
export const listFileVersionHistory = workspaceSnapshotOperations.listFileVersionHistory
export const listWorkspaceSavePoints = workspaceSnapshotOperations.listWorkspaceSavePoints
export const loadFileVersionHistoryPreview = workspaceSnapshotOperations.loadFileVersionHistoryPreview
export const restoreFileVersionHistoryEntry = workspaceSnapshotOperations.restoreFileVersionHistoryEntry

export {
  attachWorkspaceSnapshotMetadata,
  attachWorkspaceSnapshotMetadataList,
  createWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotMetadata,
  createWorkspaceSnapshotRecord,
  getWorkspaceSnapshotDisplayMessage,
  getWorkspaceSnapshotTitle,
  isNamedWorkspaceSnapshot,
}
