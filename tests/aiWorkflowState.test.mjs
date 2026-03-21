import test from 'node:test'
import assert from 'node:assert/strict'

import {
  attachArtifact,
  createCheckpoint,
  createWorkflowRun,
  createWorkflowStep,
  markRunPlanned,
  markRunRunning,
  markStepCompleted,
  markStepFailed,
  markStepRunning,
  resolveCheckpoint,
} from '../src/services/ai/workflowRuns/state.js'
import { createWorkflowPlan } from '../src/services/ai/workflowRuns/planner.js'
import { executeWorkflowRun } from '../src/services/ai/workflowRuns/executor.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function createFakeChatStore(sessionId = 'session-executor') {
  const sessions = [{ id: sessionId, label: 'Workflow session', _workflow: null }]
  const chats = new Map()
  const saves = []

  return {
    sessions,
    saves,
    getChatInstance(id) {
      return chats.get(id) || null
    },
    getOrCreateChat(session) {
      if (chats.has(session.id)) return chats.get(session.id)
      const state = {
        messagesRef: { value: [] },
        pushMessage(message) {
          this.messagesRef.value.push(clone(message))
        },
      }
      const chat = { state }
      chats.set(session.id, chat)
      return chat
    },
    async saveSession(id) {
      saves.push(id)
    },
  }
}

function createWorkflowStore(workflow) {
  let current = clone(workflow)

  return {
    getRun(id) {
      return current?.run?.id === id ? clone(current) : null
    },
    replaceRun(nextWorkflow) {
      current = clone(nextWorkflow)
      return clone(current)
    },
    getCurrent() {
      return clone(current)
    },
  }
}

test('workflow run enters waiting_user when a checkpoint is created', () => {
  const run = createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [createWorkflowStep({ kind: 'generate_patch', label: 'Generate patch' })],
  })

  const planned = markRunPlanned(run)
  const running = markRunRunning(planned)
  const stepped = markStepRunning(running, running.steps[0].id)
  const waiting = createCheckpoint(stepped, {
    stepId: running.steps[0].id,
    type: 'apply_patch',
  })

  assert.equal(waiting.status, 'waiting_user')
  assert.equal(waiting.checkpoints.at(-1).status, 'open')
  assert.equal(waiting.currentStepId, running.steps[0].id)
  assert.equal(waiting.currentCheckpointId, waiting.checkpoints.at(-1).id)
})

test('run transitions from draft to planned to running', () => {
  const run = createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [createWorkflowStep({ kind: 'read_context', label: 'Read context' })],
  })

  const planned = markRunPlanned(run)
  const running = markRunRunning(planned)

  assert.equal(run.status, 'draft')
  assert.equal(planned.status, 'planned')
  assert.equal(running.status, 'running')
})

test('browser-safe ID generation works without crypto.randomUUID', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: undefined,
  })

  try {
    const run = createWorkflowRun({ templateId: 'draft.review-revise' })
    assert.match(run.id, /^workflow-run-[a-z0-9]+-[a-z0-9]+$/)
  } finally {
    Object.defineProperty(globalThis, 'crypto', descriptor)
  }
})

test('checkpoint resolve keeps waiting_user when another checkpoint remains open', () => {
  const run = markRunRunning(markRunPlanned(createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [
      createWorkflowStep({ id: 'step-1', kind: 'generate_patch', label: 'Generate patch' }),
      createWorkflowStep({ id: 'step-2', kind: 'summarize_outcome', label: 'Summarize outcome' }),
    ],
  })))
  const firstWaiting = createCheckpoint(markStepRunning(run, 'step-1'), {
    stepId: 'step-1',
    type: 'apply_patch',
  })
  const secondWaiting = createCheckpoint(firstWaiting, {
    stepId: 'step-2',
    type: 'user_review',
  })
  const resolved = resolveCheckpoint(secondWaiting, firstWaiting.checkpoints[0].id)

  assert.equal(resolved.status, 'waiting_user')
  assert.equal(resolved.currentCheckpointId, secondWaiting.checkpoints[1].id)
  assert.equal(resolved.currentStepId, 'step-2')
  assert.equal(resolved.checkpoints[0].status, 'resolved')
  assert.equal(resolved.checkpoints[1].status, 'open')
})

test('checkpoint resolve returns the run to running when no open checkpoints remain', () => {
  const run = markRunRunning(markRunPlanned(createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [createWorkflowStep({ kind: 'generate_patch', label: 'Generate patch' })],
  })))
  const stepped = markStepRunning(run, run.steps[0].id)
  const waiting = createCheckpoint(stepped, {
    stepId: run.steps[0].id,
    type: 'apply_patch',
  })
  const resolved = resolveCheckpoint(waiting, waiting.checkpoints[0].id)

  assert.equal(waiting.status, 'waiting_user')
  assert.equal(resolved.status, 'running')
  assert.equal(resolved.checkpoints[0].status, 'resolved')
  assert.equal(resolved.currentCheckpointId, null)
})

test('step failure moves the run into failed', () => {
  const run = markRunRunning(markRunPlanned(createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [createWorkflowStep({ kind: 'generate_patch', label: 'Generate patch' })],
  })))
  const stepped = markStepRunning(run, run.steps[0].id)
  const failed = markStepFailed(stepped, run.steps[0].id, new Error('boom'))

  assert.equal(failed.status, 'failed')
  assert.equal(failed.steps[0].status, 'failed')
  assert.equal(failed.error.message, 'boom')
  assert.equal(failed.currentStepId, null)
})

test('completed steps and artifacts are tracked on the run', () => {
  const run = markRunRunning(markRunPlanned(createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [createWorkflowStep({ kind: 'generate_patch', label: 'Generate patch' })],
  })))
  const stepped = markStepRunning(run, run.steps[0].id)
  const completed = markStepCompleted(stepped, run.steps[0].id)
  const withArtifact = attachArtifact(completed, { id: 'art-1', type: 'patch' })

  assert.equal(completed.steps[0].status, 'completed')
  assert.equal(completed.currentStepId, null)
  assert.equal(withArtifact.artifacts.length, 1)
  assert.deepEqual(withArtifact.artifacts[0], { id: 'art-1', type: 'patch' })
})

test('invalid step ids are true no-ops for run status', () => {
  const run = createWorkflowRun({
    templateId: 'draft.review-revise',
    steps: [createWorkflowStep({ kind: 'generate_patch', label: 'Generate patch' })],
  })
  const waiting = createCheckpoint(markRunRunning(markRunPlanned(markStepRunning(run, run.steps[0].id))), {
    stepId: run.steps[0].id,
    type: 'apply_patch',
  })

  const completedNoop = markStepCompleted(waiting, 'missing-step')
  const failedNoop = markStepFailed(waiting, 'missing-step', new Error('ignored'))

  assert.equal(completedNoop.status, 'waiting_user')
  assert.equal(completedNoop.currentCheckpointId, waiting.currentCheckpointId)
  assert.equal(failedNoop.status, 'waiting_user')
  assert.equal(failedNoop.currentCheckpointId, waiting.currentCheckpointId)
})

test('executor advances draft review runs to apply_patch approval with visible chat output', async () => {
  const workflow = createWorkflowPlan({
    templateId: 'draft.review-revise',
    context: {
      currentFile: '/tmp/draft.md',
      prompt: 'Tighten the argument and fix obvious clarity problems.',
    },
  })
  const chatStore = createFakeChatStore('session-review')
  const workflowStore = createWorkflowStore(workflow)

  await executeWorkflowRun({
    run: workflow.run,
    sessionId: 'session-review',
    chatStore,
    workflowStore,
  })

  const current = workflowStore.getCurrent()
  const chat = chatStore.getChatInstance('session-review')
  const checkpoint = current.run.checkpoints.find((item) => item.status === 'open')

  assert.equal(current.run.status, 'waiting_user')
  assert.equal(current.run.currentStepId, current.run.steps[4].id)
  assert.equal(current.run.steps[3].status, 'completed')
  assert.equal(current.run.steps[4].status, 'running')
  assert.equal(checkpoint?.type, 'apply_patch')
  assert.ok(chat.state.messagesRef.value.length > 0)
  assert.ok(current.run.artifacts.some((artifact) => artifact.type === 'patch'))
  assert.ok(chatStore.saves.length > 0)
  assert.equal(chatStore.saves.at(-1), 'session-review')
})

test('executor advances reference intake runs to accept_sources approval after search steps', async () => {
  const workflow = createWorkflowPlan({
    templateId: 'references.search-intake',
    context: {
      currentFile: '/tmp/paper.md',
      prompt: 'Find stronger empirical support for the main causal claim.',
    },
  })
  const chatStore = createFakeChatStore('session-references')
  const workflowStore = createWorkflowStore(workflow)

  await executeWorkflowRun({
    run: workflow.run,
    sessionId: 'session-references',
    chatStore,
    workflowStore,
  })

  const current = workflowStore.getCurrent()
  const checkpoint = current.run.checkpoints.find((item) => item.status === 'open')

  assert.equal(current.run.status, 'waiting_user')
  assert.equal(current.run.currentStepId, current.run.steps[5].id)
  assert.equal(current.run.steps[4].status, 'completed')
  assert.equal(checkpoint?.type, 'accept_sources')
  assert.ok(current.run.artifacts.some((artifact) => artifact.type === 'citation_set'))
})

test('executor can finish non-approval workflows without leaving the run pending', async () => {
  const workflow = createWorkflowPlan({
    templateId: 'code.debug-current',
    context: {
      currentFile: '/tmp/example.py',
      prompt: 'Explain the failure and suggest the most likely fix.',
    },
  })
  const chatStore = createFakeChatStore('session-debug')
  const workflowStore = createWorkflowStore(workflow)

  await executeWorkflowRun({
    run: workflow.run,
    sessionId: 'session-debug',
    chatStore,
    workflowStore,
  })

  const current = workflowStore.getCurrent()

  assert.equal(current.run.status, 'completed')
  assert.equal(current.run.steps.at(-1).status, 'completed')
  assert.equal(current.run.currentCheckpointId, null)
  assert.ok(chatStore.getChatInstance('session-debug').state.messagesRef.value.length > 0)
})
