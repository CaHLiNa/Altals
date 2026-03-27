import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveDocumentWorkspacePreviewState,
  shouldUseDocumentWorkspaceTab,
} from '../src/domains/document/documentWorkspacePreviewRuntime.js'

test('Markdown source uses workspace split by default', () => {
  assert.equal(shouldUseDocumentWorkspaceTab('/tmp/note.md'), true)
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/note.md',
    workflowUiState: { kind: 'markdown', previewKind: 'html' },
  })
  assert.equal(result.useWorkspace, true)
  assert.equal(result.previewVisible, true)
  assert.equal(result.previewMode, 'markdown')
  assert.equal(result.previewFilePath, 'preview:/tmp/note.md')
})

test('Markdown preview can be hidden by user toggle', () => {
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/note.md',
    workflowUiState: { kind: 'markdown', previewKind: 'html' },
    hiddenByUser: true,
  })
  assert.equal(result.previewVisible, false)
  assert.equal(result.reason, 'hidden-by-user')
})

test('LaTeX stays source-only when compile artifact is unavailable', () => {
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/section.tex',
    workflowUiState: { kind: 'latex', previewKind: 'pdf' },
    targetResolution: { status: 'unresolved' },
    artifactReady: false,
    artifactPath: '',
  })
  assert.equal(result.previewVisible, false)
  assert.equal(result.reason, 'unresolved-target')
})

test('Typst prefers native preview and falls back to PDF artifact', () => {
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/paper.typ',
    workflowUiState: { kind: 'typst', previewKind: 'native' },
    targetResolution: { status: 'resolved' },
    typstNativeReady: false,
    artifactReady: true,
    artifactPath: '/tmp/paper.pdf',
  })
  assert.equal(result.previewMode, 'pdf')
  assert.equal(result.previewFilePath, '/tmp/paper.pdf')
})

test('raw PDF files never use document workspace runtime', () => {
  assert.equal(shouldUseDocumentWorkspaceTab('/tmp/paper.pdf'), false)
})
