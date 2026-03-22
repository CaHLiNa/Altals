import { createWorkspaceHistoryAvailabilityRuntime } from './workspaceHistoryAvailabilityRuntime.js'
import { createWorkspaceHistoryCommitRuntime } from './workspaceHistoryCommitRuntime.js'
import { buildWorkspaceHistorySaveMessage } from './workspaceHistoryMessageRuntime.js'
import { createWorkspaceHistoryPreparationRuntime } from './workspaceHistoryPreparationRuntime.js'
import { buildWorkspaceSnapshotPersistedMessage } from './workspaceSnapshotManifestRuntime.js'
import { createWorkspaceSnapshotRecord } from './workspaceSnapshotRuntime.js'

function normalizeHistoryLabel(value = '') {
  return String(value || '').trim()
}

export function createWorkspaceHistoryPointRuntime({
  availabilityRuntime = createWorkspaceHistoryAvailabilityRuntime(),
  preparationRuntime = createWorkspaceHistoryPreparationRuntime(),
  commitRuntime = createWorkspaceHistoryCommitRuntime(),
  buildSaveMessageImpl = buildWorkspaceHistorySaveMessage,
  buildSnapshotCommitMessageImpl = buildWorkspaceSnapshotPersistedMessage,
  createSnapshotRecordImpl = createWorkspaceSnapshotRecord,
} = {}) {
  async function resolveHistoryPointIntent({
    preferredHistoryLabel = '',
    requestHistoryLabel,
    t,
  } = {}) {
    const preferredLabel = normalizeHistoryLabel(preferredHistoryLabel)
    if (preferredLabel) {
      return {
        kind: 'named',
        label: preferredLabel,
        commitMessage: preferredLabel,
      }
    }

    const requestedLabel = normalizeHistoryLabel(await requestHistoryLabel?.())
    if (requestedLabel) {
      return {
        kind: 'named',
        label: requestedLabel,
        commitMessage: requestedLabel,
      }
    }

    return {
      kind: 'save',
      label: '',
      commitMessage: buildSaveMessageImpl({ t }),
    }
  }

  async function createHistoryPoint({
    workspace,
    filesStore,
    editorStore,
    preferredHistoryLabel = '',
    requestHistoryLabel,
    showNoChanges,
    onUnavailable,
    onAutoCommitEnabled,
    options = {},
    t,
  } = {}) {
    const workspacePath = workspace?.path || ''
    if (!workspacePath) {
      return { committed: false, reason: 'missing-workspace' }
    }

    const historyAvailability = await availabilityRuntime.ensureWorkspaceHistoryAvailable({
      workspacePath,
      options,
      onUnavailable,
      onAutoCommitEnabled,
    })
    if (!historyAvailability) {
      return { committed: false, reason: 'unavailable' }
    }

    const preparedFiles = await preparationRuntime.prepareWorkspaceHistoryFiles({
      editorStore,
      filesStore,
    })
    if (!preparedFiles?.ok) {
      return { committed: false, reason: 'prepare-failed' }
    }

    const historyPoint = await resolveHistoryPointIntent({
      preferredHistoryLabel,
      requestHistoryLabel,
      t,
    })
    const persistedCommitMessage = buildSnapshotCommitMessageImpl({
      message: historyPoint.commitMessage,
      scope: 'workspace',
      kind: historyPoint.kind,
    })

    const commitResult = await commitRuntime.commitPreparedWorkspaceHistory({
      workspacePath,
      preferredCommitMessage: persistedCommitMessage,
      t,
    })
    if (!commitResult?.committed) {
      if (commitResult?.reason === 'no-changes') {
        showNoChanges?.()
      }
      return {
        ...commitResult,
        historyAvailability,
        historyPoint,
      }
    }

    const snapshot = createSnapshotRecordImpl({
      entry: commitResult.historyEntry || {
        message: commitResult.commitMessage,
      },
      t,
    })

    return {
      ...commitResult,
      commitMessage: historyPoint.commitMessage,
      historyAvailability,
      historyPoint,
      snapshot,
    }
  }

  return {
    resolveHistoryPointIntent,
    createHistoryPoint,
  }
}
