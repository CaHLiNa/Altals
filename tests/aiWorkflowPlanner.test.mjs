import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkflowPlan } from '../src/services/ai/workflowRuns/planner.js'
import {
  buildWorkflowBoundaryCopy,
  getAiLauncherItems,
  getChatInputToolItems,
  getQuickAiItems,
  getWorkflowFirstStarterItems,
} from '../src/services/ai/taskCatalog.js'
import {
  WORKFLOW_TEMPLATE_IDS,
  WORKFLOW_TEMPLATES,
  getWorkflowTemplate,
} from '../src/services/ai/workflowRuns/templates.js'

function t(message, params = {}) {
  return String(message).replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))
}

function findTask(items, taskId) {
  return items.find((item) => item.task?.taskId === taskId)?.task || null
}

test('draft review workflow inserts steps in the expected order', () => {
  const plan = createWorkflowPlan({
    templateId: 'draft.review-revise',
    context: { currentFile: '/tmp/draft.md' },
  })

  assert.deepEqual(
    plan.run.steps.map((step) => step.kind),
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
    'code.notebook-assistant',
    'references.maintenance',
    'pdf.summary-current',
    'research.compare-sources',
    'compile.tex-typ-diagnose',
    'compile.tex-typ-fix',
  ])
  assert.equal(WORKFLOW_TEMPLATES.length, 9)
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

  assert.equal(template.role, 'citation_librarian')
  assert.equal(template.toolProfile, 'citation_librarian')
  assert.equal(template.autoAdvanceUntil, 'generate_citation_set')
  assert.deepEqual(template.approvalTypes, ['accept_sources'])
  assert.ok(template.steps.some((step) => step.approvalType === 'accept_sources'))
})

test('code debug template suggests fixes without direct file edits by default', () => {
  const plan = createWorkflowPlan({
    templateId: 'code.debug-current',
    context: { currentFile: '/tmp/code.js' },
  })

  assert.equal(plan.run.status, 'planned')
  assert.equal(plan.run.title, 'Debug current code')
  assert.equal(plan.label, undefined)
  assert.equal(plan.title, undefined)
  assert.deepEqual(plan.run.steps.map((step) => step.kind), [
    'read_context',
    'analyze_goal',
    'diagnose_issue',
    'generate_fix_suggestions',
    'summarize_outcome',
  ])
  assert.equal(plan.template.autoAdvanceUntil, 'generate_fix_suggestions')
  assert.deepEqual(plan.template.approvalTypes, [])
  assert.ok(plan.run.steps.some((step) => step.kind === 'generate_fix_suggestions'))
  assert.ok(plan.run.steps.every((step) => !step.requiresApproval))
})

test('notebook assistant template pauses before notebook edits', () => {
  const template = getWorkflowTemplate('code.notebook-assistant')

  assert.equal(template.role, 'code_assistant')
  assert.equal(template.toolProfile, 'code_assistant')
  assert.equal(template.autoAdvanceUntil, 'generate_notebook_plan')
  assert.deepEqual(template.approvalTypes, ['apply_notebook_edits'])
  assert.ok(template.steps.some((step) => step.approvalType === 'apply_notebook_edits'))
})

test('reference maintenance template pauses before library changes', () => {
  const template = getWorkflowTemplate('references.maintenance')

  assert.equal(template.role, 'citation_librarian')
  assert.equal(template.toolProfile, 'citation_librarian')
  assert.equal(template.autoAdvanceUntil, 'generate_reference_actions')
  assert.deepEqual(template.approvalTypes, ['apply_reference_changes'])
  assert.ok(template.steps.some((step) => step.approvalType === 'apply_reference_changes'))
})

test('pdf summary and source comparison templates auto-complete without approvals', () => {
  const pdfPlan = createWorkflowPlan({
    templateId: 'pdf.summary-current',
    context: { currentFile: '/tmp/paper.pdf' },
  })
  const comparePlan = createWorkflowPlan({
    templateId: 'research.compare-sources',
    context: { currentFile: '/tmp/paper.pdf' },
  })

  assert.deepEqual(pdfPlan.run.steps.map((step) => step.kind), [
    'read_context',
    'analyze_goal',
    'extract_pdf_findings',
    'generate_summary',
    'summarize_outcome',
  ])
  assert.deepEqual(comparePlan.run.steps.map((step) => step.kind), [
    'read_context',
    'analyze_goal',
    'search_local_references',
    'search_external_sources',
    'compare_source_set',
    'generate_proposal_cards',
    'summarize_outcome',
  ])
  assert.deepEqual(pdfPlan.template.approvalTypes, [])
  assert.deepEqual(comparePlan.template.approvalTypes, [])
})

test('tex and typst compile workflows separate diagnosis from patch approval', () => {
  const diagnoseTemplate = getWorkflowTemplate('compile.tex-typ-diagnose')
  const fixTemplate = getWorkflowTemplate('compile.tex-typ-fix')
  const diagnosePlan = createWorkflowPlan({
    templateId: 'compile.tex-typ-diagnose',
    context: { currentFile: '/tmp/paper.tex' },
  })
  const fixPlan = createWorkflowPlan({
    templateId: 'compile.tex-typ-fix',
    context: { currentFile: '/tmp/slides.typ' },
  })

  assert.equal(diagnoseTemplate.role, 'tex_typ_fixer')
  assert.deepEqual(diagnoseTemplate.approvalTypes, [])
  assert.deepEqual(diagnosePlan.run.steps.map((step) => step.kind), [
    'read_context',
    'diagnose_compile_issue',
    'summarize_outcome',
  ])

  assert.equal(fixTemplate.role, 'tex_typ_fixer')
  assert.deepEqual(fixTemplate.approvalTypes, ['apply_patch'])
  assert.equal(fixTemplate.autoAdvanceUntil, 'generate_patch')
  assert.deepEqual(fixPlan.run.steps.map((step) => step.kind), [
    'read_context',
    'diagnose_compile_issue',
    'generate_patch',
    'await_patch_decision',
    'summarize_outcome',
  ])
  assert.ok(fixTemplate.steps.some((step) => step.approvalType === 'apply_patch'))
})

test('step ids differ across two runs of the same template', () => {
  const first = createWorkflowPlan({ templateId: 'draft.review-revise' })
  const second = createWorkflowPlan({ templateId: 'draft.review-revise' })

  assert.notEqual(first.run.steps[0].id, second.run.steps[0].id)
  assert.match(first.run.steps[0].id, /^workflow-run-/)
  assert.match(second.run.steps[0].id, /^workflow-run-/)
})

test('planner returns isolated copies and rejects unknown templates', () => {
  const plan = createWorkflowPlan({ templateId: 'draft.review-revise' })
  plan.template.approvalTypes.push('mutated')
  plan.run.steps[0].label = 'Changed'

  const fresh = createWorkflowPlan({ templateId: 'draft.review-revise' })
  assert.deepEqual(fresh.template.approvalTypes, ['apply_patch'])
  assert.notEqual(fresh.run.steps[0].label, 'Changed')

  assert.throws(() => {
    createWorkflowPlan({ templateId: 'missing.template' })
  }, /Unknown workflow template/)
})

test('current draft review launcher entry maps to the draft review workflow', () => {
  const items = getAiLauncherItems({
    currentPath: '/tmp/draft.md',
    t,
  })
  const task = findTask(items, 'review.current-draft')

  assert.ok(task)
  assert.equal(task.action, 'workflow')
  assert.equal(task.workflowTemplateId, 'draft.review-revise')
  assert.equal(task.role, 'reviewer')
  assert.equal(task.toolProfile, 'reviewer')
  assert.equal(task.filePath, '/tmp/draft.md')
  assert.match(task.description || '', /patch approval/i)
  assert.match(task.meta || '', /Workflow/i)
})

test('launcher items preserve workflow boundary description and meta on task data', () => {
  const items = getAiLauncherItems({
    currentPath: '/tmp/draft.md',
    t,
  })
  const item = items.find((entry) => entry.task?.taskId === 'review.current-draft')

  assert.ok(item)
  assert.match(item.task.description || '', /patch approval/i)
  assert.match(item.task.meta || '', /Workflow/i)
})

test('quick items prioritize workflow starts and keep general chat as the only free chat entry', () => {
  const items = getQuickAiItems({ t })
  const taskIds = items.map((item) => item.task?.taskId)
  const actions = items.map((item) => item.task?.action)

  assert.deepEqual(taskIds.slice(0, 4), [
    'review.current-draft',
    'research.paper-search',
    'citation.prefill',
    'code.prefill',
  ])
  assert.ok(taskIds.includes('chat.general'))
  assert.equal(taskIds.includes('research.web'), false)
  assert.equal(items.find((item) => item.task?.taskId === 'chat.general')?.task?.action, 'prefill')
  assert.deepEqual(actions.slice(0, 4), ['workflow', 'workflow', 'workflow', 'workflow'])
})

test('starter ordering keeps context-specific entries ahead of generic entries in draft, code, and pdf contexts', () => {
  const draftItems = getWorkflowFirstStarterItems({
    currentPath: '/tmp/draft.md',
    t,
  })
  const codeItems = getWorkflowFirstStarterItems({
    currentPath: '/tmp/code.py',
    t,
  })
  const pdfItems = getWorkflowFirstStarterItems({
    currentPath: '/tmp/paper.pdf',
    t,
  })
  const pdfQuickItems = getQuickAiItems({
    currentPath: '/tmp/paper.pdf',
    t,
  })
  const pdfLauncherItems = getAiLauncherItems({
    currentPath: '/tmp/paper.pdf',
    t,
  })

  assert.equal(draftItems[0].task?.taskId, 'review.current-draft')
  assert.equal(draftItems[0].task?.action, 'workflow')
  assert.equal(codeItems[0].task?.taskId, 'code.explain-current')
  assert.equal(codeItems[0].task?.action, 'workflow')
  assert.equal(pdfItems[0].task?.action, 'workflow')
  assert.equal(pdfItems[0].task?.taskId, 'pdf.summarise')
  assert.deepEqual(pdfQuickItems.slice(0, 4).map((item) => item.task?.action), [
    'workflow',
    'workflow',
    'workflow',
    'workflow',
  ])
  assert.equal(pdfLauncherItems[0].task?.action, 'workflow')
  assert.equal(pdfLauncherItems[0].task?.taskId, 'pdf.summarise')
  assert.ok(codeItems.every((item) => item.task?.action === 'workflow'))
  assert.ok(pdfItems.findIndex((item) => item.task?.taskId === 'research.paper-search') > 0)
})

test('starter list dedupes repeated review entries when there is no current file', () => {
  const items = getWorkflowFirstStarterItems({ t })
  const reviewLabels = items.filter((item) => item.label === 'Review current draft')
  const reviewTaskIds = items
    .map((item) => item.task?.taskId)
    .filter((taskId) => taskId === 'review.current-draft' || taskId === 'review.prefill')

  assert.equal(reviewLabels.length, 1)
  assert.equal(reviewTaskIds.length, 1)
  assert.equal(items.find((item) => item.task?.taskId === 'review.current-draft')?.task?.workflowTemplateId, 'draft.review-revise')
})

test('workflow boundary copy exposes auto-run and approval boundaries', () => {
  const reviewCopy = buildWorkflowBoundaryCopy('draft.review-revise', t)
  const referenceCopy = buildWorkflowBoundaryCopy('references.search-intake', t)
  const codeCopy = buildWorkflowBoundaryCopy('code.debug-current', t)
  const notebookCopy = buildWorkflowBoundaryCopy('code.notebook-assistant', t)
  const maintenanceCopy = buildWorkflowBoundaryCopy('references.maintenance', t)
  const pdfCopy = buildWorkflowBoundaryCopy('pdf.summary-current', t)
  const compareCopy = buildWorkflowBoundaryCopy('research.compare-sources', t)
  const texDiagnoseCopy = buildWorkflowBoundaryCopy('compile.tex-typ-diagnose', t)
  const texFixCopy = buildWorkflowBoundaryCopy('compile.tex-typ-fix', t)

  assert.match(reviewCopy.description, /patch approval/i)
  assert.match(referenceCopy.description, /source approval/i)
  assert.match(codeCopy.description, /without editing files/i)
  assert.match(notebookCopy.description, /notebook/i)
  assert.match(maintenanceCopy.description, /library changes/i)
  assert.match(pdfCopy.description, /summary/i)
  assert.match(compareCopy.description, /comparison/i)
  assert.match(texDiagnoseCopy.description, /without editing/i)
  assert.match(texFixCopy.description, /patch approval/i)
  assert.match(reviewCopy.meta, /workflow/i)
})

test('paper search and citation help launcher entries map to workflow descriptors', () => {
  const items = getAiLauncherItems({ t })
  const paperSearchTask = findTask(items, 'research.paper-search')
  const citationTask = findTask(items, 'citation.prefill')

  assert.ok(paperSearchTask)
  assert.equal(paperSearchTask.action, 'workflow')
  assert.equal(paperSearchTask.workflowTemplateId, 'references.search-intake')
  assert.equal(paperSearchTask.role, 'citation_librarian')
  assert.equal(paperSearchTask.toolProfile, 'citation_librarian')

  assert.ok(citationTask)
  assert.equal(citationTask.action, 'workflow')
  assert.equal(citationTask.workflowTemplateId, 'references.search-intake')
  assert.equal(citationTask.role, 'citation_librarian')
  assert.equal(citationTask.toolProfile, 'citation_librarian')
})

test('chat input paper search entry maps to the reference intake workflow with template-aligned role', () => {
  const items = getChatInputToolItems({ t })
  const task = findTask(items, 'research.paper-search')

  assert.ok(task)
  assert.equal(task.action, 'workflow')
  assert.equal(task.workflowTemplateId, 'references.search-intake')
  assert.equal(task.role, 'citation_librarian')
  assert.equal(task.toolProfile, 'citation_librarian')
  assert.equal(task.source, 'chat-input')
  assert.equal(task.entryContext, 'chat-input')
})

test('general chat launcher entry remains a normal chat prefill task', () => {
  const items = getAiLauncherItems({ t })
  const task = findTask(items, 'chat.general')

  assert.ok(task)
  assert.equal(task.action, 'prefill')
  assert.equal(task.workflowTemplateId, undefined)
  assert.equal(task.role, 'general')
})

test('phase 2a task entries map to workflow descriptors', () => {
  const launcherItems = getAiLauncherItems({
    currentPath: '/tmp/paper.pdf',
    t,
  })
  const chatItems = getChatInputToolItems({
    currentPath: '/tmp/analysis.ipynb',
    t,
  })
  const genericChatItems = getChatInputToolItems({ t })

  const notebookTask = findTask(chatItems, 'code.notebook-current')
  const notebookExplorerTask = findTask(genericChatItems, 'code.notebook-explorer')
  const maintenanceTask = findTask(chatItems, 'citation.maintenance')
  const compareTask = findTask(launcherItems, 'research.compare-sources')
  const pdfTask = findTask(launcherItems, 'pdf.summarise')

  assert.equal(notebookTask?.action, 'workflow')
  assert.equal(notebookTask?.workflowTemplateId, 'code.notebook-assistant')
  assert.equal(notebookExplorerTask?.action, 'workflow')
  assert.equal(notebookExplorerTask?.workflowTemplateId, 'code.notebook-assistant')
  assert.equal(maintenanceTask?.action, 'workflow')
  assert.equal(maintenanceTask?.workflowTemplateId, 'references.maintenance')
  assert.equal(compareTask?.action, 'workflow')
  assert.equal(compareTask?.workflowTemplateId, 'research.compare-sources')
  assert.equal(pdfTask?.action, 'workflow')
  assert.equal(pdfTask?.workflowTemplateId, 'pdf.summary-current')
})

test('phase 2b tex and typst task entries map to workflow descriptors', () => {
  const launcherItems = getAiLauncherItems({
    currentPath: '/tmp/paper.tex',
    t,
  })
  const chatItems = getChatInputToolItems({
    currentPath: '/tmp/layout.typ',
    t,
  })

  const texDiagnoseTask = findTask(launcherItems, 'diagnose.tex-typ')
  const texFixTask = findTask(launcherItems, 'fix.tex-typ')
  const typstDiagnoseTask = findTask(chatItems, 'diagnose.tex-typ')

  assert.equal(texDiagnoseTask?.action, 'workflow')
  assert.equal(texDiagnoseTask?.workflowTemplateId, 'compile.tex-typ-diagnose')
  assert.equal(texFixTask?.action, 'workflow')
  assert.equal(texFixTask?.workflowTemplateId, 'compile.tex-typ-fix')
  assert.equal(typstDiagnoseTask?.action, 'workflow')
  assert.equal(typstDiagnoseTask?.workflowTemplateId, 'compile.tex-typ-diagnose')
})
