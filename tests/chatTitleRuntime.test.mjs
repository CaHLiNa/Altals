import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSmartChatSessionLabel,
  createChatTitleRuntime,
  extractTitleTextFromParts,
} from '../src/domains/chat/chatTitleRuntime.js'

function createHarness({
  session = { id: 's1', label: 'Chat 1' },
  messages = [
    { role: 'user', parts: [{ type: 'text', text: 'User asks a question' }] },
    { role: 'assistant', parts: [{ type: 'text', text: 'Assistant answers here' }] },
  ],
  skipAutoTitle = false,
  generatedText = '{"title":"Short title","keywords":["alpha","beta"]}',
} = {}) {
  const state = {
    sessions: [session],
    saved: [],
    warnings: [],
    calls: [],
  }
  const chat = {
    state: {
      messagesRef: { value: messages },
    },
  }

  const runtime = createChatTitleRuntime({
    getChatInstance: (id) => (id === session.id ? chat : null),
    getLiveSession: (id) => state.sessions.find((item) => item.id === id) || null,
    shouldSkipAutoTitleForSession: () => skipAutoTitle,
    getWorkspace: () => ({ path: '/workspace/demo' }),
    generateWorkspaceText: async (payload) => {
      state.calls.push(payload)
      return { text: generatedText }
    },
    saveSession: (id) => state.saved.push(id),
    getTitleSystemPrompt: () => 'system prompt',
    warn: (...args) => state.warnings.push(args),
  })

  return {
    state,
    session,
    runtime,
  }
}

test('chat title runtime strips helper markup and builds smart labels', () => {
  const text = extractTitleTextFromParts([
    { type: 'text', text: '<file-ref path="/tmp/a.md">\nalpha\n</file-ref>' },
    { type: 'text', text: '<context file="/tmp/a.md">\n<selection>\nbeta\n</selection>\n</context>' },
    { type: 'text', text: 'gamma' },
  ])

  assert.equal(text, 'gamma')
  assert.equal(buildSmartChatSessionLabel('', { untitledLabel: 'Untitled' }), 'Untitled')
  assert.equal(
    buildSmartChatSessionLabel('This is a very long first message that needs truncation', { untitledLabel: 'Untitled' }),
    'This is a very long first message that...'
  )
})

test('chat title runtime generates first-exchange titles and saves keywords', async () => {
  const { state, session, runtime } = createHarness()

  runtime.maybeGenerateTitle(session)
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.equal(state.calls.length, 1)
  assert.equal(session.label, 'Short title')
  assert.equal(session._aiTitle, true)
  assert.deepEqual(session._keywords, ['alpha', 'beta'])
  assert.deepEqual(state.saved, ['s1'])
})

test('chat title runtime skips non-first exchanges and explicit skip cases', async () => {
  const skipped = createHarness({ skipAutoTitle: true })
  skipped.runtime.maybeGenerateTitle(skipped.session)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(skipped.state.calls.length, 0)

  const multiTurn = createHarness({
    messages: [
      { role: 'user', parts: [{ type: 'text', text: 'One' }] },
      { role: 'assistant', parts: [{ type: 'text', text: 'Two' }] },
      { role: 'user', parts: [{ type: 'text', text: 'Three' }] },
    ],
  })
  multiTurn.runtime.maybeGenerateTitle(multiTurn.session)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(multiTurn.state.calls.length, 0)
})

test('chat title runtime falls back to plain text responses', async () => {
  const { session, runtime } = createHarness({
    generatedText: 'Fallback title',
  })

  await runtime.generateTitle(session)

  assert.equal(session.label, 'Fallback title')
  assert.deepEqual(session._keywords, [])
})
