import { createDocumentWorkflowBuildOperationRuntime } from './documentWorkflowBuildOperationRuntime.js'
import { createDocumentWorkflowTypstPaneRuntime } from './documentWorkflowTypstPaneRuntime.js'

export function createDocumentWorkflowActionRuntime({
  getWorkflowStore,
  getBuildOperationRuntime = () => createDocumentWorkflowBuildOperationRuntime(),
  getTypstPaneRuntime = () => createDocumentWorkflowTypstPaneRuntime(),
} = {}) {
  function toggleMarkdownPreviewForFile(filePath, options = {}) {
    if (!filePath) return null

    const workflowStore = getWorkflowStore?.() || null
    return workflowStore?.togglePreviewForSource?.(filePath, {
      previewKind: 'html',
      activatePreview: true,
      sourcePaneId: options.sourcePaneId,
      trigger: options.trigger || 'markdown-preview-toggle',
    }) || null
  }

  function togglePdfPreviewForFile(filePath, options = {}) {
    if (!filePath) return null

    const workflowStore = getWorkflowStore?.() || null
    return workflowStore?.togglePreviewForSource?.(filePath, {
      previewKind: 'pdf',
      activatePreview: true,
      sourcePaneId: options.sourcePaneId,
      trigger: options.trigger || `${options.adapterKind || 'document'}-preview-toggle`,
    }) || null
  }

  async function runPrimaryActionForFile(filePath, options = {}) {
    if (!filePath) return null

    const uiState = options.uiState || null
    if (!uiState?.kind || uiState.kind === 'text') return null

    if (uiState.kind === 'markdown') {
      return toggleMarkdownPreviewForFile(filePath, options)
    }

    if (uiState.kind === 'latex' || uiState.kind === 'typst') {
      const buildOperationRuntime = getBuildOperationRuntime?.() || null
      return buildOperationRuntime?.runBuildForFile?.(filePath, {
        ...(options.buildOptions || {}),
        sourcePaneId: options.sourcePaneId,
        trigger: options.trigger || `${uiState.kind}-compile-button`,
      }) || null
    }

    return null
  }

  async function revealPreviewForFile(filePath, options = {}) {
    if (!filePath) return null

    const workflowStore = getWorkflowStore?.() || null
    const uiState = options.uiState || null
    if (!workflowStore || !uiState?.kind || uiState.kind === 'text') return null

    if (uiState.kind === 'markdown') {
      return toggleMarkdownPreviewForFile(filePath, options)
    }

    if (uiState.kind === 'typst') {
      const typstPaneRuntime = getTypstPaneRuntime?.() || null
      return typstPaneRuntime?.revealPreviewForFile?.(filePath, {
        sourcePaneId: options.sourcePaneId,
        buildOptions: options.buildOptions || {},
      }) || null
    }

    return workflowStore.togglePreviewForSource?.(filePath, {
      previewKind: uiState.previewKind,
      activatePreview: true,
      jump: true,
      sourcePaneId: options.sourcePaneId,
      trigger: options.trigger || 'workflow-toggle-preview',
    }) || null
  }

  function revealPdfForFile(filePath, options = {}) {
    if (!filePath) return null

    const uiState = options.uiState || null
    if (uiState?.kind !== 'typst') return null

    const typstPaneRuntime = getTypstPaneRuntime?.() || null
    return typstPaneRuntime?.revealPdfForFile?.(filePath, {
      sourcePaneId: options.sourcePaneId,
      buildOptions: options.buildOptions || {},
    }) || null
  }

  return {
    toggleMarkdownPreviewForFile,
    togglePdfPreviewForFile,
    runPrimaryActionForFile,
    revealPreviewForFile,
    revealPdfForFile,
  }
}
