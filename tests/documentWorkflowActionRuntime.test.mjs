import test from 'node:test'
import assert from 'node:assert/strict'

import { createDocumentWorkflowActionRuntime } from '../src/domains/document/documentWorkflowActionRuntime.js'

function createRuntime({
  workflowStore = {},
  buildOperationRuntime = {},
  typstPaneRuntime = {},
} = {}) {
  return createDocumentWorkflowActionRuntime({
    getWorkflowStore: () => workflowStore,
    getBuildOperationRuntime: () => buildOperationRuntime,
    getTypstPaneRuntime: () => typstPaneRuntime,
  })
}

test('document workflow action runtime routes markdown preview toggles through workspace preview state', async () => {
  const workspaceCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: false, previewMode: null }
      },
      showWorkspacePreviewForFile(filePath, options = {}) {
        workspaceCalls.push({ filePath, options })
        return { type: 'workspace-preview' }
      },
    },
  })

  const result = await runtime.runPrimaryActionForFile('/workspace/chapter.md', {
    uiState: { kind: 'markdown' },
    sourcePaneId: 'pane-source',
  })

  assert.deepEqual(workspaceCalls, [{
    filePath: '/workspace/chapter.md',
    options: {
      previewKind: 'html',
      sourcePaneId: 'pane-source',
      trigger: 'markdown-preview-toggle',
    },
  }])
  assert.deepEqual(result, { type: 'workspace-preview' })
})

test('document workflow action runtime hides markdown preview when it is already visible', async () => {
  const hideCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: true, previewMode: 'markdown' }
      },
      hideWorkspacePreviewForFile(filePath) {
        hideCalls.push(filePath)
        return { type: 'workspace-preview-hidden' }
      },
    },
  })

  const result = await runtime.toggleMarkdownPreviewForFile('/workspace/chapter.md')

  assert.deepEqual(hideCalls, ['/workspace/chapter.md'])
  assert.deepEqual(result, { type: 'workspace-preview-hidden' })
})

test('document workflow action runtime routes compile primary actions through the build operation runtime', async () => {
  const buildCalls = []
  const runtime = createRuntime({
    buildOperationRuntime: {
      async runBuildForFile(filePath, options = {}) {
        buildCalls.push({ filePath, options })
        return { ok: true }
      },
    },
  })

  const result = await runtime.runPrimaryActionForFile('/workspace/main.typ', {
    uiState: { kind: 'typst' },
    sourcePaneId: 'pane-source',
    buildOptions: {
      adapter: { kind: 'typst' },
      workflowOnly: false,
    },
  })

  assert.deepEqual(buildCalls, [{
    filePath: '/workspace/main.typ',
    options: {
      adapter: { kind: 'typst' },
      workflowOnly: false,
      sourcePaneId: 'pane-source',
      trigger: 'typst-compile-button',
    },
  }])
  assert.deepEqual(result, { ok: true })
})

test('document workflow action runtime reveals previews inside the workspace instead of opening panes', async () => {
  const workspaceCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: false, previewMode: null }
      },
      async showWorkspacePreviewForFile(filePath, options = {}) {
        workspaceCalls.push({ filePath, options })
        return { type: 'workspace-preview', previewKind: options.previewKind }
      },
    },
  })

  const result = await runtime.revealPreviewForFile('/workspace/main.typ', {
    uiState: { kind: 'typst', previewKind: 'native' },
    sourcePaneId: 'pane-source',
    buildOptions: { adapter: { kind: 'typst' } },
  })

  assert.deepEqual(workspaceCalls, [{
    filePath: '/workspace/main.typ',
    options: {
      previewKind: 'native',
      sourcePaneId: 'pane-source',
      trigger: 'workflow-toggle-preview',
    },
  }])
  assert.deepEqual(result, { type: 'workspace-preview', previewKind: 'native' })
})

test('document workflow action runtime reveals non-typst previews through workspace preview state', async () => {
  const workspaceCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: false, previewMode: null }
      },
      async showWorkspacePreviewForFile(filePath, options = {}) {
        workspaceCalls.push({ filePath, options })
        return { type: 'workspace-preview' }
      },
    },
  })

  await runtime.revealPreviewForFile('/workspace/main.tex', {
    uiState: { kind: 'latex', previewKind: 'pdf' },
    sourcePaneId: 'pane-source',
  })

  assert.deepEqual(workspaceCalls, [{
    filePath: '/workspace/main.tex',
    options: {
      previewKind: 'pdf',
      sourcePaneId: 'pane-source',
      trigger: 'workflow-toggle-preview',
    },
  }])
})

test('document workflow action runtime hides non-markdown preview when the same mode is already visible', async () => {
  const hideCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: true, previewMode: 'pdf' }
      },
      hideWorkspacePreviewForFile(filePath) {
        hideCalls.push(filePath)
        return { type: 'workspace-preview-hidden' }
      },
    },
  })

  const result = await runtime.revealPreviewForFile('/workspace/main.tex', {
    uiState: { kind: 'latex', previewKind: 'pdf' },
  })

  assert.deepEqual(hideCalls, ['/workspace/main.tex'])
  assert.deepEqual(result, { type: 'workspace-preview-hidden' })
})

test('document workflow action runtime switches PDF preview mode inside the workspace', () => {
  const pdfCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: false, previewMode: null }
      },
      switchWorkspacePreviewModeForFile(filePath, options = {}) {
        pdfCalls.push({ filePath, options })
        return { type: 'workspace-preview', previewKind: options.previewKind }
      },
    },
  })

  const previewResult = runtime.togglePdfPreviewForFile('/workspace/main.tex', {
    sourcePaneId: 'pane-source',
    adapterKind: 'latex',
  })
  const typstResult = runtime.revealPdfForFile('/workspace/main.typ', {
    uiState: { kind: 'typst' },
    sourcePaneId: 'pane-source',
    buildOptions: { adapter: { kind: 'typst' } },
  })

  assert.deepEqual(pdfCalls, [{
    filePath: '/workspace/main.tex',
    options: {
      previewKind: 'pdf',
      sourcePaneId: 'pane-source',
      trigger: 'latex-preview-toggle',
    },
  }, {
    filePath: '/workspace/main.typ',
    options: {
      previewKind: 'pdf',
      sourcePaneId: 'pane-source',
      trigger: 'typst-pdf-toggle',
    },
  }])
  assert.deepEqual(previewResult, { type: 'workspace-preview', previewKind: 'pdf' })
  assert.deepEqual(typstResult, { type: 'workspace-preview', previewKind: 'pdf' })
})

test('document workflow action runtime hides PDF preview when the PDF mode is already visible', () => {
  const hideCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: true, previewMode: 'pdf' }
      },
      hideWorkspacePreviewForFile(filePath) {
        hideCalls.push(filePath)
        return { type: 'workspace-preview-hidden' }
      },
    },
  })

  const result = runtime.togglePdfPreviewForFile('/workspace/main.tex')

  assert.deepEqual(hideCalls, ['/workspace/main.tex'])
  assert.deepEqual(result, { type: 'workspace-preview-hidden' })
})

test('document workflow action runtime lets typst PDF button close the current PDF preview', () => {
  const hideCalls = []
  const runtime = createRuntime({
    workflowStore: {
      getWorkspacePreviewStateForFile() {
        return { previewVisible: true, previewMode: 'pdf' }
      },
      hideWorkspacePreviewForFile(filePath) {
        hideCalls.push(filePath)
        return { type: 'workspace-preview-hidden' }
      },
    },
  })

  const result = runtime.revealPdfForFile('/workspace/main.typ', {
    uiState: { kind: 'typst' },
  })

  assert.deepEqual(hideCalls, ['/workspace/main.typ'])
  assert.deepEqual(result, { type: 'workspace-preview-hidden' })
})
