import test from 'node:test'
import assert from 'node:assert/strict'

import { createChatLiveInstanceRuntime } from '../src/domains/chat/chatLiveInstanceRuntime.js'

class FakeChat {
  constructor(options) {
    this.options = options
    this.state = {
      messagesRef: { value: options.messages ? [...options.messages] : [] },
      statusRef: { value: 'ready' },
      popMessage: () => {
        this.state.messagesRef.value.pop()
      },
      pushMessage: (message) => {
        this.state.messagesRef.value.push(message)
      },
    }
  }
}

function createHarness({ background = false } = {}) {
  const chatMap = new Map()
  const watchCalls = []
  const syncedArtifacts = []
  const savedSessions = []
  const titledSessions = []
  const removedSessions = []
  const stoppedArtifactSync = []
  let instanceMutations = 0

  const session = {
    id: 's1',
    label: 'Chat 1',
    _savedMessages: [{ id: 'm1', role: 'user', parts: [] }],
    ...(background ? { _background: true } : {}),
  }

  const runtime = createChatLiveInstanceRuntime({
    getChatInstanceById: (id) => chatMap.get(id) || null,
    setChatInstance: (id, chat) => {
      chatMap.set(id, chat)
    },
    createChatTransportImpl: (factory) => ({ factory }),
    buildConfig: async () => ({ runtimeId: 'native' }),
    ChatCtor: FakeChat,
    sendAutomaticallyWhen: 'auto',
    watchImpl: (source, callback, options) => {
      watchCalls.push({ source, callback, options })
      if (options?.immediate) callback()
      return () => {
        stoppedArtifactSync.push(true)
      }
    },
    syncSessionArtifacts: (sessionArg, messages) => {
      syncedArtifacts.push({ id: sessionArg.id, count: messages.length })
    },
    saveSession: (id) => savedSessions.push(id),
    maybeGenerateTitle: (sessionArg) => titledSessions.push(sessionArg.id),
    removeFromSessions: (id) => removedSessions.push(id),
    createMessageId: () => 'msg-recovered',
    notifyInstanceMutation: () => {
      instanceMutations += 1
    },
    error: () => {},
  })

  return {
    chatMap,
    runtime,
    session,
    watchCalls,
    syncedArtifacts,
    savedSessions,
    titledSessions,
    removedSessions,
    stoppedArtifactSync,
    get instanceMutations() {
      return instanceMutations
    },
  }
}

test('chat live instance runtime creates and reuses chat instances', () => {
  const harness = createHarness()

  const first = harness.runtime.getOrCreateChat(harness.session)
  const second = harness.runtime.getOrCreateChat(harness.session)

  assert.equal(first, second)
  assert.equal(harness.runtime.getChatInstance('s1'), first)
  assert.equal(harness.instanceMutations, 1)
  assert.deepEqual(harness.syncedArtifacts, [{ id: 's1', count: 1 }])
})

test('chat live instance runtime stops artifact sync and handles ready transitions', () => {
  const harness = createHarness({ background: true })
  harness.runtime.getOrCreateChat(harness.session)

  const statusWatch = harness.watchCalls.find((call) => !call.options?.immediate)
  statusWatch.callback('ready', 'streaming')

  harness.runtime.stopArtifactSync('s1')

  assert.deepEqual(harness.savedSessions, ['s1'])
  assert.deepEqual(harness.titledSessions, ['s1'])
  assert.deepEqual(harness.removedSessions, ['s1'])
  assert.equal(harness.stoppedArtifactSync.length, 1)
})

test('chat live instance runtime recovers poisoned and stuck tool-call parts', () => {
  const harness = createHarness()
  const chat = harness.runtime.getOrCreateChat(harness.session)

  chat.state.messagesRef.value = [
    {
      id: 'old',
      role: 'assistant',
      parts: [{ state: 'output-error', input: 'bad', rawInput: 'bad' }],
    },
    {
      id: 'broken',
      role: 'assistant',
      parts: [{ state: 'input-available', toolCallId: 'tool-1', toolName: 'reply', type: 'tool-reply' }],
    },
  ]

  chat.options.onError(new Error('boom'))

  assert.equal(chat.state.messagesRef.value[0].parts[0].input, undefined)
  assert.equal(chat.state.messagesRef.value[0].parts[0].rawInput, undefined)
  assert.equal(chat.state.messagesRef.value.at(-1).id, 'msg-recovered')
  assert.equal(chat.state.messagesRef.value.at(-1).parts[0].state, 'output-error')
  assert.match(chat.state.messagesRef.value.at(-1).parts[0].errorText, /boom/)
})
