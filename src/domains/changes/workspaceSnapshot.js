import { createWorkspaceHistoryVisibilityRuntime } from './workspaceHistoryVisibilityRuntime.js'
import {
  createWorkspaceLocalSnapshotPayloadRuntime,
  getWorkspaceSnapshotPayloadCaptureScope,
  getWorkspaceSnapshotPayloadSkippedCount,
  isLoadedWorkspaceTextPayload,
  isProjectTextSetPayload,
} from './workspaceLocalSnapshotPayloadRuntime.js'
import { createWorkspaceLocalSnapshotStoreRuntime } from './workspaceLocalSnapshotStoreRuntime.js'
import { createWorkspaceSnapshotDeletionRuntime } from './workspaceSnapshotDeletionRuntime.js'
import { createWorkspaceSnapshotDiffRuntime } from './workspaceSnapshotDiffRuntime.js'
import { createWorkspaceSnapshotFileApplyRuntime } from './workspaceSnapshotFileApplyRuntime.js'
import {
  buildWorkspaceSnapshotPersistedMessage,
  createWorkspaceSnapshotManifest,
} from './workspaceSnapshotManifestRuntime.js'
import { createWorkspaceSnapshotPreviewRuntime } from './workspaceSnapshotPreviewRuntime.js'
import { buildWorkspaceHistorySaveMessage } from './workspaceHistoryMessageRuntime.js'
import { createWorkspaceHistoryPreparationRuntime } from './workspaceHistoryPreparationRuntime.js'
import {
  attachWorkspaceSnapshotMetadata,
  attachWorkspaceSnapshotMetadataList,
  createWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotTitle,
} from './workspaceSnapshotMetadataRuntime.js'
import {
  createWorkspaceSnapshotRuntime,
  getWorkspaceSnapshotDisplayMessage,
  isNamedWorkspaceSnapshot,
} from './workspaceSnapshotRuntime.js'

export function createWorkspaceSnapshotOperations({
  snapshotRuntime = createWorkspaceSnapshotRuntime(),
  previewRuntime = createWorkspaceSnapshotPreviewRuntime(),
  deletionRuntime = createWorkspaceSnapshotDeletionRuntime(),
  diffRuntime = createWorkspaceSnapshotDiffRuntime(),
  fileApplyRuntime = createWorkspaceSnapshotFileApplyRuntime(),
  localSnapshotPayloadRuntime = createWorkspaceLocalSnapshotPayloadRuntime(),
  localSnapshotStoreRuntime = createWorkspaceLocalSnapshotStoreRuntime(),
  historyPreparationRuntime = createWorkspaceHistoryPreparationRuntime(),
  historyVisibilityRuntime = createWorkspaceHistoryVisibilityRuntime(),
  attachSnapshotMetadataImpl = attachWorkspaceSnapshotMetadata,
  attachSnapshotMetadataListImpl = attachWorkspaceSnapshotMetadataList,
  buildSaveMessageImpl = buildWorkspaceHistorySaveMessage,
  buildPersistedMessageImpl = buildWorkspaceSnapshotPersistedMessage,
  createSnapshotManifestImpl = createWorkspaceSnapshotManifest,
  logErrorImpl = (...args) => console.error(...args),
  nowImpl = () => new Date(),
} = {}) {
  function normalizeSnapshotLabel(value = '') {
    return String(value || '').trim()
  }

  async function resolveWorkspaceSavePointIntent({
    preferredSnapshotLabel = '',
    requestSnapshotLabel,
    t,
  } = {}) {
    const preferredLabel = normalizeSnapshotLabel(preferredSnapshotLabel)
    if (preferredLabel) {
      return {
        kind: 'named',
        label: preferredLabel,
        message: preferredLabel,
      }
    }

    const requestedLabel = normalizeSnapshotLabel(await requestSnapshotLabel?.())
    if (requestedLabel) {
      return {
        kind: 'named',
        label: requestedLabel,
        message: requestedLabel,
      }
    }

    return {
      kind: 'save',
      label: '',
      message: buildSaveMessageImpl({ t, now: nowImpl() }),
    }
  }

  async function createLocalWorkspaceSavePoint({
    workspace,
    filesStore,
    editorStore,
    savePointIntent = null,
  } = {}) {
    if (!workspace?.path || !workspace?.workspaceDataDir || !savePointIntent?.message) {
      return null
    }

    const kind = String(savePointIntent.kind || '').trim() || 'save'
    const label = String(savePointIntent.label || '').trim()
    const createdAt = nowImpl().toISOString()
    const syntheticSnapshot = {
      backend: 'local',
      sourceKind: 'workspace-save-point',
      sourceId: '',
      scope: 'workspace',
      filePath: '',
      kind,
      label,
      message: savePointIntent.message,
      rawMessage: buildPersistedMessageImpl({
        message: savePointIntent.message,
        scope: 'workspace',
        kind,
      }),
      createdAt,
      manifest: createSnapshotManifestImpl({
        scope: 'workspace',
        kind,
      }),
    }

    const payload = await localSnapshotPayloadRuntime
      .captureWorkspaceSnapshotPayload({
        workspacePath: workspace.path,
        workspaceDataDir: workspace.workspaceDataDir,
        snapshot: syntheticSnapshot,
        editorStore,
        filesStore,
      })
      .catch((error) => {
        logErrorImpl('Capture snapshot payload error:', error)
        return null
      })

    return await localSnapshotStoreRuntime.recordWorkspaceSavePoint({
      workspaceDataDir: workspace.workspaceDataDir,
      snapshot: {
        ...syntheticSnapshot,
        payload,
      },
    })
  }

  async function createWorkspaceSnapshot({
    workspace,
    filesStore,
    editorStore,
    preferredSnapshotLabel = '',
    requestSnapshotLabel,
    allowLocalSavePointWhenUnchanged = true,
    showNoChanges = null,
    showSaveFailure,
    t,
  } = {}) {
    if (!workspace?.path) {
      return null
    }

    try {
      const preparedFiles = await historyPreparationRuntime.prepareWorkspaceHistoryFiles({
        filesStore,
        editorStore,
      })
      if (!preparedFiles?.ok) {
        return {
          committed: false,
          reason: preparedFiles?.reason || 'prepare-failed',
        }
      }

      const savePointIntent = await resolveWorkspaceSavePointIntent({
        preferredSnapshotLabel,
        requestSnapshotLabel,
        t,
      })

      const localSnapshotRecord = await createLocalWorkspaceSavePoint({
        workspace,
        filesStore,
        editorStore,
        savePointIntent,
      })
      if (!localSnapshotRecord) {
        if (!allowLocalSavePointWhenUnchanged) {
          showNoChanges?.()
          return {
            committed: false,
            reason: 'no-changes',
          }
        }
        return null
      }

      const localSnapshot = attachSnapshotMetadataImpl(localSnapshotRecord)
      return {
        committed: true,
        reason: 'created-save-point',
        localSnapshot,
        snapshot: localSnapshot,
        snapshotMetadata: localSnapshot.metadata ?? null,
      }
    } catch (error) {
      logErrorImpl('Create snapshot error:', error)
      showSaveFailure?.(error)
      return null
    }
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

  async function deleteWorkspaceSavePoint({ workspace, snapshot = null } = {}) {
    if (!workspace?.workspaceDataDir || !snapshot) {
      return { deleted: false, reason: 'missing-input' }
    }
    if (String(snapshot?.scope || '').trim() !== 'workspace') {
      return { deleted: false, reason: 'unsupported-scope' }
    }

    const [removedLocalEntry, hiddenEntry] = await Promise.all([
      typeof localSnapshotStoreRuntime.removeWorkspaceSavePoint === 'function'
        ? localSnapshotStoreRuntime
            .removeWorkspaceSavePoint({
              workspaceDataDir: workspace.workspaceDataDir,
              snapshot,
            })
            .catch(() => false)
        : Promise.resolve(false),
      historyVisibilityRuntime
        .hideHistoryEntry({
          workspaceDataDir: workspace.workspaceDataDir,
          snapshot,
        })
        .catch(() => null),
    ])

    return {
      deleted: !!(removedLocalEntry || hiddenEntry),
      removedLocalEntry: !!removedLocalEntry,
      hiddenEntry: !!hiddenEntry,
      reason: removedLocalEntry || hiddenEntry ? '' : 'delete-failed',
    }
  }

  async function loadWorkspaceSavePointPayloadManifest({ workspace, snapshot = null } = {}) {
    if (!workspace?.workspaceDataDir || !snapshot) {
      return null
    }

    return localSnapshotPayloadRuntime.loadWorkspaceSnapshotPayloadManifest({
      workspaceDataDir: workspace.workspaceDataDir,
      snapshot,
    })
  }

  async function loadWorkspaceSavePointPreviewSummary({
    workspace,
    snapshot = null,
    filesStore,
    editorStore,
  } = {}) {
    if (!workspace?.path || !workspace?.workspaceDataDir || !snapshot) {
      return null
    }

    return previewRuntime.loadWorkspaceSnapshotPreviewSummary({
      workspacePath: workspace.path,
      workspaceDataDir: workspace.workspaceDataDir,
      snapshot,
      filesStore,
      editorStore,
    })
  }

  async function loadWorkspaceSavePointFilePreview({
    workspace,
    snapshot = null,
    filePath = '',
  } = {}) {
    if (!workspace?.path || !workspace?.workspaceDataDir || !snapshot || !filePath) {
      return null
    }

    return diffRuntime.loadWorkspaceSnapshotFilePreview({
      workspacePath: workspace.path,
      workspaceDataDir: workspace.workspaceDataDir,
      snapshot,
      filePath,
    })
  }

  async function restoreWorkspaceSavePoint({
    workspace,
    filesStore,
    editorStore,
    snapshot = null,
    targetPaths = [],
    removeAddedFiles = false,
  } = {}) {
    if (!workspace?.path || !workspace?.workspaceDataDir || !snapshot) {
      return { restored: false, reason: 'missing-input' }
    }

    const payloadResult = await localSnapshotPayloadRuntime.restoreWorkspaceSnapshotPayload({
      workspacePath: workspace.path,
      workspaceDataDir: workspace.workspaceDataDir,
      snapshot,
      targetPaths,
      applyFileContent: async (filePath, content) =>
        fileApplyRuntime.applyWorkspaceSnapshotFileContent({
          filesStore,
          editorStore,
          filePath,
          content,
        }),
    })
    if (
      payloadResult?.reason &&
      payloadResult.reason !== '' &&
      payloadResult.reason !== 'missing-targets'
    ) {
      return payloadResult
    }

    let deleteResult = {
      removed: false,
      removedFiles: [],
    }
    if (removeAddedFiles && (!Array.isArray(targetPaths) || targetPaths.length === 0)) {
      deleteResult = await deletionRuntime.removeWorkspaceSnapshotAddedFiles({
        workspacePath: workspace.path,
        workspaceDataDir: workspace.workspaceDataDir,
        snapshot,
        filesStore,
        editorStore,
      })
      if (
        deleteResult?.reason &&
        deleteResult.reason !== '' &&
        deleteResult.reason !== 'missing-targets'
      ) {
        return {
          restored: false,
          reason: deleteResult.reason,
          restoredFiles: payloadResult?.restoredFiles || [],
          removedFiles: deleteResult?.removedFiles || [],
          filePath: deleteResult?.filePath || '',
          manifest: deleteResult?.manifest || payloadResult?.manifest,
        }
      }
    }

    return {
      restored: !!(payloadResult?.restored || deleteResult?.removed),
      restoredFiles: payloadResult?.restoredFiles || [],
      removedFiles: deleteResult?.removedFiles || [],
      manifest: payloadResult?.manifest || deleteResult?.manifest,
    }
  }

  async function restoreWorkspaceSavePointFile({
    workspace,
    filesStore,
    editorStore,
    snapshot = null,
    filePath = '',
  } = {}) {
    if (!filePath) {
      return { restored: false, reason: 'missing-input' }
    }

    return restoreWorkspaceSavePoint({
      workspace,
      filesStore,
      editorStore,
      snapshot,
      targetPaths: [filePath],
    })
  }

  async function applyWorkspaceSavePointFilePreviewContent({
    workspace,
    filesStore,
    editorStore,
    snapshot = null,
    filePath = '',
    content = '',
  } = {}) {
    if (!workspace?.path || !snapshot || !filePath || typeof content !== 'string') {
      return { applied: false, reason: 'missing-input' }
    }

    const applied = await fileApplyRuntime.applyWorkspaceSnapshotFileContent({
      filesStore,
      editorStore,
      filePath,
      content,
    })
    return {
      applied,
      reason: applied ? '' : 'apply-failed',
      filePath,
    }
  }

  async function removeWorkspaceSavePointAddedFile({
    workspace,
    filesStore,
    editorStore,
    snapshot = null,
    filePath = '',
  } = {}) {
    if (!workspace?.path || !workspace?.workspaceDataDir || !snapshot || !filePath) {
      return { removed: false, reason: 'missing-input' }
    }

    return deletionRuntime.removeWorkspaceSnapshotAddedFiles({
      workspacePath: workspace.path,
      workspaceDataDir: workspace.workspaceDataDir,
      snapshot,
      filesStore,
      editorStore,
      targetPaths: [filePath],
    })
  }

  return {
    createWorkspaceSnapshot,
    listWorkspaceSavePoints,
    deleteWorkspaceSavePoint,
    loadWorkspaceSavePointPayloadManifest,
    loadWorkspaceSavePointPreviewSummary,
    loadWorkspaceSavePointFilePreview,
    restoreWorkspaceSavePoint,
    restoreWorkspaceSavePointFile,
    applyWorkspaceSavePointFilePreviewContent,
    removeWorkspaceSavePointAddedFile,
  }
}

const workspaceSnapshotOperations = createWorkspaceSnapshotOperations()

export const createWorkspaceSnapshot = workspaceSnapshotOperations.createWorkspaceSnapshot
export const listWorkspaceSavePoints = workspaceSnapshotOperations.listWorkspaceSavePoints
export const deleteWorkspaceSavePoint = workspaceSnapshotOperations.deleteWorkspaceSavePoint
export const loadWorkspaceSavePointPayloadManifest =
  workspaceSnapshotOperations.loadWorkspaceSavePointPayloadManifest
export const loadWorkspaceSavePointPreviewSummary =
  workspaceSnapshotOperations.loadWorkspaceSavePointPreviewSummary
export const loadWorkspaceSavePointFilePreview =
  workspaceSnapshotOperations.loadWorkspaceSavePointFilePreview
export const restoreWorkspaceSavePoint = workspaceSnapshotOperations.restoreWorkspaceSavePoint
export const restoreWorkspaceSavePointFile =
  workspaceSnapshotOperations.restoreWorkspaceSavePointFile
export const applyWorkspaceSavePointFilePreviewContent =
  workspaceSnapshotOperations.applyWorkspaceSavePointFilePreviewContent
export const removeWorkspaceSavePointAddedFile =
  workspaceSnapshotOperations.removeWorkspaceSavePointAddedFile

export {
  attachWorkspaceSnapshotMetadata,
  attachWorkspaceSnapshotMetadataList,
  createWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotMetadata,
  getWorkspaceSnapshotDisplayMessage,
  getWorkspaceSnapshotTitle,
  getWorkspaceSnapshotPayloadCaptureScope,
  getWorkspaceSnapshotPayloadSkippedCount,
  isLoadedWorkspaceTextPayload,
  isProjectTextSetPayload,
  isNamedWorkspaceSnapshot,
}
