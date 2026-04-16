import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyAgentRunEventToSessionState,
  completeAgentRunSessionState,
  failAgentRunSessionState,
  finalizeAgentRunSessionState,
  startAgentRunSessionState,
} from '../src/domains/ai/aiAgentRunSessionRuntime.js'
import { mergeAgentRunToolEventState } from '../src/domains/ai/aiAgentRunEventState.js'

function createBaseSession() {
  return {
    id: 'session-1',
    title: 'Run 1',
    mode: 'agent',
    permissionMode: 'accept-edits',
    messages: [],
    artifacts: [],
    attachments: [],
    permissionRequests: [],
    askUserRequests: [],
    exitPlanRequests: [],
    backgroundTasks: [],
    planMode: { active: false, summary: '', note: '' },
    isCompacting: false,
    lastCompactAt: 0,
    waitingResume: false,
    waitingResumeMessage: '',
    isRunning: false,
    lastError: '',
  }
}

test('startAgentRunSessionState primes a running agent session', () => {
  const started = startAgentRunSessionState({
    session: createBaseSession(),
    skill: { id: 'workspace-agent', kind: 'built-in-action' },
    providerState: { currentProviderLabel: 'OpenAI', model: 'gpt-5.4' },
    contextBundle: { workspace: { available: true, path: '/workspace' } },
    userInstruction: 'Inspect src/app.ts',
    promptDraft: 'Inspect src/app.ts',
    effectivePermissionMode: 'plan',
    userMessageId: 'message:user',
    pendingAssistantId: 'message:assistant',
    createdAt: 1,
  })

  assert.equal(started.session.isRunning, true)
  assert.equal(started.session.permissionMode, 'plan')
  assert.equal(started.session.messages.length, 2)
  assert.equal(started.session.messages[0].content, 'Inspect src/app.ts')
})

test('applyAgentRunEventToSessionState tracks runtime requests, tasks, plan mode, and streaming text', () => {
  let session = startAgentRunSessionState({
    session: createBaseSession(),
    skill: { id: 'workspace-agent', kind: 'built-in-action' },
    providerState: { currentProviderLabel: 'OpenAI', model: 'gpt-5.4' },
    contextBundle: { workspace: { available: true, path: '/workspace' } },
    userInstruction: 'Inspect src/app.ts',
    promptDraft: 'Inspect src/app.ts',
    effectivePermissionMode: 'accept-edits',
    userMessageId: 'message:user',
    pendingAssistantId: 'message:assistant',
    createdAt: 1,
  }).session

  session = applyAgentRunEventToSessionState({
    session,
    pendingAssistantId: 'message:assistant',
    event: {
      type: 'permission_request',
      requestId: 'request-1',
      streamId: 'stream-1',
      transport: 'anthropic-sdk',
      toolName: 'Read',
      title: 'Allow file read',
    },
  })
  session = applyAgentRunEventToSessionState({
    session,
    pendingAssistantId: 'message:assistant',
    event: {
      type: 'task_started',
      taskId: 'task-1',
      toolUseId: 'tool-1',
      taskType: 'edit',
      description: 'Update the file',
    },
  })
  session = applyAgentRunEventToSessionState({
    session,
    pendingAssistantId: 'message:assistant',
    event: {
      eventType: 'tool',
      toolId: 'runtime:enter-plan',
      label: 'EnterPlanMode',
      payload: {
        eventType: 'tool_call_start',
        toolName: 'EnterPlanMode',
      },
    },
  })
  session = applyAgentRunEventToSessionState({
    session,
    pendingAssistantId: 'message:assistant',
    event: {
      eventType: 'assistant-content',
      text: 'Working on it',
      delta: 'Working on it',
    },
  })

  assert.equal(session.permissionRequests.length, 1)
  assert.equal(session.backgroundTasks.length, 1)
  assert.equal(session.backgroundTasks[0].taskId, 'task-1')
  assert.equal(session.planMode.active, true)
  assert.equal(session.messages[1].content, 'Working on it')
  assert.equal(session.runtimeTransport, 'anthropic-sdk')
})

test('mergeAgentRunToolEventState upserts tool progress by tool id', () => {
  const started = mergeAgentRunToolEventState([], {
    eventType: 'tool',
    toolId: 'runtime:read',
    status: 'running',
    label: 'Read',
  })
  const updated = mergeAgentRunToolEventState(started, {
    eventType: 'tool',
    toolId: 'runtime:read',
    status: 'done',
    label: 'Read',
  })

  assert.equal(updated.length, 1)
  assert.equal(updated[0].status, 'done')
})

test('completeAgentRunSessionState and finalizeAgentRunSessionState close a run cleanly', () => {
  const started = startAgentRunSessionState({
    session: createBaseSession(),
    skill: { id: 'workspace-agent', kind: 'built-in-action' },
    providerState: { currentProviderLabel: 'OpenAI', model: 'gpt-5.4' },
    contextBundle: { workspace: { available: true, path: '/workspace' } },
    userInstruction: 'Inspect src/app.ts',
    promptDraft: 'Inspect src/app.ts',
    effectivePermissionMode: 'accept-edits',
    userMessageId: 'message:user',
    pendingAssistantId: 'message:assistant',
    createdAt: 1,
  }).session

  const completed = completeAgentRunSessionState({
    session: started,
    pendingAssistantId: 'message:assistant',
    skill: { id: 'workspace-agent', kind: 'built-in-action' },
    result: {
      content: 'Done',
      transport: 'http',
      payload: { answer: 'Done' },
      events: [],
    },
    artifact: null,
    providerState: { currentProviderLabel: 'OpenAI', model: 'gpt-5.4' },
    contextBundle: { workspace: { available: true, path: '/workspace' } },
    createdAt: 2,
  })
  const finalized = finalizeAgentRunSessionState({
    session: {
      ...completed.session,
      permissionRequests: [{ requestId: 'request-1' }],
      exitPlanRequests: [{ requestId: 'exit-1' }],
      waitingResume: true,
      waitingResumeMessage: 'Waiting',
      isCompacting: true,
    },
  })

  assert.equal(completed.assistantMessage.content, 'Done')
  assert.equal(completed.session.runtimeTransport, 'http')
  assert.equal(finalized.isRunning, false)
  assert.equal(finalized.permissionRequests.length, 0)
  assert.equal(finalized.exitPlanRequests.length, 0)
  assert.equal(finalized.waitingResume, false)
})

test('failAgentRunSessionState preserves a failed assistant message', () => {
  const started = startAgentRunSessionState({
    session: createBaseSession(),
    skill: { id: 'workspace-agent', kind: 'built-in-action' },
    providerState: { currentProviderLabel: 'OpenAI', model: 'gpt-5.4' },
    contextBundle: { workspace: { available: true, path: '/workspace' } },
    userInstruction: 'Inspect src/app.ts',
    promptDraft: 'Inspect src/app.ts',
    effectivePermissionMode: 'accept-edits',
    userMessageId: 'message:user',
    pendingAssistantId: 'message:assistant',
    createdAt: 1,
  }).session

  const failed = failAgentRunSessionState({
    session: started,
    pendingAssistantId: 'message:assistant',
    skill: { id: 'workspace-agent', kind: 'built-in-action' },
    error: 'Tool failed',
    providerState: { currentProviderLabel: 'OpenAI', model: 'gpt-5.4' },
    contextBundle: { workspace: { available: true, path: '/workspace' } },
    events: [],
    createdAt: 2,
  })

  assert.equal(failed.session.lastError, 'Tool failed')
  assert.equal(failed.failedAssistantMessage.content, 'Tool failed')
})
