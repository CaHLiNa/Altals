import test from 'node:test'
import assert from 'node:assert/strict'

import {
  consumeAnthropicSdkBridgeChunk,
  flushAnthropicSdkBridgeBuffer,
  normalizeAnthropicSdkBridgeEvent,
} from '../src/services/ai/runtime/anthropicSdkEventStream.js'

test('normalizeAnthropicSdkBridgeEvent annotates transport and stream id', () => {
  const event = normalizeAnthropicSdkBridgeEvent(
    {
      type: 'permission_request',
      requestId: 'request-1',
    },
    'stream-1'
  )

  assert.equal(event.type, 'permission_request')
  assert.equal(event.streamId, 'stream-1')
  assert.equal(event.transport, 'anthropic-sdk')
})

test('consumeAnthropicSdkBridgeChunk parses event lines across chunk boundaries', () => {
  const seenEvents = []
  const partial = consumeAnthropicSdkBridgeChunk({
    buffer: '',
    chunk: '{"kind":"event","event":{"type":"chunk","delta":"Hello","text":"Hello"}}\n{"kind":"e',
    streamId: 'stream-1',
    onEvent: (event) => seenEvents.push(event),
  })

  const completed = consumeAnthropicSdkBridgeChunk({
    buffer: partial.buffer,
    chunk:
      'vent","event":{"type":"permission_request","requestId":"request-1"}}\n{"kind":"done","content":"Hello","reasoning":"","stopReason":"end_turn"}\n',
    streamId: 'stream-1',
    onEvent: (event) => seenEvents.push(event),
  })

  assert.equal(seenEvents.length, 2)
  assert.equal(seenEvents[0].type, 'chunk')
  assert.equal(seenEvents[1].type, 'permission_request')
  assert.equal(seenEvents[1].transport, 'anthropic-sdk')
  assert.deepEqual(completed.done, {
    content: 'Hello',
    reasoning: '',
    stopReason: 'end_turn',
  })
})

test('flushAnthropicSdkBridgeBuffer resolves trailing done payloads', () => {
  const parsed = flushAnthropicSdkBridgeBuffer({
    buffer: '{"kind":"done","content":"Done","reasoning":"Why","stopReason":"end_turn"}',
    streamId: 'stream-1',
  })

  assert.deepEqual(parsed.done, {
    content: 'Done',
    reasoning: 'Why',
    stopReason: 'end_turn',
  })
})

test('consumeAnthropicSdkBridgeChunk returns bridge errors as Error objects', () => {
  const parsed = consumeAnthropicSdkBridgeChunk({
    buffer: '',
    chunk: '{"kind":"error","error":"bridge failed"}\n',
    streamId: 'stream-1',
  })

  assert.equal(parsed.error instanceof Error, true)
  assert.equal(parsed.error.message, 'bridge failed')
})
