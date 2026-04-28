import { isLatex } from '../../../utils/fileTypes.js'

function buildDefaultLatexPreviewPath(sourcePath = '') {
  const normalized = String(sourcePath || '').trim()
  return normalized.replace(/\.(tex|latex)$/i, '.pdf')
}

function resolveKnownLatexArtifactPath(sourcePath, context = {}) {
  const state = latexCompileAdapter.stateForFile(sourcePath, context) || null
  return (
    state?.previewPath ||
    state?.pdfPath ||
    context.workflowStore?.getLatexArtifactPathForFile?.(sourcePath) ||
    ''
  )
}

const latexPreviewAdapter = {
  defaultKind: null,
  supportedKinds: ['pdf'],

  createPath() {
    return null
  },

  inferKind() {
    return null
  },

  getTargetPath(sourcePath, context) {
    return (
      resolveKnownLatexArtifactPath(sourcePath, context) ||
      buildDefaultLatexPreviewPath(sourcePath) ||
      ''
    )
  },

  ensure(sourcePath, context, options = {}) {
    void sourcePath
    void context
    void options
    return null
  },

  reveal(sourcePath, context, options = {}) {
    void sourcePath
    void context
    void options
    return null
  },
}

const latexCompileAdapter = {
  id: 'latex',

  stateForFile(filePath, context) {
    return context.latexStore?.stateForFile(filePath) || null
  },

  async ensureReady(_filePath) {
    const { ensureLatexCompileReady } =
      await import('../../environmentPreflight.js')
    return ensureLatexCompileReady()
  },

  async compile(filePath, context, options = {}) {
    if (!context.latexStore) return null
    if (!(await this.ensureReady(filePath, context, options))) return null

    await context.latexStore.compile(filePath, options)
    return this.stateForFile(filePath, context)
  },

  openLog(filePath, context) {
    context.latexStore?.openCompileLog(filePath)
  },
}

export const latexDocumentAdapter = {
  kind: 'latex',

  matchesFile(filePath) {
    return isLatex(filePath)
  },

  supportsWorkflowSource(filePath) {
    return isLatex(filePath)
  },

  preview: latexPreviewAdapter,
  compile: latexCompileAdapter,
}
