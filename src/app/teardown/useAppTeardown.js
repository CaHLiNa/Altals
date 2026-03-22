import { onUnmounted } from 'vue'
import { shutdownOpencodeSidecar } from '../../services/ai/opencodeSidecar'

export function useAppTeardown({
  cleanupAppShellLayout,
  workspace,
  filesStore,
  reviews,
  linksStore,
  chatStore,
  commentsStore,
  referencesStore,
  researchArtifactsStore,
}) {
  onUnmounted(() => {
    cleanupAppShellLayout()
    workspace.cleanup()
    filesStore.cleanup()
    reviews.cleanup()
    linksStore.cleanup()
    chatStore.cleanup()
    commentsStore.cleanup()
    referencesStore.cleanup()
    researchArtifactsStore.cleanup()
    void shutdownOpencodeSidecar()
  })
}
