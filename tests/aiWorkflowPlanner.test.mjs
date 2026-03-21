import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkflowPlan } from '../src/services/ai/workflowRuns/planner.js'
import {
  WORKFLOW_TEMPLATE_IDS,
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
} from '../src/services/ai/workflowRuns/templates.js'

test('draft review workflow inserts steps in the expected order', () => {
  const plan = createWorkflowPlan({
    templateId: 'draft.review-revise',
    context: { currentFile: '/tmp/draft.md' },
  })

  assert.deepEqual(
    plan.steps.map((step) => step.kind),
    [
      'read_context',
      'analyze_goal',
      'generate_review',
      'generate_patch',
      'await_patch_decision',
      'summarize_outcome',
    ],
  )
})

test('workflow template registry exposes the expected ids', () => {
  assert.deepEqual(WORKFLOW_TEMPLATE_IDS, [
    'draft.review-revise',
    'references.search-intake',
    'code.debug-current',
  ])
  assert.equal(WORKFLOW_TEMPLATES.length, 3)
})

test('draft review template requires apply_patch approval', () => {
  const template = getWorkflowTemplate('draft.review-revise')

  assert.equal(template.role, 'reviewer')
  assert.equal(template.toolProfile, 'reviewer')
  assert.equal(template.autoAdvanceUntil, 'generate_patch')
  assert.deepEqual(template.approvalTypes, ['apply_patch'])
  assert.ok(template.steps.some((step) => step.approvalType === 'apply_patch'))
})

test('reference intake template requires accept_sources approval', () => {
  const template = getWorkflowTemplate('references.search-intake')

  assert.equal(template.role, 'researcher')
  assert.equal(template.toolProfile, 'researcher')
  assert.equal(template.autoAdvanceUntil, 'generate_citation_set')
  assert.deepEqual(template.approvalTypes, ['accept_sources'])
  assert.ok(template.steps.some((step) => step.approvalType === 'accept_sources'))
})

test('code debug template suggests fixes without direct file edits by default', () => {
  const plan = createWorkflowPlan({
    templateId: 'code.debug-current',
    context: { currentFile: '/tmp/code.js' },
  })

  assert.deepEqual(plan.steps.map((step) => step.kind), [
    'read_context',
    'analyze_goal',
    'diagnose_issue',
    'generate_fix_suggestions',
    'summarize_outcome',
  ])
  assert.equal(plan.autoAdvanceUntil, 'generate_fix_suggestions')
  assert.deepEqual(plan.approvalTypes, [])
  assert.ok(plan.steps.some((step) => step.kind === 'generate_fix_suggestions'))
  assert.ok(plan.steps.every((step) => !step.requiresApproval))
})
