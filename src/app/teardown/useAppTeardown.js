import { onUnmounted } from 'vue'

export function useAppTeardown({
  cleanupAppShellLayout,
  workspace,
  filesStore,
  linksStore,
  commentsStore,
}) {
  onUnmounted(() => {
    cleanupAppShellLayout()
    workspace.cleanup()
    filesStore.cleanup()
    linksStore.cleanup()
    commentsStore.cleanup()
  })
}
