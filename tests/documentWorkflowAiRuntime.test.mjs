import test from 'node:test'
import assert from 'node:assert/strict'

import { createDocumentWorkflowAiRuntime } from '../src/domains/document/documentWorkflowAiRuntime.js'

function createRuntime() {
  const fixTaskCalls = []
  const diagnoseTaskCalls = []
  const launchCalls = []

  const runtime = createDocumentWorkflowAiRuntime({
    launchAiTaskImpl: async (payload) => {
      launchCalls.push(payload)
      return `session-${launchCalls.length}`
    },
    createFixTaskImpl: (options = {}) => {
      fixTaskCalls.push(options)
      return { kind: 'fix', ...options }
    },
    createDiagnoseTaskImpl: (options = {}) => {
      diagnoseTaskCalls.push(options)
      return { kind: 'diagnose', ...options }
    },
  })

  return {
    runtime,
    fixTaskCalls,
    diagnoseTaskCalls,
    launchCalls,
  }
}

test('document workflow ai runtime launches fix tasks through the existing workflow launcher with document-workflow metadata', async () => {
  const { runtime, fixTaskCalls, launchCalls } = createRuntime()
  const editorStore = { id: 'editor' }
  const chatStore = { id: 'chat' }

  const result = await runtime.launchFixForFile('/workspace/main.tex', {
    editorStore,
    chatStore,
    paneId: 'pane-source',
    beside: true,
  })

  assert.equal(result, 'session-1')
  assert.deepEqual(fixTaskCalls, [{
    filePath: '/workspace/main.tex',
    source: 'document-workflow',
    entryContext: 'document-workflow',
  }])
  assert.deepEqual(launchCalls, [{
    editorStore,
    chatStore,
    paneId: 'pane-source',
    beside: true,
    surface: 'drawer',
    modelId: undefined,
    task: {
      kind: 'fix',
      filePath: '/workspace/main.tex',
      source: 'document-workflow',
      entryContext: 'document-workflow',
    },
  }])
})

test('document workflow ai runtime launches diagnose tasks without changing the shared patch-first launcher semantics', async () => {
  const { runtime, diagnoseTaskCalls, launchCalls } = createRuntime()

  await runtime.launchDiagnoseForFile('/workspace/main.typ', {
    editorStore: { id: 'editor' },
    chatStore: { id: 'chat' },
    paneId: 'pane-source',
    beside: false,
    surface: 'workbench',
    modelId: 'gpt-5.4',
  })

  assert.deepEqual(diagnoseTaskCalls, [{
    filePath: '/workspace/main.typ',
    source: 'document-workflow',
    entryContext: 'document-workflow',
  }])
  assert.deepEqual(launchCalls, [{
    editorStore: { id: 'editor' },
    chatStore: { id: 'chat' },
    paneId: 'pane-source',
    beside: false,
    surface: 'workbench',
    modelId: 'gpt-5.4',
    task: {
      kind: 'diagnose',
      filePath: '/workspace/main.typ',
      source: 'document-workflow',
      entryContext: 'document-workflow',
    },
  }])
})

test('document workflow ai runtime ignores unsupported document types', async () => {
  const { runtime, fixTaskCalls, diagnoseTaskCalls, launchCalls } = createRuntime()

  const fixResult = await runtime.launchFixForFile('/workspace/chapter.md')
  const diagnoseResult = await runtime.launchDiagnoseForFile('/workspace/chapter.md')

  assert.equal(fixResult, null)
  assert.equal(diagnoseResult, null)
  assert.deepEqual(fixTaskCalls, [])
  assert.deepEqual(diagnoseTaskCalls, [])
  assert.deepEqual(launchCalls, [])
})
