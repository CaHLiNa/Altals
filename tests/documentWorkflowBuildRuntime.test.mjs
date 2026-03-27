import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createDocumentWorkflowBuildRuntime,
  getDocumentWorkflowStatusTone,
} from '../src/domains/document/documentWorkflowBuildRuntime.js'

function createBuildRuntime(overrides = {}) {
  const workflowStore = {
    session: {
      activeFile: null,
      previewKind: null,
    },
    markdownPreviewState: {},
    getPreferredPreviewKind(kind) {
      if (kind === 'latex') return 'pdf'
      if (kind === 'typst') return 'native'
      if (kind === 'markdown') return 'html'
      return null
    },
    ...overrides.workflowStore,
  }

  const latexStore = {
    openCompileLogCalls: [],
    stateForFile() {
      return null
    },
    queueStateForFile() {
      return null
    },
    lintDiagnosticsForFile() {
      return []
    },
    buildRecipeLabelFor(value) {
      return value
    },
    openCompileLog(filePath) {
      this.openCompileLogCalls.push(filePath)
    },
    ...overrides.latexStore,
  }

  const typstStore = {
    openCompileLogCalls: [],
    stateForFile() {
      return null
    },
    queueStateForFile() {
      return null
    },
    liveStateForFile() {
      return null
    },
    openCompileLog(filePath) {
      this.openCompileLogCalls.push(filePath)
    },
    ...overrides.typstStore,
  }

  const filesStore = {
    fileContents: {},
    ...overrides.filesStore,
  }

  const referencesStore = {
    allKeys: [],
    getByKey() {
      return null
    },
    ...overrides.referencesStore,
  }

  const runtime = createDocumentWorkflowBuildRuntime({
    getWorkflowStore: () => workflowStore,
    getEditorStore: () => overrides.editorStore || {},
    getFilesStore: () => filesStore,
    getWorkspaceStore: () => overrides.workspace || {},
    getLatexStore: () => latexStore,
    getTypstStore: () => typstStore,
    getReferencesStore: () => referencesStore,
  })

  return {
    runtime,
    workflowStore,
    latexStore,
    typstStore,
    filesStore,
    referencesStore,
  }
}

test('document workflow build runtime builds latex adapter context from workspace preview state', () => {
  const { runtime } = createBuildRuntime({
    latexStore: {
      stateForFile() {
        return {
          status: 'success',
          pdfPath: '/workspace/main.pdf',
        }
      },
    }
  })

  const context = runtime.buildAdapterContext('/workspace/main.tex')

  assert.equal(context.adapter?.kind, 'latex')
  assert.equal(context.previewKind, 'pdf')
  assert.equal(context.previewAvailable, true)
  assert.equal(context.workspacePreviewState.previewMode, 'pdf')
  assert.equal(context.workspacePreviewState.previewFilePath, '/workspace/main.pdf')
})

test('document workflow build runtime preserves adapter-specific compile log opening', () => {
  const { runtime, latexStore } = createBuildRuntime()

  runtime.openLogForFile('/workspace/main.tex')

  assert.deepEqual(latexStore.openCompileLogCalls, ['/workspace/main.tex'])
})

test('document workflow build runtime preserves markdown draft and preview problems', () => {
  const { runtime } = createBuildRuntime({
    filesStore: {
      fileContents: {
        '/workspace/chapter.md': 'See @missing for details.',
      },
    },
    workflowStore: {
      markdownPreviewState: {
        '/workspace/chapter.md': {
          problems: [
            {
              id: 'preview-1',
              severity: 'error',
              message: 'Preview failed.',
              origin: 'preview',
            },
          ],
        },
      },
    },
  })

  const problems = runtime.getProblemsForFile('/workspace/chapter.md')

  assert.ok(problems.some(problem => (
    problem.origin === 'draft'
    && problem.message.includes('Prefer [@missing]')
  )))
  assert.ok(problems.some(problem => (
    problem.origin === 'draft'
    && problem.message.includes('Unknown citation key: missing')
  )))
  assert.ok(problems.some(problem => (
    problem.origin === 'preview'
    && problem.message === 'Preview failed.'
  )))
})

test('document workflow build runtime exposes queued latex ui state and status tone outside the store shell', () => {
  const { runtime } = createBuildRuntime({
    latexStore: {
      stateForFile() {
        return {
          status: 'success',
          pdfPath: '/workspace/main.pdf',
        }
      },
      queueStateForFile() {
        return { phase: 'queued' }
      },
    },
  })

  const uiState = runtime.getUiStateForFile('/workspace/main.tex')

  assert.equal(uiState?.kind, 'latex')
  assert.equal(uiState?.phase, 'queued')
  assert.equal(uiState?.canRevealPreview, true)
  assert.equal(runtime.getStatusTextForFile('/workspace/main.tex'), 'Queued')
  assert.equal(getDocumentWorkflowStatusTone(uiState), 'warning')
})

test('document workflow build runtime keeps latex preview action available when preview is hidden', () => {
  const { runtime, workflowStore } = createBuildRuntime({
    latexStore: {
      stateForFile() {
        return {
          status: 'success',
          pdfPath: '/workspace/main.pdf',
        }
      },
    },
  })

  workflowStore.isWorkspacePreviewHiddenForFile = (filePath) => filePath === '/workspace/main.tex'

  const context = runtime.buildAdapterContext('/workspace/main.tex')
  const uiState = runtime.getUiStateForFile('/workspace/main.tex')

  assert.equal(context.previewAvailable, true)
  assert.equal(context.previewVisible, false)
  assert.equal(context.workspacePreviewState.previewVisible, false)
  assert.equal(uiState?.canRevealPreview, true)
})

test('document workflow build runtime exposes adapter-specific artifact paths outside the store shell', () => {
  const { runtime } = createBuildRuntime({
    typstStore: {
      stateForFile() {
        return {
          pdfPath: '/workspace/main-built.pdf',
        }
      },
    },
  })

  assert.equal(
    runtime.getArtifactPathForFile('/workspace/main.typ'),
    '/workspace/main-built.pdf',
  )
})

test('document workflow build runtime exposes typst workspace preview state without relying on preview tabs', () => {
  const { runtime } = createBuildRuntime({
    typstStore: {
      stateForFile() {
        return null
      },
      liveStateForFile() {
        return { tinymistBacked: true }
      },
    },
  })

  const previewState = runtime.getWorkspacePreviewStateForFile('/workspace/main.typ')

  assert.equal(previewState.useWorkspace, true)
  assert.equal(previewState.previewVisible, true)
  assert.equal(previewState.previewMode, 'typst-native')
  assert.equal(previewState.previewFilePath, 'typst-preview:/workspace/main.typ')
})
