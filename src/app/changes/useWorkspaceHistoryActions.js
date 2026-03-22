import {
  openWorkspaceHistoryEntry,
  saveWorkspaceHistoryCommit,
} from '../../domains/changes/workspaceHistory'

export function useWorkspaceHistoryActions({
  workspace,
  filesStore,
  editorStore,
  footerRef,
  toastStore,
  versionHistoryVisible,
  versionHistoryFile,
  t,
}) {
  function showHistoryUnavailable() {
    toastStore.show(t('Version History is not available for the home folder.'), {
      type: 'warning',
      duration: 5000,
    })
  }

  function startAutoCommitIfNeeded() {
    void workspace.startAutoCommit()
  }

  async function forceSaveAndCommit() {
    await saveWorkspaceHistoryCommit({
      workspace,
      filesStore,
      editorStore,
      requestCommitMessage: () => footerRef.value?.beginSaveConfirmation(),
      showNoChanges: () => footerRef.value?.showCenterMessage(t('All saved (no changes)')),
      showCommitFailure: () => footerRef.value?.showSaveMessage(t('Saved (commit failed)')),
      onUnavailable: showHistoryUnavailable,
      onAutoCommitEnabled: startAutoCommitIfNeeded,
      t,
    })
  }

  function openVersionHistory(entry) {
    openWorkspaceHistoryEntry({
      workspace,
      entry,
      onUnavailable: showHistoryUnavailable,
      onAutoCommitEnabled: startAutoCommitIfNeeded,
      onReady: (path) => {
        versionHistoryFile.value = entry.path
        versionHistoryVisible.value = true
      },
      options: {
        seedInitialCommit: true,
        seedMessage: t('Initial snapshot'),
        enableAutoCommit: true,
      },
    })
      .catch((error) => {
        toastStore.show(t('Failed to initialize Version History: {error}', {
          error: error?.message || String(error || ''),
        }), {
          type: 'error',
          duration: 6000,
        })
      })
  }

  return {
    forceSaveAndCommit,
    openVersionHistory,
  }
}
