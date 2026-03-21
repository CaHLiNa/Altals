import test from 'node:test'
import assert from 'node:assert/strict'
import { CompletionContext } from '@codemirror/autocomplete'
import { ensureSyntaxTree } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { createMarkdownDraftSnippetSource } from '../src/editor/markdownSnippets.js'

async function getCompletionResult(doc, pos = doc.length) {
  const state = EditorState.create({
    doc,
    extensions: [markdown()],
  })
  ensureSyntaxTree(state, pos, 1000)
  const source = createMarkdownDraftSnippetSource((value) => value)
  return source(new CompletionContext(state, pos, true))
}

test('markdown slash commands trigger at top level, list items, and blockquotes', async () => {
  const cases = [
    '/h',
    '- /h',
    '1. /h',
    '> /h',
    '> - /h',
  ]

  for (const doc of cases) {
    const result = await getCompletionResult(doc)
    assert.ok(result, `expected completion for "${doc}"`)
    assert.ok(result.options.some((option) => option.label === '/h1'), `expected /h1 option for "${doc}"`)
  }
})

test('markdown slash commands do not trigger after normal list content', async () => {
  const result = await getCompletionResult('- note /h')
  assert.equal(result, null)
})

test('markdown slash commands stay disabled inside fenced code blocks', async () => {
  const doc = '```md\n/h\n```'
  const pos = doc.indexOf('/h') + 2
  const result = await getCompletionResult(doc, pos)
  assert.equal(result, null)
})
