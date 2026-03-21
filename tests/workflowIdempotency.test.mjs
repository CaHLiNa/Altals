import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCheckpoint,
  createWorkflowRun,
  createWorkflowStep,
  markStepRunning,
  resolveCheckpoint,
} from '../src/services/ai/workflowRuns/state.js'

test('workflow checkpoint resolution is idempotent for repeated decisions', () => {
  const baseRun = createWorkflowRun({
    templateId: 'draft.review-revise',
    title: 'Review and revise draft',
    steps: [
      createWorkflowStep({
        kind: 'await_patch_decision',
        label: 'Await patch decision',
        requiresApproval: true,
        approvalType: 'apply_patch',
      }),
    ],
  })

  const runningRun = markStepRunning(baseRun, baseRun.steps[0].id)
  const runWithCheckpoint = createCheckpoint(runningRun, {
    stepId: runningRun.steps[0].id,
    type: 'apply_patch',
    label: 'Await patch decision',
  })

  const resolvedOnce = resolveCheckpoint(runWithCheckpoint, runWithCheckpoint.currentCheckpointId, {
    resolvedBy: 'user',
    payload: { action: 'accept' },
  })
  const resolvedTwice = resolveCheckpoint(resolvedOnce, runWithCheckpoint.currentCheckpointId, {
    resolvedBy: 'user',
    payload: { action: 'skip' },
  })

  assert.deepEqual(resolvedTwice, resolvedOnce)
  assert.equal(resolvedTwice.checkpoints[0].resolvedAt, resolvedOnce.checkpoints[0].resolvedAt)
  assert.deepEqual(resolvedTwice.checkpoints[0].payload, { action: 'accept' })
})
