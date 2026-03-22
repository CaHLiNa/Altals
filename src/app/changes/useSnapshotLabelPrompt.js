import { onBeforeUnmount, ref } from 'vue'
import { createSnapshotLabelPromptRuntime } from './snapshotLabelPromptRuntime.js'

export function useSnapshotLabelPrompt(options = {}) {
  const snapshotLabelPromptActive = ref(false)
  const snapshotLabelDialogVisible = ref(false)

  const runtime = createSnapshotLabelPromptRuntime({
    ...options,
    onStateChange: ({ promptActive, dialogVisible }) => {
      snapshotLabelPromptActive.value = promptActive
      snapshotLabelDialogVisible.value = dialogVisible
      options.onStateChange?.({ promptActive, dialogVisible })
    },
  })

  onBeforeUnmount(() => {
    runtime.dispose()
  })

  return {
    beginSnapshotLabelConfirmation: runtime.beginSnapshotLabelConfirmation,
    snapshotLabelDialogVisible,
    snapshotLabelPromptActive,
    openSnapshotLabelDialog: runtime.openSnapshotLabelDialog,
    resolveSnapshotLabelDialog: runtime.resolveSnapshotLabelDialog,
  }
}
