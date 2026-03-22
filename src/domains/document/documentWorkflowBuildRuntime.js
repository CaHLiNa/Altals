import {
  getDocumentAdapterForFile,
  getDocumentAdapterForWorkflow,
} from '../../services/documentWorkflow/adapters/index.js'

function resolveDocumentAdapter(filePath, options = {}) {
  if (options.adapter) return options.adapter
  if (options.workflowOnly === false) {
    return getDocumentAdapterForFile(filePath)
  }
  return getDocumentAdapterForWorkflow(filePath)
}

function resolvePreferredPreviewKind(adapter, options = {}, workflowStore = null) {
  if (!adapter) return null
  if (options.previewKind) return options.previewKind

  const getPreferredPreviewKind = (
    options.getPreferredPreviewKind
    || workflowStore?.getPreferredPreviewKind?.bind(workflowStore)
  )
  return getPreferredPreviewKind?.(adapter.kind) || adapter.preview?.defaultKind || null
}

function resolvePreviewKind(filePath, adapter, options = {}, workflowStore = null) {
  if (!adapter) return null

  const session = options.session || workflowStore?.session || {}
  const preferredPreviewKind = resolvePreferredPreviewKind(adapter, options, workflowStore)
  if (session.activeFile === filePath) {
    return session.previewKind || preferredPreviewKind
  }
  return preferredPreviewKind
}

function resolvePreviewAvailable(filePath, previewKind, options = {}, workflowStore = null) {
  if (typeof options.previewAvailable === 'boolean') return options.previewAvailable
  if (!filePath || !previewKind) return false

  const hasPreviewForSource = (
    options.hasPreviewForSource
    || workflowStore?.hasPreviewForSource?.bind(workflowStore)
  )
  return hasPreviewForSource?.(filePath, previewKind) === true
}

export function getDocumentWorkflowStatusTone(uiState = null) {
  if (!uiState) return 'muted'
  if (uiState.kind === 'markdown') {
    if (uiState.exportPhase === 'exporting' || uiState.phase === 'rendering') return 'running'
    if (uiState.phase === 'error') return 'error'
    if (uiState.exportPhase === 'error') return 'warning'
    if (uiState.phase === 'ready' || uiState.exportPhase === 'ready') return 'success'
    return 'muted'
  }
  if (uiState.phase === 'compiling' || uiState.phase === 'rendering') return 'running'
  if (uiState.phase === 'queued') return 'warning'
  if (uiState.phase === 'error') return 'error'
  if (uiState.phase === 'ready') return 'success'
  return 'muted'
}

export function createDocumentWorkflowBuildRuntime({
  getWorkflowStore,
  getEditorStore,
  getFilesStore,
  getWorkspaceStore,
  getLatexStore,
  getTypstStore,
  getReferencesStore,
} = {}) {
  function resolveBaseContext(options = {}) {
    return {
      workflowStore: getWorkflowStore?.() || null,
      editorStore: options.editorStore || getEditorStore?.() || null,
      filesStore: options.filesStore || getFilesStore?.() || null,
      chatStore: options.chatStore || null,
      workspace: options.workspace || getWorkspaceStore?.() || null,
      latexStore: options.latexStore || getLatexStore?.() || null,
      typstStore: options.typstStore || getTypstStore?.() || null,
      toastStore: options.toastStore || null,
      referencesStore: options.referencesStore || getReferencesStore?.() || null,
      t: options.t || null,
    }
  }

  function buildAdapterContext(filePath, options = {}) {
    const context = resolveBaseContext(options)
    const adapter = resolveDocumentAdapter(filePath, options)
    if (!adapter) {
      return {
        ...context,
        adapter: null,
        previewKind: null,
        previewAvailable: false,
      }
    }

    const previewKind = resolvePreviewKind(filePath, adapter, options, context.workflowStore)
    return {
      ...context,
      adapter,
      previewKind,
      previewAvailable: resolvePreviewAvailable(filePath, previewKind, options, context.workflowStore),
    }
  }

  function openLogForFile(filePath, options = {}) {
    const context = buildAdapterContext(filePath, options)
    context.adapter?.compile?.openLog?.(filePath, context)
  }

  function getProblemsForFile(filePath, options = {}) {
    const context = buildAdapterContext(filePath, options)
    return context.adapter?.getProblems?.(filePath, context) || []
  }

  function getUiStateForFile(filePath, options = {}) {
    const context = buildAdapterContext(filePath, options)
    return context.adapter?.getUiState?.(filePath, context) || null
  }

  function getStatusTextForFile(filePath, options = {}) {
    const context = buildAdapterContext(filePath, options)
    return context.adapter?.compile?.getStatusText?.(filePath, context) || ''
  }

  function getArtifactPathForFile(filePath, options = {}) {
    const context = buildAdapterContext(filePath, options)
    return context.adapter?.compile?.getArtifactPath?.(filePath, context) || ''
  }

  return {
    buildAdapterContext,
    openLogForFile,
    getProblemsForFile,
    getUiStateForFile,
    getStatusTextForFile,
    getArtifactPathForFile,
    getStatusTone: getDocumentWorkflowStatusTone,
  }
}
