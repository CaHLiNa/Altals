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

test('checkpoint resolve returns the run to running', () => {
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
  assert.equal(withArtifact.artifacts.length, 1)
  assert.deepEqual(withArtifact.artifacts[0], { id: 'art-1', type: 'patch' })
})
