import { activateOrOpenPaneTab, appendFreshPaneTab } from './paneTabs.js'

export function createEditorOpenRoutingRuntime({
  getActivePaneId,
  setActivePaneId,
  findPane,
  findPaneWithTab,
  rememberContextPath,
  recordFileOpen,
  revealInTree,
  saveEditorState,
  createNewTabPath,
} = {}) {
  function rememberOpenedPath(path) {
    rememberContextPath?.(path)
    if (path && !path.startsWith('newtab:') && !path.startsWith('preview:') && !path.startsWith('typst-preview:')) {
      recordFileOpen?.(path)
    }
  }

  function openFile(path) {
    const existingPane = findPaneWithTab?.(path)
    if (existingPane) {
      existingPane.activeTab = path
      setActivePaneId?.(existingPane.id)
      rememberOpenedPath(path)
      saveEditorState?.()
      return
    }

    const pane = findPane?.(getActivePaneId?.())
    if (!pane) return

    activateOrOpenPaneTab(pane, path, {
      replaceLauncher: true,
    })
    rememberOpenedPath(path)
    revealInTree?.(path)
    saveEditorState?.()
  }

  function openNewTab(paneId = null) {
    const targetPane = paneId
      ? findPane?.(paneId)
      : findPane?.(getActivePaneId?.())
    if (!targetPane) return

    appendFreshPaneTab(targetPane, createNewTabPath?.())
    saveEditorState?.()
  }

  function openFileInPane(path, paneId, options = {}) {
    const pane = findPane?.(paneId)
    if (!pane) return null

    activateOrOpenPaneTab(pane, path, {
      replaceLauncher: options.replaceNewTab !== false,
    })

    if (options.activatePane) {
      setActivePaneId?.(paneId)
      rememberContextPath?.(path)
    }

    saveEditorState?.()
    return paneId
  }

  return {
    openFile,
    openNewTab,
    openFileInPane,
  }
}
