import { isNewTab } from '../../utils/fileTypes'

export function useWorkspaceShellNavigation({
  workspace,
  editorStore,
  getFallbackContextPath = () => '',
} = {}) {
  function focusExistingPath(targetPath) {
    if (!targetPath) return false

    const existingPane = editorStore?.findPaneWithTab?.(targetPath)
    if (existingPane) {
      existingPane.activeTab = targetPath
      editorStore.activePaneId = existingPane.id
      editorStore.saveEditorState?.()
      return true
    }

    editorStore?.openFileInPane?.(targetPath, editorStore.activePaneId, {
      activatePane: true,
      replaceNewTab: false,
    })
    return true
  }

  function openProjectHome() {
    if (!workspace?.isOpen) return

    workspace.openWorkspaceSurface?.()
    const paneId = editorStore?.activePaneId || 'pane-root'
    const activePane = editorStore?.activePane
    if (activePane?.activeTab && isNewTab(activePane.activeTab)) {
      return
    }
    editorStore?.openNewTab?.(paneId)
  }

  function focusWritingWorkspace() {
    if (!workspace?.isOpen) return

    workspace.openWorkspaceSurface?.()
    const targetPath = editorStore?.preferredContextPath || getFallbackContextPath?.() || ''
    if (focusExistingPath(targetPath)) return
    openProjectHome()
  }

  function openEvidence() {
    if (!workspace?.isOpen) return
    workspace.openLibrarySurface?.()
  }

  function openAssist() {
    if (!workspace?.isOpen) return
    workspace.openAiSurface?.()
  }

  return {
    openProjectHome,
    focusWritingWorkspace,
    openEvidence,
    openAssist,
  }
}
