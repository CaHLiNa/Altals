import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveDocumentWorkspacePreviewState,
  resolveDocumentWorkspaceTextRoute,
  shouldUseDocumentWorkspaceTab,
} from '../src/domains/document/documentWorkspacePreviewRuntime.js'

test('document workspace routing identifies source documents for workspace composition', () => {
  assert.equal(shouldUseDocumentWorkspaceTab('/workspace/chapter.md'), true)
  assert.equal(shouldUseDocumentWorkspaceTab('/workspace/paper.tex'), true)
  assert.equal(shouldUseDocumentWorkspaceTab('/workspace/paper.rst'), false)
  assert.equal(shouldUseDocumentWorkspaceTab('/workspace/output.pdf'), false)
})

function getWorkspaceRouteContract(options) {
  const previewState = resolveDocumentWorkspacePreviewState(options)
  const textRoute = resolveDocumentWorkspaceTextRoute({
    activeTab: options.path || options.filePath || '',
    viewerType: 'text',
    documentPreviewState: previewState,
  })
  return {
    useWorkspace: previewState.useWorkspace,
    previewVisible: previewState.previewVisible,
    previewKind: previewState.previewKind,
    previewMode: previewState.previewMode,
    targetResolution: previewState.targetResolution,
    reason: previewState.reason,
    toolbarTargetVisible: textRoute.toolbarTargetVisible,
    useWorkspaceSurface: textRoute.useWorkspaceSurface,
    previewTargetPath: textRoute.previewTargetPath,
    previewFilePath: textRoute.previewFilePath,
  }
}

test('document workspace routing keeps markdown previews visible without extra pdf chrome', () => {
  assert.deepEqual(getWorkspaceRouteContract({ path: '/workspace/chapter.md' }), {
    useWorkspace: true,
    previewVisible: true,
    previewKind: 'html',
    previewMode: 'markdown',
    targetResolution: 'not-needed',
    reason: 'workspace-markdown',
    toolbarTargetVisible: false,
    useWorkspaceSurface: true,
    previewTargetPath: '',
    previewFilePath: 'preview:/workspace/chapter.md',
  })
})

test('document workspace routing keeps latex source-only while retaining the resolved pdf target', () => {
  assert.deepEqual(getWorkspaceRouteContract({
    path: '/workspace/paper.tex',
    resolvedTargetPath: '/workspace/paper.pdf',
    artifactReady: true,
  }), {
    useWorkspace: true,
    previewVisible: false,
    previewKind: null,
    previewMode: null,
    targetResolution: 'resolved',
    reason: 'artifact-ready-external',
    toolbarTargetVisible: false,
    useWorkspaceSurface: true,
    previewTargetPath: '/workspace/paper.pdf',
    previewFilePath: '',
  })
})

test('document workspace text route keeps plain text files on the direct editor surface', () => {
  assert.deepEqual(resolveDocumentWorkspaceTextRoute({
    activeTab: '/workspace/notes.txt',
    viewerType: 'text',
    documentPreviewState: null,
  }), {
    useWorkspaceSurface: false,
    previewVisible: false,
    previewMode: null,
    previewTargetPath: '',
    previewFilePath: '',
    toolbarTargetVisible: false,
  })
})
