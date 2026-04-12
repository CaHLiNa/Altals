import test from 'node:test'
import assert from 'node:assert/strict'

import { createDocumentWorkflowBuildRuntime } from '../src/domains/document/documentWorkflowBuildRuntime.js'

function createAdapter(overrides = {}) {
  return {
    kind: 'markdown',
    preview: {
      defaultKind: 'html',
      supportedKinds: ['html'],
      getTargetPath() {
        return ''
      },
      isNativeSupported() {
        return true
      },
      ...(overrides.preview || {}),
    },
    compile: {
      getArtifactPath(filePath) {
        return filePath
      },
      getStatusText() {
        return ''
      },
      ...(overrides.compile || {}),
    },
    getProblems() {
      return []
    },
    getUiState(_filePath, context = {}) {
      return {
        kind: overrides.kind || 'markdown',
        previewKind: context.previewKind || 'html',
        phase: 'ready',
      }
    },
    ...overrides,
  }
}

function createRuntime({ workflowStore, latexStore } = {}) {
  return createDocumentWorkflowBuildRuntime({
    getWorkflowStore: () => workflowStore || null,
    getLatexStore: () => latexStore || null,
  })
}

test('build runtime keeps latex source-only even when a compiled output exists', () => {
  const adapter = createAdapter({
    kind: 'latex',
    preview: {
      defaultKind: null,
      supportedKinds: [],
      getTargetPath() {
        return '/workspace/build/paper.pdf'
      },
    },
    compile: {
      getArtifactPath() {
        return '/workspace/build/paper.pdf'
      },
    },
  })
  const runtime = createRuntime({
    latexStore: {
      stateForFile() {
        return { pdfPath: '/workspace/build/paper.pdf' }
      },
    },
  })

  const context = runtime.buildAdapterContext('/workspace/paper.tex', {
    adapter,
    workflowOnly: false,
  })

  assert.equal(context.previewState.useWorkspace, true)
  assert.equal(context.previewState.previewVisible, false)
  assert.equal(context.previewState.previewKind, null)
  assert.equal(context.previewState.reason, 'artifact-ready-external')
  assert.equal(context.previewTargetPath, '/workspace/build/paper.pdf')
  assert.equal(context.targetResolution, 'resolved')
  assert.equal(context.artifactReady, true)
})

test('build runtime keeps latex pdf preview only while an explicit workspace request is active', () => {
  const adapter = createAdapter({
    kind: 'latex',
    preview: {
      defaultKind: null,
      supportedKinds: ['pdf'],
      getTargetPath() {
        return '/workspace/build/paper.pdf'
      },
    },
    compile: {
      getArtifactPath() {
        return '/workspace/build/paper.pdf'
      },
    },
  })
  const runtime = createRuntime({
    workflowStore: {
      session: {
        activeFile: '/workspace/paper.tex',
        previewSourcePath: '/workspace/paper.tex',
        previewKind: 'pdf',
        state: 'workspace-preview',
      },
      getPreferredPreviewKind() {
        return null
      },
      getWorkspacePreviewRequestForFile(filePath) {
        return filePath === '/workspace/paper.tex' ? 'pdf' : null
      },
      isWorkspacePreviewHiddenForFile() {
        return false
      },
    },
    latexStore: {
      stateForFile() {
        return { pdfPath: '/workspace/build/paper.pdf' }
      },
    },
  })

  const context = runtime.buildAdapterContext('/workspace/paper.tex', {
    adapter,
    workflowOnly: false,
  })

  assert.equal(context.previewKind, 'pdf')
  assert.equal(context.previewState.previewMode, 'pdf-artifact')
  assert.equal(context.previewState.previewTargetPath, '/workspace/build/paper.pdf')
})
