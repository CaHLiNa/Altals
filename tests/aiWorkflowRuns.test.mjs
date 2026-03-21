import test from 'node:test'
import assert from 'node:assert/strict'

import { createPinia, setActivePinia } from 'pinia'

import { createWorkflowPlan } from '../src/services/ai/workflowRuns/planner.js'
import { createCheckpoint } from '../src/services/ai/workflowRuns/state.js'
import {
  hydrateSessionWorkflow,
  serializeSessionWorkflow,
  useAiWorkflowRunsStore,
} from '../src/stores/aiWorkflowRuns.js'
import {
  buildPersistedChatSessionData,
  buildPersistedChatSessionMeta,
  hydratePersistedChatSession,
} from '../src/stores/chatSessionPersistence.js'

test('workflow session snapshot serializes and hydrates as isolated clones', () => {
  const plan = createWorkflowPlan({
    templateId: 'draft.review-revise',
    context: { currentFile: '/tmp/draft.md' },
  })

  const snapshot = serializeSessionWorkflow(plan)
  assert.ok(snapshot)
  assert.equal(snapshot.template.id, 'draft.review-revise')
  assert.equal(snapshot.run.context.currentFile, '/tmp/draft.md')

  snapshot.run.steps[0].label = 'Mutated outside store'
  const restored = hydrateSessionWorkflow(plan)
  assert.notEqual(restored.run.steps[0].label, 'Mutated outside store')

  assert.equal(hydrateSessionWorkflow(null), null)
  assert.equal(hydrateSessionWorkflow({ template: { id: 'draft.review-revise' } }), null)
})

test('workflow run store binds runs to sessions and syncs workflow snapshots', () => {
  setActivePinia(createPinia())
  const store = useAiWorkflowRunsStore()
  const session = { id: 'session-1', _workflow: null }

  const created = store.createRunFromTemplate({
    templateId: 'draft.review-revise',
    sessionId: session.id,
    context: { currentFile: '/tmp/draft.md' },
  })
  const synced = store.syncRunToSession(session)

  assert.equal(store.sessionRunMap[session.id], created.run.id)
  assert.equal(store.activeRunId, created.run.id)
  assert.equal(synced.run.id, created.run.id)
  assert.equal(session._workflow.template.id, 'draft.review-revise')

  session._workflow.run.status = 'tampered'
  assert.equal(store.getRun(created.run.id).run.status, 'planned')
})

test('workflow sync does not restore stale session snapshots without an explicit binding', () => {
  setActivePinia(createPinia())
  const store = useAiWorkflowRunsStore()
  const plan = createWorkflowPlan({ templateId: 'draft.review-revise' })
  const session = {
    id: 'session-no-binding',
    _workflow: serializeSessionWorkflow(plan),
  }

  const synced = store.syncRunToSession(session)

  assert.equal(synced, null)
  assert.equal(session._workflow, null)
  assert.equal(store.getRun(plan.run.id), null)
})

test('checkpoint decisions update stored runs and run summaries', () => {
  setActivePinia(createPinia())
  const store = useAiWorkflowRunsStore()
  const plan = createWorkflowPlan({ templateId: 'draft.review-revise' })
  const waitingRun = createCheckpoint(plan.run, {
    stepId: plan.run.steps[3].id,
    type: 'apply_patch',
    label: 'Apply patch',
  })

  store.restoreSessionWorkflow('session-2', {
    ...plan,
    run: waitingRun,
  })

  assert.equal(store.activeRunId, waitingRun.id)

  const before = store.describeRun(waitingRun.id)
  assert.equal(before.approvalPending, true)
  assert.equal(before.currentStepLabel, plan.run.steps[3].label)

  const updated = store.applyCheckpointDecision({
    runId: waitingRun.id,
    decision: { action: 'apply' },
    resolvedBy: 'reviewer',
  })

  assert.equal(updated.run.checkpoints[0].status, 'resolved')
  assert.equal(updated.run.checkpoints[0].resolvedBy, 'reviewer')
  assert.deepEqual(updated.run.checkpoints[0].payload, { action: 'apply' })

  const after = store.describeRun(waitingRun.id)
  assert.equal(after.approvalPending, false)
  assert.equal(after.status, 'running')
  assert.equal(after.templateId, 'draft.review-revise')
})

test('chat persistence helpers include serialized workflow snapshots in saved data', () => {
  const plan = createWorkflowPlan({
    templateId: 'draft.review-revise',
    context: { currentFile: '/tmp/draft.md' },
  })
  const session = {
    id: 'session-save',
    label: 'Draft review',
    modelId: 'sonnet',
    _aiTitle: true,
    _keywords: ['draft', 'review'],
    _ai: { role: 'reviewer' },
    _workflow: plan,
    createdAt: '2026-03-21T12:00:00.000Z',
    updatedAt: '2026-03-21T12:05:00.000Z',
  }
  const messages = [{ id: 'msg-1', role: 'user', parts: [] }]

  const persisted = buildPersistedChatSessionData(session, messages)

  assert.equal(persisted._workflow.template.id, 'draft.review-revise')
  assert.equal(persisted._workflow.run.context.currentFile, '/tmp/draft.md')
  assert.deepEqual(persisted.messages, messages)

  persisted._workflow.run.status = 'tampered'
  assert.equal(plan.run.status, 'planned')
})

test('chat persistence helpers hydrate restored sessions and tolerate invalid workflow data', () => {
  const plan = createWorkflowPlan({ templateId: 'draft.review-revise' })
  const restored = hydratePersistedChatSession({
    id: 'session-open',
    label: 'Open review',
    modelId: 'sonnet',
    _ai: { role: 'reviewer' },
    _workflow: serializeSessionWorkflow(plan),
    messages: [{ id: 'msg-2', role: 'assistant', parts: [] }],
    createdAt: '2026-03-21T12:00:00.000Z',
    updatedAt: '2026-03-21T12:05:00.000Z',
  })

  assert.equal(restored._workflow.template.id, 'draft.review-revise')
  assert.equal(restored._savedMessages.length, 1)
  restored._workflow.run.status = 'mutated'
  assert.equal(plan.run.status, 'planned')

  const invalid = hydratePersistedChatSession({
    id: 'session-invalid',
    label: 'Broken review',
    _workflow: { template: { id: 'draft.review-revise' } },
  })
  assert.equal(invalid._workflow, null)
  assert.deepEqual(invalid._savedMessages, [])

  const meta = buildPersistedChatSessionMeta({
    id: 'session-meta',
    messages: [],
    _workflow: { template: { id: 'draft.review-revise' } },
  }, 'Untitled')
  assert.equal(meta.label, 'Untitled')
  assert.equal(meta._workflow, null)
})
