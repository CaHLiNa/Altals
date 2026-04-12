import {
  createWorkspaceSnapshot,
} from '../../domains/changes/workspaceSnapshot.js'

export function useWorkspaceSnapshotActions({
  workspace,
  filesStore,
  editorStore,
  toastStore,
  workspaceSnapshotBrowserVisible,
  requestSnapshotLabelImpl = null,
  createWorkspaceSnapshotImpl = createWorkspaceSnapshot,
  t,
}) {
  const defaultRequestSnapshotLabel =
    typeof requestSnapshotLabelImpl === 'function' ? requestSnapshotLabelImpl : null

  async function createSnapshot({
    preferredSnapshotLabel = '',
    requestSnapshotLabel = defaultRequestSnapshotLabel,
    allowLocalSavePointWhenUnchanged = true,
    showNoChanges = () => {
      toastStore.show(t('All saved (no changes)'), {
        type: 'info',
        duration: 2500,
      })
    },
    showSaveFailure = () => {
      toastStore.show(t('Could not add save point'), {
        type: 'warning',
        duration: 3500,
      })
    },
  } = {}) {
    return await createWorkspaceSnapshotImpl({
      workspace,
      filesStore,
      editorStore,
      preferredSnapshotLabel,
      requestSnapshotLabel,
      allowLocalSavePointWhenUnchanged,
      showNoChanges,
      showSaveFailure,
      t,
    })
  }

  function openWorkspaceSnapshots() {
    if (!workspace?.path) {
      return
    }

    workspaceSnapshotBrowserVisible.value = true
  }

  return {
    createSnapshot,
    openWorkspaceSnapshots,
  }
}
