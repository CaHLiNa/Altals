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
