import {
  isLatex,
  isMarkdown,
  isPreviewPath,
  isTypst,
} from '../../utils/fileTypes.js'

function inferDocumentKind(filePath = '', workflowUiState = null) {
  if (workflowUiState?.kind && workflowUiState.kind !== 'text') return workflowUiState.kind
  if (isMarkdown(filePath)) return 'markdown'
  if (isLatex(filePath)) return 'latex'
  if (isTypst(filePath)) return 'typst'
  return null
}

export function shouldUseDocumentWorkspaceTab(filePath = '') {
  if (!filePath || isPreviewPath(filePath)) return false
  return isMarkdown(filePath) || isLatex(filePath) || isTypst(filePath)
}

export function resolveDocumentWorkspacePreviewState(input = {}) {
  const filePath = String(input.filePath || input.sourcePath || '')
  const workflowUiState = input.workflowUiState || null
  const kind = inferDocumentKind(filePath, workflowUiState)
  const previewKind = input.previewKind || workflowUiState?.previewKind || null
  const useWorkspace = shouldUseDocumentWorkspaceTab(filePath)
  const targetResolution = input.targetResolution || null
  const artifactPath = String(input.artifactPath || '')
  const artifactReady = input.artifactReady === true || !!artifactPath
  const typstNativeReady = input.typstNativeReady !== false
  const hiddenByUser = input.hiddenByUser === true

  if (!useWorkspace || !kind) {
    return {
      useWorkspace: false,
      previewVisible: false,
      previewMode: null,
      previewFilePath: '',
      reason: 'unsupported',
      legacyReadOnly: false,
      allowPreviewCreation: false,
      preserveOpenLegacy: true,
    }
  }

  if (kind === 'markdown') {
    return {
      useWorkspace: true,
      previewVisible: !hiddenByUser,
      previewMode: hiddenByUser ? null : 'markdown',
      previewFilePath: hiddenByUser ? '' : `preview:${filePath}`,
      reason: hiddenByUser ? 'hidden-by-user' : null,
      legacyReadOnly: false,
      allowPreviewCreation: false,
      preserveOpenLegacy: true,
    }
  }

  if (kind === 'latex') {
    const unresolved = targetResolution?.status === 'unresolved'
    return {
      useWorkspace: true,
      previewVisible: artifactReady && !hiddenByUser,
      previewMode: artifactReady && !hiddenByUser ? 'pdf' : null,
      previewFilePath: artifactReady && !hiddenByUser ? artifactPath : '',
      reason: hiddenByUser
        ? 'hidden-by-user'
        : (artifactReady ? null : (unresolved ? 'unresolved-target' : 'preview-unavailable')),
      legacyReadOnly: false,
      allowPreviewCreation: false,
      preserveOpenLegacy: true,
    }
  }

  if (kind === 'typst') {
    if ((previewKind === 'pdf' || !typstNativeReady) && artifactReady) {
      return {
        useWorkspace: true,
        previewVisible: !hiddenByUser,
        previewMode: hiddenByUser ? null : 'pdf',
        previewFilePath: hiddenByUser ? '' : artifactPath,
        reason: hiddenByUser ? 'hidden-by-user' : null,
        legacyReadOnly: false,
        allowPreviewCreation: false,
        preserveOpenLegacy: true,
      }
    }

    if (typstNativeReady && targetResolution?.status !== 'unresolved') {
      return {
        useWorkspace: true,
        previewVisible: !hiddenByUser,
        previewMode: hiddenByUser ? null : 'typst-native',
        previewFilePath: hiddenByUser ? '' : `typst-preview:${filePath}`,
        reason: hiddenByUser ? 'hidden-by-user' : null,
        legacyReadOnly: false,
        allowPreviewCreation: false,
        preserveOpenLegacy: true,
      }
    }

    return {
      useWorkspace: true,
      previewVisible: artifactReady && !hiddenByUser,
      previewMode: artifactReady && !hiddenByUser ? 'pdf' : null,
      previewFilePath: artifactReady && !hiddenByUser ? artifactPath : '',
      reason: hiddenByUser
        ? 'hidden-by-user'
        : (
          artifactReady ? null : (
            targetResolution?.status === 'unresolved'
              ? 'unresolved-target'
              : 'preview-unavailable'
          )
        ),
      legacyReadOnly: false,
      allowPreviewCreation: false,
      preserveOpenLegacy: true,
    }
  }

  return {
    useWorkspace: false,
    previewVisible: false,
    previewMode: null,
    previewFilePath: '',
    reason: 'unsupported',
    legacyReadOnly: false,
    allowPreviewCreation: false,
    preserveOpenLegacy: true,
  }
}
