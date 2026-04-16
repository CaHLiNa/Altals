import test from 'node:test'
import assert from 'node:assert/strict'

import { runAiAgentExecutionRuntime } from '../src/services/ai/agentExecutionRuntime.js'

test('runAiAgentExecutionRuntime streams content and maps runtime tool events', async () => {
  const seenEvents = []
  const result = await runAiAgentExecutionRuntime({
    providerId: 'openai',
    config: {},
    apiKey: 'test',
    conversation: [],
    userPrompt: 'Fix the failing build.',
    systemPrompt: 'You are Altals Agent.',
    runtimeRunner: async ({ onEvent }) => {
      onEvent({ type: 'chunk', delta: 'Hello ' })
      onEvent({ type: 'chunk', delta: 'world' })
      onEvent({ type: 'reasoning', delta: 'Because the file is broken.' })
      onEvent({ type: 'tool_call_start', toolCallId: 'tool-1', toolName: 'Edit' })
      onEvent({
        type: 'tool_call_done',
        toolCallId: 'tool-1',
        toolName: 'Edit',
        detail: 'Applied patch.',
        isError: false,
      })
      return {
        content: '',
        reasoning: '',
        toolRounds: [],
      }
    },
    onEvent: (event) => {
      seenEvents.push(event)
    },
  })

  assert.equal(result.content, 'Hello world')
  assert.equal(result.payload.answer, 'Hello world')
  assert.equal(result.transport, 'http')
  assert.equal(
    seenEvents.some(
      (event) => event.eventType === 'assistant-content' && event.text === 'Hello world'
    ),
    true
  )
  assert.equal(
    result.events.some((event) => event.toolId === 'runtime:tool-1' && event.status === 'done'),
    true
  )
})

test('runAiAgentExecutionRuntime folds tool round results into normalized events', async () => {
  const result = await runAiAgentExecutionRuntime({
    providerId: 'openai',
    config: {},
    apiKey: 'test',
    conversation: [],
    userPrompt: 'Inspect the workspace.',
    systemPrompt: 'You are Altals Agent.',
    runtimeRunner: async () => ({
      content: '{"answer":"Done","rationale":"Checked files."}',
      reasoning: '',
      transport: 'anthropic-sdk',
      toolRounds: [
        {
          toolCalls: [
            {
              id: 'tool-2',
              name: 'read_file',
              result: {
                isError: false,
                content: 'Read src/app.ts',
              },
            },
          ],
        },
      ],
    }),
  })

  assert.deepEqual(result.payload, {
    answer: 'Done',
    rationale: 'Checked files.',
  })
  assert.equal(result.transport, 'anthropic-sdk')
  assert.equal(
    result.events.some((event) => event.toolId === 'runtime:tool-2' && event.label === 'read_file'),
    true
  )
})
