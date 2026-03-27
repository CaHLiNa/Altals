import { createDocumentWorkflowBuildOperationRuntime } from './documentWorkflowBuildOperationRuntime.js'

export function createDocumentWorkflowActionRuntime({
  getWorkflowStore,
  getBuildOperationRuntime = () => createDocumentWorkflowBuildOperationRuntime(),
} = {}) {
  function resolveWorkspacePreviewState(filePath, options = {}) {
    const workflowStore = getWorkflowStore?.() || null
    return workflowStore?.getWorkspacePreviewStateForFile?.(filePath, options.buildOptions || {}) || null
  }

  function toggleMarkdownPreviewForFile(filePath, options = {}) {
    if (!filePath) return null

    const workflowStore = getWorkflowStore?.() || null
    const previewState = resolveWorkspacePreviewState(filePath, options)
    if (previewState?.previewVisible) {
      return workflowStore?.hideWorkspacePreviewForFile?.(filePath) || null
    }
    return workflowStore?.showWorkspacePreviewForFile?.(filePath, {
      previewKind: 'html',
      sourcePaneId: options.sourcePaneId,
      trigger: options.trigger || 'markdown-preview-toggle',
    }) || null
  }

  function togglePdfPreviewForFile(filePath, options = {}) {
    if (!filePath) return null

    const workflowStore = getWorkflowStore?.() || null
    const previewState = resolveWorkspacePreviewState(filePath, options)
    if (previewState?.previewVisible && previewState?.previewMode === 'pdf') {
      return workflowStore?.hideWorkspacePreviewForFile?.(filePath) || null
    }
    return workflowStore?.switchWorkspacePreviewModeForFile?.(filePath, {
      previewKind: 'pdf',
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

    const previewState = resolveWorkspacePreviewState(filePath, options)
    if (previewState?.previewVisible && previewState?.previewMode === uiState.previewKind) {
      return workflowStore.hideWorkspacePreviewForFile?.(filePath) || null
    }

    return workflowStore.showWorkspacePreviewForFile?.(filePath, {
      previewKind: uiState.previewKind,
      sourcePaneId: options.sourcePaneId,
      trigger: options.trigger || 'workflow-toggle-preview',
    }) || null
  }

  function revealPdfForFile(filePath, options = {}) {
    if (!filePath) return null

    const uiState = options.uiState || null
    if (uiState?.kind !== 'typst') return null

    return togglePdfPreviewForFile(filePath, {
      ...options,
      adapterKind: 'typst',
      trigger: options.trigger || 'typst-pdf-toggle',
    })
  }

  return {
    toggleMarkdownPreviewForFile,
    togglePdfPreviewForFile,
    runPrimaryActionForFile,
    revealPreviewForFile,
    revealPdfForFile,
  }
}
