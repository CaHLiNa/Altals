import {
  createWorkspaceSnapshot,
  openFileVersionHistoryBrowser,
} from '../../domains/changes/workspaceSnapshot.js'

export function useWorkspaceSnapshotActions({
  workspace,
  filesStore,
  editorStore,
  footerRef,
  toastStore,
  workspaceSnapshotBrowserVisible,
  fileVersionHistoryVisible,
  fileVersionHistoryFile,
  createWorkspaceSnapshotImpl = createWorkspaceSnapshot,
  openFileVersionHistoryBrowserImpl = openFileVersionHistoryBrowser,
  t,
}) {
  function showHistoryUnavailable() {
    toastStore.show(t('File Version History is not available for the home folder.'), {
      type: 'warning',
      duration: 5000,
    })
  }

  function startAutoCommitIfNeeded() {
    void workspace.startAutoCommit()
  }

  async function createSnapshot({
    preferredSnapshotLabel = '',
    requestSnapshotLabel = () => footerRef.value?.beginSnapshotLabelConfirmation(),
    allowLocalSavePointWhenUnchanged = false,
    showNoChanges = () => footerRef.value?.showCenterMessage(t('All saved (no changes)')),
    showCommitFailure = () => footerRef.value?.showSaveMessage(t('Saved (commit failed)')),
  } = {}) {
    return await createWorkspaceSnapshotImpl({
      workspace,
      filesStore,
      editorStore,
      preferredSnapshotLabel,
      requestSnapshotLabel,
      allowLocalSavePointWhenUnchanged,
      showNoChanges,
      showCommitFailure,
      onUnavailable: showHistoryUnavailable,
      onAutoCommitEnabled: startAutoCommitIfNeeded,
      t,
    })
  }

  function openWorkspaceSnapshots() {
    if (!workspace?.path) {
      return
    }

    workspaceSnapshotBrowserVisible.value = true
  }

  function openFileVersionHistory(entry) {
    openFileVersionHistoryBrowserImpl({
      workspace,
      filePath: entry.path,
      onUnavailable: showHistoryUnavailable,
      onAutoCommitEnabled: startAutoCommitIfNeeded,
      onReady: (path) => {
        fileVersionHistoryFile.value = path
        fileVersionHistoryVisible.value = true
      },
      options: {
        seedInitialCommit: true,
        seedMessage: t('Initial history'),
        enableAutoCommit: true,
      },
    }).catch((error) => {
      toastStore.show(
        t('Failed to initialize File Version History: {error}', {
          error: error?.message || String(error || ''),
        }),
        {
          type: 'error',
          duration: 6000,
        }
      )
    })
  }

  return {
    createSnapshot,
    openWorkspaceSnapshots,
    openFileVersionHistory,
  }
}
