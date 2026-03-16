import test from 'node:test'
import assert from 'node:assert/strict'

import { EditorSelection, EditorState } from '@codemirror/state'

import {
  insertCitationWithAssist,
  maybePromptLatexBibliography,
} from '../src/services/latexCitationAssist.js'

function createMockView(doc, selection = EditorSelection.cursor(doc.length)) {
  let state = EditorState.create({ doc, selection })
  return {
    get state() {
      return state
    },
    dispatch(spec) {
      state = state.update(spec).state
    },
    focus() {},
  }
}

function createToastStore() {
  return {
    shown: [],
    success: [],
    show(message, options = {}) {
      this.success.push({ message, options })
    },
    showOnce(key, message, options = {}, cooldown) {
      this.shown.push({ key, message, options, cooldown })
    },
  }
}

test('insertCitationWithAssist prompts for bibliography after inserting a LaTeX citation', () => {
  const view = createMockView('\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n')
  const toastStore = createToastStore()

  const inserted = insertCitationWithAssist({
    view,
    filePath: '/tmp/paper.tex',
    keys: 'an2026',
    t: (key) => key,
    toastStore,
  })

  assert.equal(inserted, '\\cite{an2026}')
  assert.match(view.state.doc.toString(), /\\cite\{an2026\}/)
  assert.equal(toastStore.shown.length, 1)
  assert.equal(toastStore.shown[0].key, 'latex-bibliography:/tmp/paper.tex')

  toastStore.shown[0].options.action.onClick()

  assert.match(view.state.doc.toString(), /\\bibliographystyle\{plain\}/)
  assert.match(view.state.doc.toString(), /\\bibliography\{references\}/)
  assert.equal(toastStore.success.length, 1)
})

test('maybePromptLatexBibliography stays silent when bibliography is already declared', () => {
  const view = createMockView('\\begin{document}\nHello \\cite{an2026}\n\\bibliography{references}\n\\end{document}\n')
  const toastStore = createToastStore()

  const prompted = maybePromptLatexBibliography({
    view,
    filePath: '/tmp/paper.tex',
    t: (key) => key,
    toastStore,
  })

  assert.equal(prompted, false)
  assert.equal(toastStore.shown.length, 0)
})

test('maybePromptLatexBibliography ignores non-LaTeX files', () => {
  const view = createMockView('Hello [@an2026]\n')
  const toastStore = createToastStore()

  const prompted = maybePromptLatexBibliography({
    view,
    filePath: '/tmp/notes.md',
    t: (key) => key,
    toastStore,
  })

  assert.equal(prompted, false)
  assert.equal(toastStore.shown.length, 0)
})
