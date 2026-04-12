import test from 'node:test'
import assert from 'node:assert/strict'

import { markdownDocumentAdapter } from '../src/services/documentWorkflow/adapters/markdown.js'
import { latexDocumentAdapter } from '../src/services/documentWorkflow/adapters/latex.js'

test('document workflow adapter contracts keep markdown compile seam explicit', () => {
  assert.equal(markdownDocumentAdapter.compile, null)
})

test('document workflow adapter contracts resolve compile artifact paths through compile adapters', () => {
  const latexContext = {
    latexStore: {
      stateForFile() {
        return { pdfPath: '/workspace/main.pdf' }
      },
    },
  }
  assert.equal(
    latexDocumentAdapter.compile.getArtifactPath('/workspace/main.tex', latexContext),
    '/workspace/main.pdf'
  )
})

test('document workflow adapter contracts keep latex preview support explicit', () => {
  assert.deepEqual(latexDocumentAdapter.preview.supportedKinds, ['pdf'])
  assert.equal(latexDocumentAdapter.preview.defaultKind, null)
})
