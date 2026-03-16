import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALTALS_MANAGED_BIB_BEGIN,
  ALTALS_MANAGED_BIB_END,
  buildLatexBibliographyInsertPlan,
  hasLatexBibliographyDirective,
  mergeManagedBibBlock,
  planBibFileSync,
  shouldSyncLatexBibliography,
} from '../src/services/latexBibliography.js'

function applyChanges(doc, changes = []) {
  let next = doc
  for (const change of [...changes].sort((a, b) => b.from - a.from)) {
    next = `${next.slice(0, change.from)}${change.insert}${next.slice(change.to)}`
  }
  return next
}

function createReferencesStore(keys = []) {
  return {
    allKeys: keys,
    exportBibTeX(selectedKeys) {
      return (selectedKeys || []).map((key) => `@article{${key},\n  title = {${key}}\n}`).join('\n\n')
    },
  }
}

test('shouldSyncLatexBibliography stays off for plain tex files without bibliography usage', () => {
  assert.equal(shouldSyncLatexBibliography({ content: '\\documentclass{article}\nHello\n' }), false)
})

test('shouldSyncLatexBibliography turns on for LaTeX citations and bibliography directives', () => {
  assert.equal(shouldSyncLatexBibliography({ content: 'Text \\cite{an2026}' }), true)
  assert.equal(shouldSyncLatexBibliography({ content: '\\printbibliography' }), true)
  assert.equal(shouldSyncLatexBibliography({ content: '', hasExistingBib: true }), true)
})

test('buildLatexBibliographyInsertPlan inserts BibTeX footer before end document by default', () => {
  const source = '\\documentclass{article}\n\\begin{document}\nHello \\cite{an2026}\n\\end{document}\n'
  const plan = buildLatexBibliographyInsertPlan(source)
  const next = applyChanges(source, plan.changes)

  assert.equal(plan.mode, 'bibtex')
  assert.match(next, /\\bibliographystyle\{plain\}/)
  assert.match(next, /\\bibliography\{references\}/)
  assert.ok(next.indexOf('\\bibliography{references}') < next.indexOf('\\end{document}'))
})

test('buildLatexBibliographyInsertPlan completes biblatex documents without duplicating directives', () => {
  const source = '\\documentclass{article}\n\\usepackage[backend=biber]{biblatex}\n\\begin{document}\nHello\n\\end{document}\n'
  const plan = buildLatexBibliographyInsertPlan(source)
  const next = applyChanges(source, plan.changes)

  assert.equal(plan.mode, 'biblatex')
  assert.equal((next.match(/\\usepackage\[backend=biber\]\{biblatex\}/g) || []).length, 1)
  assert.match(next, /\\addbibresource\{references\.bib\}/)
  assert.match(next, /\\printbibliography/)
})

test('mergeManagedBibBlock preserves user content outside the Altals block', () => {
  const existing = '@article{user2020,\n  title = {User}\n}\n'
  const merged = mergeManagedBibBlock(existing, '@article{an2026,\n  title = {an2026}\n}')

  assert.match(merged, /@article\{user2020/)
  assert.match(merged, new RegExp(ALTALS_MANAGED_BIB_BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(merged, /@article\{an2026/)
  assert.match(merged, new RegExp(ALTALS_MANAGED_BIB_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('planBibFileSync keeps existing user entries and excludes duplicate managed keys', () => {
  const sourceContent = '\\begin{document}\nHello \\cite{an2026}\n\\bibliography{references}\n\\end{document}\n'
  const existingBib = '@article{an2026,\n  title = {User owned}\n}\n'
  const plan = planBibFileSync({
    sourcePath: '/tmp/paper.tex',
    sourceContent,
    existingBibContent: existingBib,
    referencesStore: createReferencesStore(['an2026', 'liu2024']),
  })

  assert.equal(plan.shouldSync, true)
  assert.equal(plan.shouldWrite, true)
  assert.match(plan.nextContent, /@article\{an2026,\n  title = \{User owned\}/)
  assert.equal((plan.nextContent.match(/@article\{an2026/g) || []).length, 1)
  assert.match(plan.nextContent, /@article\{liu2024/)
})

test('planBibFileSync skips file creation when tex file has no bibliography usage', () => {
  const plan = planBibFileSync({
    sourcePath: '/tmp/paper.tex',
    sourceContent: '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}\n',
    existingBibContent: null,
    referencesStore: createReferencesStore(['an2026']),
  })

  assert.equal(plan.shouldSync, false)
  assert.equal(plan.shouldWrite, false)
  assert.equal(plan.nextContent, null)
})
