import test from 'node:test'
import assert from 'node:assert/strict'

import { createChatPersistenceRuntime } from '../src/domains/chat/chatPersistenceRuntime.js'

function createHarness(overrides = {}) {
  const state = {
    sessions: [],
    activeSessionId: 'active',
    allSessionsMeta: [],
    pendingPrefill: 'prefill',
    pendingSelection: 'selection',
    richHtmlMap: { a: '<p>a</p>' },
  }
  const disposed = []
  const invokeCalls = []
  const createdSessions = []
  const artifactClears = []
  const workflowClears = []
  const syncedSessions = []
  const warnings = []

  const invokeImpl = async (command, payload) => {
    invokeCalls.push({ command, payload })
    switch (command) {
      case 'path_exists':
        return true
      case 'read_dir_recursive':
        return []
      case 'read_file':
        return '{}'
      case 'create_dir':
        return null
      case 'write_file':
        return null
      default:
        throw new Error(`Unhandled command: ${command}`)
    }
  }

  const runtime = createChatPersistenceRuntime({
    getShouldersDir: () => '/workspace/.altals',
    disposeAllChatInstances: () => disposed.push(true),
    replaceSessions: (sessions) => {
      state.sessions = sessions
    },
    setActiveSessionId: (sessionId) => {
      state.activeSessionId = sessionId
    },
    getAllSessionsMeta: () => state.allSessionsMeta,
    replaceAllSessionsMeta: (meta) => {
      state.allSessionsMeta = meta
    },
    clearAiArtifactsAll: () => artifactClears.push(true),
    clearAiWorkflowRunsAll: () => workflowClears.push(true),
    createSession: () => {
      createdSessions.push(true)
      state.sessions = [{ id: 'new-session', label: 'New chat', messages: [] }]
      state.activeSessionId = 'new-session'
      return 'new-session'
    },
    getSession: (id) => state.sessions.find((session) => session.id === id) || null,
    getChatInstance: () => null,
    syncRunToSession: (session) => {
      syncedSessions.push(session.id)
      return { workflow: session.id }
    },
    cleanPartsForStorage: (parts = []) => parts.map((part) => ({ ...part, cleaned: true })),
    buildPersistedChatSessionData: (session, messages) => ({
      id: session.id,
      label: session.label,
      updatedAt: session.updatedAt || '2026-03-22T00:00:00.000Z',
      messages,
      workflow: session._workflow || null,
    }),
    buildPersistedChatSessionMeta: (data, untitled) => ({
      id: data.id,
      label: data.label || untitled,
      updatedAt: data.updatedAt,
      messageCount: data.messages?.length || 0,
    }),
    untitledLabel: () => 'Untitled',
    invoke: invokeImpl,
    clearPendingPrefill: () => {
      state.pendingPrefill = null
    },
    clearPendingSelection: () => {
      state.pendingSelection = null
    },
    clearRichHtmlMap: () => {
      state.richHtmlMap = {}
    },
    warn: (...args) => warnings.push(args),
    ...overrides,
  })

  return {
    state,
    runtime,
    disposed,
    invokeCalls,
    createdSessions,
    artifactClears,
    workflowClears,
    syncedSessions,
    warnings,
  }
}

test('chat persistence runtime loads and sorts persisted session metadata', async () => {
  const { state, runtime } = createHarness({
    invoke: async (command, payload) => {
      switch (command) {
        case 'path_exists':
          return true
        case 'read_dir_recursive':
          return [
            { path: '/workspace/.altals/chats/older.json', name: 'older.json', is_dir: false },
            { path: '/workspace/.altals/chats/bad.json', name: 'bad.json', is_dir: false },
            { path: '/workspace/.altals/chats/newer.json', name: 'newer.json', is_dir: false },
            { path: '/workspace/.altals/chats/skip.txt', name: 'skip.txt', is_dir: false },
          ]
        case 'read_file':
          if (payload.path.endsWith('older.json')) {
            return JSON.stringify({ id: 'older', label: 'Older', updatedAt: '2026-03-20T00:00:00.000Z', messages: [] })
          }
          if (payload.path.endsWith('newer.json')) {
            return JSON.stringify({ id: 'newer', label: 'Newer', updatedAt: '2026-03-21T00:00:00.000Z', messages: [1] })
          }
          if (payload.path.endsWith('bad.json')) {
            return '{'
          }
          return '{}'
        default:
          return null
      }
    },
  })

  await runtime.loadAllSessionsMeta()

  assert.deepEqual(state.allSessionsMeta.map((meta) => meta.id), ['newer', 'older'])
  assert.deepEqual(state.allSessionsMeta.map((meta) => meta.messageCount), [1, 0])
})

test('chat persistence runtime saves a session and updates metadata', async () => {
  const { state, runtime, invokeCalls, syncedSessions } = createHarness({
    invoke: async (command, payload) => {
      invokeCalls.push({ command, payload })
      if (command === 'path_exists') return false
      return null
    },
    getChatInstance: () => ({
      state: {
        messagesRef: {
          value: [
            { id: 'm1', parts: [{ type: 'text', text: 'hello' }] },
          ],
        },
      },
    }),
  })

  state.sessions = [{
    id: 'session-1',
    label: 'Session 1',
    updatedAt: '2026-03-22T12:00:00.000Z',
    messages: [],
    _workflow: null,
  }]

  await runtime.saveSession('session-1')

  assert.deepEqual(syncedSessions, ['session-1'])
  assert.equal(state.sessions[0]._workflow.workflow, 'session-1')
  assert.equal(state.allSessionsMeta.length, 1)
  assert.equal(state.allSessionsMeta[0].id, 'session-1')
  const createDirCall = invokeCalls.find((call) => call.command === 'create_dir')
  const writeFileCall = invokeCalls.find((call) => call.command === 'write_file')
  assert.equal(createDirCall.payload.path, '/workspace/.altals/chats')
  assert.equal(writeFileCall.payload.path, '/workspace/.altals/chats/session-1.json')
  assert.match(writeFileCall.payload.content, /"cleaned": true/)
})

test('chat persistence runtime resets live state before loading sessions', async () => {
  const { state, runtime, disposed, createdSessions, artifactClears, workflowClears } = createHarness({
    invoke: async (command) => {
      if (command === 'path_exists') return false
      if (command === 'read_dir_recursive') return []
      return null
    },
  })

  state.sessions = [{ id: 'old' }]
  state.allSessionsMeta = [{ id: 'old' }]

  await runtime.loadSessions()

  assert.equal(disposed.length, 1)
  assert.equal(createdSessions.length, 1)
  assert.equal(state.activeSessionId, 'new-session')
  assert.deepEqual(state.sessions.map((session) => session.id), ['new-session'])
  assert.equal(artifactClears.length, 1)
  assert.equal(workflowClears.length, 1)
})

test('chat persistence runtime cleanup clears refs and external state', () => {
  const { state, runtime, disposed, artifactClears, workflowClears } = createHarness()

  state.sessions = [{ id: 'old' }]
  state.allSessionsMeta = [{ id: 'old' }]

  runtime.cleanup()

  assert.equal(disposed.length, 1)
  assert.deepEqual(state.sessions, [])
  assert.equal(state.activeSessionId, null)
  assert.deepEqual(state.allSessionsMeta, [])
  assert.equal(state.pendingPrefill, null)
  assert.equal(state.pendingSelection, null)
  assert.deepEqual(state.richHtmlMap, {})
  assert.equal(artifactClears.length, 1)
  assert.equal(workflowClears.length, 1)
})
