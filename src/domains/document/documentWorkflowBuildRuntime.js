import {
  getDocumentAdapterForFile,
  getDocumentAdapterForWorkflow,
} from '../../services/documentWorkflow/adapters/index.js'
import { resolveCachedLatexRootPath } from '../../services/latex/root.js'
import { resolveCachedTypstRootPath } from '../../services/typst/root.js'
import { resolveDocumentWorkspacePreviewState } from './documentWorkspacePreviewRuntime.js'

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

function resolveTargetResolution(filePath, adapter, context = {}) {
  if (!adapter || !filePath) return null
  if (adapter.kind === 'markdown') return { status: 'resolved', targetPath: filePath }
  if (adapter.kind === 'latex') {
    const compileState = context.latexStore?.stateForFile?.(filePath) || null
    const targetPath = compileState?.sourcePath || resolveCachedLatexRootPath(filePath) || ''
    return targetPath ? { status: 'resolved', targetPath } : { status: 'unresolved', targetPath: '' }
  }
  if (adapter.kind === 'typst') {
    const compileState = context.typstStore?.stateForFile?.(filePath) || null
    const targetPath = (
      compileState?.compileTargetPath
      || compileState?.projectRootPath
      || resolveCachedTypstRootPath(filePath)
      || filePath
    )
    return targetPath ? { status: 'resolved', targetPath } : { status: 'unresolved', targetPath: '' }
  }
  return null
}

function resolveWorkspacePreviewState(filePath, adapter, context = {}, options = {}) {
  if (!adapter || !filePath) {
    return resolveDocumentWorkspacePreviewState({
      filePath,
      workflowUiState: null,
    })
  }

  const previewKind = resolvePreviewKind(filePath, adapter, options, context.workflowStore)
  const artifactPath = adapter.compile?.getArtifactPath?.(filePath, context) || ''
  const latexState = context.latexStore?.stateForFile?.(filePath) || null
  const typstState = context.typstStore?.stateForFile?.(filePath) || null
  const typstLiveState = context.typstStore?.liveStateForFile?.(filePath) || null
  const targetResolution = resolveTargetResolution(filePath, adapter, context)
  const artifactReady = adapter.kind === 'latex'
    ? Boolean(latexState?.pdfPath)
    : adapter.kind === 'typst'
      ? Boolean(typstState?.pdfPath)
      : false
  const hiddenByUser = context.workflowStore?.isWorkspacePreviewHiddenForFile?.(filePath) === true

  return resolveDocumentWorkspacePreviewState({
    filePath,
    workflowUiState: { kind: adapter.kind, previewKind },
    previewKind,
    artifactPath,
    artifactReady,
    targetResolution,
    hiddenByUser,
    typstNativeReady: adapter.kind === 'typst'
      ? (typstLiveState?.tinymistBacked !== false)
      : null,
  })
}

function resolveWorkspacePreviewAvailability(filePath, adapter, context = {}, options = {}) {
  if (!adapter || !filePath) return false

  const previewKind = resolvePreviewKind(filePath, adapter, options, context.workflowStore)
  const artifactPath = adapter.compile?.getArtifactPath?.(filePath, context) || ''
  const latexState = context.latexStore?.stateForFile?.(filePath) || null
  const typstState = context.typstStore?.stateForFile?.(filePath) || null
  const typstLiveState = context.typstStore?.liveStateForFile?.(filePath) || null
  const targetResolution = resolveTargetResolution(filePath, adapter, context)
  const artifactReady = adapter.kind === 'latex'
    ? Boolean(latexState?.pdfPath)
    : adapter.kind === 'typst'
      ? Boolean(typstState?.pdfPath)
      : false

  return resolveDocumentWorkspacePreviewState({
    filePath,
    workflowUiState: { kind: adapter.kind, previewKind },
    previewKind,
    artifactPath,
    artifactReady,
    targetResolution,
    hiddenByUser: false,
    typstNativeReady: adapter.kind === 'typst'
      ? (typstLiveState?.tinymistBacked !== false)
      : null,
  }).previewVisible
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
        previewVisible: false,
      }
    }

    const previewKind = resolvePreviewKind(filePath, adapter, options, context.workflowStore)
    const previewAvailable = resolveWorkspacePreviewAvailability(filePath, adapter, context, options)
    const workspacePreviewState = resolveWorkspacePreviewState(filePath, adapter, context, options)
    return {
      ...context,
      adapter,
      previewKind,
      previewAvailable,
      previewVisible: workspacePreviewState.previewVisible,
      workspacePreviewState,
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

  function getWorkspacePreviewStateForFile(filePath, options = {}) {
    return buildAdapterContext(filePath, options).workspacePreviewState
  }

  return {
    buildAdapterContext,
    openLogForFile,
    getProblemsForFile,
    getUiStateForFile,
    getStatusTextForFile,
    getArtifactPathForFile,
    getWorkspacePreviewStateForFile,
    getStatusTone: getDocumentWorkflowStatusTone,
  }
}
