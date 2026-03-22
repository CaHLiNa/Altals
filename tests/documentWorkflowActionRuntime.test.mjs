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

test('document workflow action runtime routes markdown preview toggles through the workflow store', async () => {
  const toggleCalls = []
  const runtime = createRuntime({
    workflowStore: {
      togglePreviewForSource(filePath, options = {}) {
        toggleCalls.push({ filePath, options })
        return { type: 'ready-existing' }
      },
    },
  })

  const result = await runtime.runPrimaryActionForFile('/workspace/chapter.md', {
    uiState: { kind: 'markdown' },
    sourcePaneId: 'pane-source',
  })

  assert.deepEqual(toggleCalls, [{
    filePath: '/workspace/chapter.md',
    options: {
      previewKind: 'html',
      activatePreview: true,
      sourcePaneId: 'pane-source',
      trigger: 'markdown-preview-toggle',
    },
  }])
  assert.deepEqual(result, { type: 'ready-existing' })
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

test('document workflow action runtime delegates typst preview reveal to the typst pane runtime', async () => {
  const typstCalls = []
  const runtime = createRuntime({
    typstPaneRuntime: {
      async revealPreviewForFile(filePath, options = {}) {
        typstCalls.push({ filePath, options })
        return { type: 'typst-preview' }
      },
    },
  })

  const result = await runtime.revealPreviewForFile('/workspace/main.typ', {
    uiState: { kind: 'typst', previewKind: 'native' },
    sourcePaneId: 'pane-source',
    buildOptions: { adapter: { kind: 'typst' } },
  })

  assert.deepEqual(typstCalls, [{
    filePath: '/workspace/main.typ',
    options: {
      sourcePaneId: 'pane-source',
      buildOptions: { adapter: { kind: 'typst' } },
    },
  }])
  assert.deepEqual(result, { type: 'typst-preview' })
})

test('document workflow action runtime reveals non-typst previews through the workflow store with jump semantics', async () => {
  const toggleCalls = []
  const runtime = createRuntime({
    workflowStore: {
      async togglePreviewForSource(filePath, options = {}) {
        toggleCalls.push({ filePath, options })
        return { type: 'ready-existing' }
      },
    },
  })

  await runtime.revealPreviewForFile('/workspace/main.tex', {
    uiState: { kind: 'latex', previewKind: 'pdf' },
    sourcePaneId: 'pane-source',
  })

  assert.deepEqual(toggleCalls, [{
    filePath: '/workspace/main.tex',
    options: {
      previewKind: 'pdf',
      activatePreview: true,
      jump: true,
      sourcePaneId: 'pane-source',
      trigger: 'workflow-toggle-preview',
    },
  }])
})

test('document workflow action runtime delegates typst PDF reveal and generic PDF preview toggles appropriately', () => {
  const toggleCalls = []
  const typstCalls = []
  const runtime = createRuntime({
    workflowStore: {
      togglePreviewForSource(filePath, options = {}) {
        toggleCalls.push({ filePath, options })
        return { type: 'opened-pdf-preview' }
      },
    },
    typstPaneRuntime: {
      revealPdfForFile(filePath, options = {}) {
        typstCalls.push({ filePath, options })
        return { type: 'typst-pdf' }
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

  assert.deepEqual(toggleCalls, [{
    filePath: '/workspace/main.tex',
    options: {
      previewKind: 'pdf',
      activatePreview: true,
      sourcePaneId: 'pane-source',
      trigger: 'latex-preview-toggle',
    },
  }])
  assert.deepEqual(typstCalls, [{
    filePath: '/workspace/main.typ',
    options: {
      sourcePaneId: 'pane-source',
      buildOptions: { adapter: { kind: 'typst' } },
    },
  }])
  assert.deepEqual(previewResult, { type: 'opened-pdf-preview' })
  assert.deepEqual(typstResult, { type: 'typst-pdf' })
})
