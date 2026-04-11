import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getViewerType,
  isBibFile,
  isBinaryFile,
  isLatex,
  isLatexEditorFile,
} from '../src/utils/fileTypes.js'

test('getViewerType treats txt, bib, and LaTeX sidecar files as text', () => {
  for (const filePath of [
    '/workspace/notes.txt',
    '/workspace/references.bib',
    '/workspace/article.cls',
    '/workspace/layout.sty',
    '/workspace/main.log',
    '/workspace/main.aux',
    '/workspace/main.bbl',
    '/workspace/main.blg',
    '/workspace/main.out',
    '/workspace/main.toc',
  ]) {
    assert.equal(getViewerType(filePath), 'text')
  }
})

test('getViewerType routes raw pdf files to the embedded pdf viewer', () => {
  assert.equal(getViewerType('/workspace/paper.pdf'), 'pdf')
})

test('pdf files remain binary while bib files remain editable text', () => {
  assert.equal(isBinaryFile('/workspace/paper.pdf'), true)
  assert.equal(isBinaryFile('/workspace/references.bib'), false)
  assert.equal(isBibFile('/workspace/references.bib'), true)
})

test('latex editor files include cls and sty without promoting them to compile targets', () => {
  assert.equal(isLatex('/workspace/article.tex'), true)
  assert.equal(isLatex('/workspace/article.cls'), false)
  assert.equal(isLatex('/workspace/layout.sty'), false)
  assert.equal(isLatexEditorFile('/workspace/article.tex'), true)
  assert.equal(isLatexEditorFile('/workspace/article.cls'), true)
  assert.equal(isLatexEditorFile('/workspace/layout.sty'), true)
})
