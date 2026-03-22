import { getViewerType } from '../../utils/fileTypes.js'

export function createDocumentWorkflowTypstPaneRuntime({
  getEditorStore,
  getWorkflowStore,
} = {}) {
  const typstPdfPaneState = new Map()

  function isPreviewHostPane(editorStore, paneId) {
    const pane = editorStore?.findPane?.(editorStore.paneTree, paneId)
    if (!pane) return false
    if (!pane.activeTab) return true
    const viewerType = getViewerType(pane.activeTab)
    return viewerType === 'typst-native-preview' || viewerType === 'pdf'
  }

  function getTrackedTypstPdfState(editorStore, sourcePath) {
    const state = typstPdfPaneState.get(sourcePath)
    if (!state?.paneId) return null

    const pane = editorStore?.findPane?.(editorStore.paneTree, state.paneId)
    if (!pane || !isPreviewHostPane(editorStore, state.paneId)) {
      typstPdfPaneState.delete(sourcePath)
      return null
    }

    return state
  }

  function getTypstSharedPaneInfo(editorStore, workflowStore, sourcePath, previewPath, artifactPath, sourcePaneId) {
    const previewBinding = workflowStore?.findPreviewBindingForSource?.(sourcePath, 'native')
    const previewPaneId = (
      previewBinding?.paneId
      || editorStore?.findPaneWithTab?.(previewPath)?.id
      || (
        workflowStore?.session?.previewSourcePath === sourcePath
        && workflowStore?.session?.previewKind === 'native'
          ? workflowStore?.session?.previewPaneId
          : null
      )
      || ''
    )

    if (previewPaneId) {
      return {
        paneId: previewPaneId,
        pane: editorStore?.findPane?.(editorStore.paneTree, previewPaneId) || null,
        previewPath,
        artifactPath,
        hasPreview: true,
        pdfMode: getTrackedTypstPdfState(editorStore, sourcePath)?.mode || null,
      }
    }

    const tracked = getTrackedTypstPdfState(editorStore, sourcePath)
    if (tracked?.paneId) {
      return {
        paneId: tracked.paneId,
        pane: editorStore?.findPane?.(editorStore.paneTree, tracked.paneId) || null,
        previewPath,
        artifactPath,
        hasPreview: false,
        pdfMode: tracked.mode,
      }
    }

    const existingPdfPane = editorStore?.findPaneWithTab?.(artifactPath)
    if (existingPdfPane?.id && isPreviewHostPane(editorStore, existingPdfPane.id)) {
      return {
        paneId: existingPdfPane.id,
        pane: existingPdfPane,
        previewPath,
        artifactPath,
        hasPreview: false,
        pdfMode: 'owned',
      }
    }

    const neighborPane = editorStore?.findRightNeighborLeaf?.(sourcePaneId)
    if (neighborPane?.id && isPreviewHostPane(editorStore, neighborPane.id)) {
      return {
        paneId: neighborPane.id,
        pane: neighborPane,
        previewPath,
        artifactPath,
        hasPreview: false,
        pdfMode: null,
      }
    }

    return {
      paneId: '',
      pane: null,
      previewPath,
      artifactPath,
      hasPreview: false,
      pdfMode: null,
    }
  }

  function openTypstPdfInPane(editorStore, sourcePath, artifactPath, paneId, mode) {
    if (!paneId) return false
    typstPdfPaneState.set(sourcePath, { paneId, mode })
    editorStore?.openFileInPane?.(artifactPath, paneId, { activatePane: true })
    return true
  }

  function closeTypstSharedPane(editorStore, workflowStore, sourcePath, previewPath, artifactPath, paneId, trigger) {
    if (previewPath) {
      workflowStore?.closePreviewForSource?.(sourcePath, {
        previewKind: 'native',
        trigger,
        reconcile: false,
      })
    }

    if (paneId) {
      const pane = editorStore?.findPane?.(editorStore.paneTree, paneId)
      if (pane?.tabs.includes(artifactPath)) {
        editorStore?.closeTab?.(paneId, artifactPath)
      }
    } else {
      editorStore?.closeFileFromAllPanes?.(artifactPath)
    }

    typstPdfPaneState.delete(sourcePath)
    workflowStore?.reconcile?.({ trigger })
  }

  async function revealPreviewForFile(sourcePath, options = {}) {
    if (!sourcePath) return null

    const editorStore = getEditorStore?.() || null
    const workflowStore = getWorkflowStore?.() || null
    if (!editorStore || !workflowStore) return null

    const previewPath = workflowStore.getPreviewPathForSource?.(sourcePath, 'native') || ''
    const artifactPath = workflowStore.getArtifactPathForFile?.(sourcePath, options.buildOptions || {}) || ''
    const shared = getTypstSharedPaneInfo(
      editorStore,
      workflowStore,
      sourcePath,
      previewPath,
      artifactPath,
      options.sourcePaneId,
    )
    const activeTab = shared.pane?.activeTab || ''

    if (shared.paneId && activeTab === previewPath) {
      closeTypstSharedPane(
        editorStore,
        workflowStore,
        sourcePath,
        previewPath,
        artifactPath,
        shared.paneId,
        options.closeTrigger || 'typst-preview-toggle-close',
      )
      return null
    }

    if (shared.paneId && activeTab === artifactPath) {
      const result = workflowStore.ensurePreviewForSource?.(sourcePath, {
        previewKind: 'native',
        activatePreview: false,
        sourcePaneId: options.sourcePaneId,
        trigger: options.switchTrigger || 'typst-preview-toggle-switch',
      }) || null
      const targetPaneId = result?.previewPaneId || shared.paneId
      if (previewPath && targetPaneId) {
        editorStore.openFileInPane(previewPath, targetPaneId, { activatePane: true })
        if (shared.pdfMode === 'owned') {
          const targetPane = editorStore.findPane?.(editorStore.paneTree, targetPaneId)
          if (targetPane?.tabs.includes(artifactPath)) {
            editorStore.closeTab?.(targetPaneId, artifactPath)
          }
        }
      }
      typstPdfPaneState.delete(sourcePath)
      return result
    }

    const result = await workflowStore.togglePreviewForSource?.(sourcePath, {
      previewKind: 'native',
      activatePreview: true,
      jump: true,
      sourcePaneId: options.sourcePaneId,
      trigger: options.openTrigger || 'workflow-toggle-preview',
    })
    typstPdfPaneState.delete(sourcePath)
    return result || null
  }

  function revealPdfForFile(sourcePath, options = {}) {
    if (!sourcePath) return null

    const editorStore = getEditorStore?.() || null
    const workflowStore = getWorkflowStore?.() || null
    if (!editorStore || !workflowStore) return null

    const artifactPath = workflowStore.getArtifactPathForFile?.(sourcePath, options.buildOptions || {})
    if (!artifactPath) return null

    const previewPath = workflowStore.getPreviewPathForSource?.(sourcePath, 'native') || ''
    const shared = getTypstSharedPaneInfo(
      editorStore,
      workflowStore,
      sourcePath,
      previewPath,
      artifactPath,
      options.sourcePaneId,
    )
    const activeTab = shared.pane?.activeTab || ''

    if (shared.paneId && activeTab === artifactPath) {
      if (shared.pdfMode === 'overlay' && previewPath) {
        editorStore.openFileInPane(previewPath, shared.paneId, { activatePane: true })
      } else {
        const pane = editorStore.findPane?.(editorStore.paneTree, shared.paneId)
        if (pane?.tabs.includes(artifactPath)) {
          editorStore.closeTab?.(shared.paneId, artifactPath)
        }
      }
      typstPdfPaneState.delete(sourcePath)
      return null
    }

    if (shared.paneId && activeTab === previewPath) {
      openTypstPdfInPane(editorStore, sourcePath, artifactPath, shared.paneId, 'overlay')
      return null
    }

    if (shared.paneId) {
      openTypstPdfInPane(
        editorStore,
        sourcePath,
        artifactPath,
        shared.paneId,
        shared.hasPreview ? 'overlay' : 'owned',
      )
      return null
    }

    const newPaneId = editorStore.splitPaneWith?.(options.sourcePaneId, 'vertical', artifactPath)
    if (newPaneId) {
      typstPdfPaneState.set(sourcePath, { paneId: newPaneId, mode: 'owned' })
      editorStore.setActivePane?.(newPaneId)
    }

    return null
  }

  return {
    revealPreviewForFile,
    revealPdfForFile,
  }
}
