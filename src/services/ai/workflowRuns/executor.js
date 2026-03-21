import { t } from '../../../i18n/index.js'
import {
  attachArtifact,
  createCheckpoint,
  markRunCompleted,
  markRunFailed,
  markRunRunning,
  markStepCompleted,
  markStepRunning,
} from './state.js'

const TEMPLATE_EXECUTION_POLICY = {
  'draft.review-revise': {
    approvalStepKind: 'await_patch_decision',
    approvalType: 'apply_patch',
  },
  'references.search-intake': {
    approvalStepKind: 'await_source_decision',
    approvalType: 'accept_sources',
  },
  'code.debug-current': {
    approvalStepKind: null,
    approvalType: null,
  },
  'code.notebook-assistant': {
    approvalStepKind: 'await_notebook_edit_decision',
    approvalType: 'apply_notebook_edits',
  },
  'references.maintenance': {
    approvalStepKind: 'await_reference_change_decision',
    approvalType: 'apply_reference_changes',
  },
  'pdf.summary-current': {
    approvalStepKind: null,
    approvalType: null,
  },
  'research.compare-sources': {
    approvalStepKind: null,
    approvalType: null,
  },
  'compile.tex-typ-diagnose': {
    approvalStepKind: null,
    approvalType: null,
  },
  'compile.tex-typ-fix': {
    approvalStepKind: 'await_patch_decision',
    approvalType: 'apply_patch',
  },
}

let messageCounter = 0

function now() {
  return new Date().toISOString()
}

function clone(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {}
  }
  return JSON.parse(JSON.stringify(value))
}

function createMessageId(prefix = 'workflow-message') {
  const browserUUID = globalThis.crypto?.randomUUID?.()
  if (browserUUID) return `${prefix}-${browserUUID}`
  messageCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${messageCounter.toString(36)}`
}

function getTemplatePolicy(templateId) {
  return TEMPLATE_EXECUTION_POLICY[String(templateId || '').trim()] || {
    approvalStepKind: null,
    approvalType: null,
  }
}

function getMessages(chat) {
  return Array.isArray(chat?.state?.messagesRef?.value)
    ? chat.state.messagesRef.value
    : []
}

function findSession(chatStore, sessionId) {
  if (!chatStore || !sessionId || !Array.isArray(chatStore.sessions)) return null
  return chatStore.sessions.find((session) => session?.id === sessionId) || null
}

function getOrCreateChatInstance(chatStore, sessionId) {
  if (!chatStore || !sessionId) return null
  const existing = typeof chatStore.getChatInstance === 'function'
    ? chatStore.getChatInstance(sessionId)
    : null
  if (existing) return existing
  const session = findSession(chatStore, sessionId)
  if (!session || typeof chatStore.getOrCreateChat !== 'function') return null
  return chatStore.getOrCreateChat(session)
}

function hasStepMessage(chat, runId, stepId, phase) {
  return getMessages(chat).some((message) =>
    message?._workflowRunId === runId &&
    message?._workflowStepId === stepId &&
    message?._workflowPhase === phase,
  )
}

function pushAssistantMessage(chat, { runId, stepId, phase, text }) {
  if (!chat?.state || !text || hasStepMessage(chat, runId, stepId, phase)) return false
  chat.state.pushMessage({
    id: createMessageId(),
    role: 'assistant',
    parts: [{ type: 'text', text }],
    createdAt: now(),
    _workflowRunId: runId,
    _workflowStepId: stepId,
    _workflowPhase: phase,
  })
  return true
}

function findOpenCheckpoint(run) {
  return (run?.checkpoints || []).find((checkpoint) => checkpoint?.status === 'open') || null
}

function findCheckpointForStep(run, stepId) {
  const checkpoints = (run?.checkpoints || []).filter((checkpoint) => checkpoint?.stepId === stepId)
  return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null
}

function findNextExecutableStep(run) {
  const steps = Array.isArray(run?.steps) ? run.steps : []
  if (!steps.length) return null

  if (run?.currentStepId) {
    const current = steps.find((step) => step.id === run.currentStepId)
    if (current && (current.status === 'running' || current.status === 'pending')) {
      return current
    }
  }

  return steps.find((step) => step.status === 'running')
    || steps.find((step) => step.status === 'pending')
    || null
}

function allStepsCompleted(run) {
  return Array.isArray(run?.steps) && run.steps.length > 0 && run.steps.every((step) => step.status === 'completed')
}

function findCurrentWorkflow(run, workflowStore) {
  const current = workflowStore?.getRun?.(run?.id)
  if (current?.run?.id) return current
  if (!run?.id) return null
  return {
    run: clone(run),
    template: {
      id: run.templateId || '',
      label: run.title || 'Workflow',
      role: '',
      toolProfile: '',
      autoAdvanceUntil: null,
      approvalTypes: [],
    },
  }
}

function buildCheckpointLabel(step) {
  if (!step) return 'Await approval'
  return step.label || step.kind || 'Await approval'
}

function buildContextSummary(context = {}) {
  const file = context.currentFile || context.file || null
  const prompt = String(context.prompt || '').trim()
  const parts = []
  if (file) parts.push(t('File: {file}', { file }))
  if (prompt) parts.push(t('Goal: {prompt}', { prompt }))
  return parts.join(' · ')
}

function buildStepNarrative(workflow, step) {
  const contextSummary = buildContextSummary(workflow?.run?.context)
  switch (step.kind) {
    case 'read_context':
      return contextSummary
        ? t('Read launch context. {summary}.', { summary: contextSummary })
        : t('Read launch context and organized the current task inputs.')
    case 'analyze_goal':
      return t('Clarified the task goal, output boundary, and stop condition for this run.')
    case 'generate_review':
      return t('Generated structured review findings and prepared safe issues for a patch.')
    case 'generate_patch':
      return t('Drafted a patch proposal and paused before applying it.')
    case 'await_patch_decision':
      return t('The patch proposal is ready. Confirm whether to apply these edits.')
    case 'search_local_references':
      return t('Checked local reference context first and shortlisted the closest candidate sources.')
    case 'search_external_sources':
      return t('Local sources were not enough for the target claim, so external candidates were added.')
    case 'generate_citation_set':
      return t('Generated a ranked citation set for the current evidence need.')
    case 'await_source_decision':
      return t('The source shortlist is ready. Confirm which sources to accept.')
    case 'diagnose_issue':
      return t('Collected the most likely failure hypotheses and debugging directions.')
    case 'generate_fix_suggestions':
      return t('Generated the most likely fix suggestions and the next verification steps.')
    case 'inspect_notebook_cells':
      return t('Inspected notebook cells, outputs, and execution order to organize the current analysis context.')
    case 'generate_notebook_plan':
      return t('Generated notebook analysis or edit suggestions and paused before making notebook edits.')
    case 'await_notebook_edit_decision':
      return t('The notebook edit suggestions are ready. Confirm whether to apply these notebook edits.')
    case 'audit_reference_library':
      return t('Scanned the current reference scope and summarized metadata, duplicates, and missing PDF risks.')
    case 'detect_reference_issues':
      return t('Grouped the highest-priority reference maintenance issues and cleanup goals.')
    case 'generate_reference_actions':
      return t('Generated reference maintenance actions and paused before changing the library.')
    case 'await_reference_change_decision':
      return t('The reference maintenance suggestions are ready. Confirm whether to apply these library changes.')
    case 'extract_pdf_findings':
      return t('Extracted the PDF research question, method, evidence, and key conclusions.')
    case 'generate_summary':
      return t('Generated a structured PDF summary that is ready for follow-up questions.')
    case 'compare_source_set':
      return t('Compared overlap, differences, strengths, and fit across the candidate sources.')
    case 'generate_proposal_cards':
      return t('Generated source comparison recommendations and the next reading or adoption moves.')
    case 'diagnose_compile_issue':
      return t('Generated a prioritized diagnosis of the current TeX / Typst compile issues.')
    case 'summarize_outcome':
      return t('Summarized the current workflow outcome and prepared the next follow-up actions.')
    default:
      return t('{step} completed automatically.', {
        step: t(step.label || step.kind || 'Current step'),
      })
  }
}

function buildArtifactForStep(workflow, step) {
  const context = workflow?.run?.context || {}
  const currentFile = context.currentFile || context.file || null
  switch (step.kind) {
    case 'generate_review':
      return {
        type: 'review',
        stepId: step.id,
        title: 'Review notes',
        summary: 'Structured review findings generated from the current draft context.',
        file: currentFile,
      }
    case 'generate_patch':
      return {
        type: 'patch',
        stepId: step.id,
        title: 'Patch proposal',
        summary: 'Drafted safe edits for the identified issues.',
        file: currentFile,
      }
    case 'generate_citation_set':
      return {
        type: 'citation_set',
        stepId: step.id,
        title: 'Citation candidates',
        summary: 'Ranked source shortlist generated for the current evidence need.',
        file: currentFile,
      }
    case 'diagnose_issue':
      return {
        type: 'diagnosis',
        stepId: step.id,
        title: 'Diagnosis notes',
        summary: 'Most likely causes collected for the current debugging task.',
        file: currentFile,
      }
    case 'generate_fix_suggestions':
      return {
        type: 'fix_suggestions',
        stepId: step.id,
        title: 'Fix suggestions',
        summary: 'Actionable fix suggestions generated for the current issue.',
        file: currentFile,
      }
    case 'generate_notebook_plan':
      return {
        type: 'proposal',
        stepId: step.id,
        title: 'Notebook plan',
        summary: 'Concrete notebook analysis or edit suggestions generated from the current notebook context.',
        file: currentFile,
      }
    case 'generate_reference_actions':
      return {
        type: 'proposal',
        stepId: step.id,
        title: 'Reference actions',
        summary: 'Prioritized reference maintenance actions generated for the current library scope.',
        file: currentFile,
      }
    case 'generate_summary':
      return {
        type: 'note_bundle',
        stepId: step.id,
        title: 'PDF summary',
        summary: 'Structured PDF summary generated from the current paper context.',
        file: currentFile,
      }
    case 'generate_proposal_cards':
      return {
        type: 'proposal',
        stepId: step.id,
        title: 'Source comparison',
        summary: 'Comparison takeaways and next-step recommendations generated for the candidate sources.',
        file: currentFile,
      }
    case 'diagnose_compile_issue':
      return {
        type: 'compile_diagnosis',
        stepId: step.id,
        title: 'Compile diagnosis',
        summary: 'Structured compile diagnosis generated for the current TeX / Typst file.',
        file: currentFile,
      }
    default:
      return null
  }
}

function hasArtifactForStep(run, step, artifactType) {
  if (artifactType === 'compile_diagnosis') {
    return (run?.artifacts || []).some((artifact) => artifact?.type === 'compile_diagnosis')
  }
  return (run?.artifacts || []).some((artifact) =>
    artifact?.stepId === step.id &&
    (!artifactType || artifact?.type === artifactType),
  )
}

async function persistWorkflow(workflowStore, workflow, { chatStore, sessionId }) {
  const stored = workflowStore?.replaceRun?.(workflow) || workflow
  const session = findSession(chatStore, sessionId)
  if (session && workflowStore?.syncRunToSession) {
    workflowStore.syncRunToSession(session)
    session.updatedAt = now()
  }
  if (chatStore && sessionId && typeof chatStore.saveSession === 'function') {
    await chatStore.saveSession(sessionId)
  }
  return stored
}

async function handleAutomaticStep({ workflow, step, chat, chatStore, sessionId, workflowStore }) {
  let nextRun = workflow.run
  if (step.status !== 'running') {
    nextRun = markStepRunning(nextRun, step.id)
  }

  const artifact = buildArtifactForStep(workflow, step)
  if (artifact && !hasArtifactForStep(nextRun, step, artifact.type)) {
    nextRun = attachArtifact(nextRun, artifact)
  }

  pushAssistantMessage(chat, {
    runId: nextRun.id,
    stepId: step.id,
    phase: 'completed',
    text: buildStepNarrative({ ...workflow, run: nextRun }, step),
  })

  nextRun = markStepCompleted(nextRun, step.id)
  return persistWorkflow(workflowStore, { ...workflow, run: nextRun }, { chatStore, sessionId })
}

async function handleApprovalStep({ workflow, step, chat, chatStore, sessionId, workflowStore }) {
  const policy = getTemplatePolicy(workflow?.template?.id || workflow?.run?.templateId)
  let nextRun = workflow.run
  if (step.status !== 'running') {
    nextRun = markStepRunning(nextRun, step.id)
  }

  const checkpoint = findCheckpointForStep(nextRun, step.id)
  if (checkpoint?.status === 'resolved') {
    nextRun = markStepCompleted(nextRun, step.id)
    return persistWorkflow(workflowStore, { ...workflow, run: nextRun }, { chatStore, sessionId })
  }

  if (!checkpoint || checkpoint.status !== 'open') {
    pushAssistantMessage(chat, {
      runId: nextRun.id,
      stepId: step.id,
      phase: 'awaiting-approval',
      text: buildStepNarrative({ ...workflow, run: nextRun }, step),
    })

    nextRun = createCheckpoint(nextRun, {
      stepId: step.id,
      type: step.approvalType || policy.approvalType || 'checkpoint',
      label: buildCheckpointLabel(step),
    })
  }

  return persistWorkflow(workflowStore, { ...workflow, run: nextRun }, { chatStore, sessionId })
}

export async function executeWorkflowRun({ run, sessionId, chatStore, workflowStore } = {}) {
  const initialWorkflow = findCurrentWorkflow(run, workflowStore)
  if (!initialWorkflow?.run?.id) return null

  let workflow = initialWorkflow
  const chat = getOrCreateChatInstance(chatStore, sessionId)
  const maxIterations = Math.max((workflow.run.steps || []).length * 2, 4)

  try {
    if (workflow.run.status === 'planned' || workflow.run.status === 'draft') {
      workflow = await persistWorkflow(
        workflowStore,
        { ...workflow, run: markRunRunning(workflow.run) },
        { chatStore, sessionId },
      )
    }

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      workflow = findCurrentWorkflow(workflow.run, workflowStore) || workflow

      if (!workflow?.run?.id) return null
      if (workflow.run.status === 'completed' || workflow.run.status === 'failed') break
      if (findOpenCheckpoint(workflow.run)) break

      const step = findNextExecutableStep(workflow.run)
      if (!step) {
        if (allStepsCompleted(workflow.run) && workflow.run.status !== 'completed') {
          workflow = await persistWorkflow(
            workflowStore,
            { ...workflow, run: markRunCompleted(workflow.run) },
            { chatStore, sessionId },
          )
        }
        break
      }

      const policy = getTemplatePolicy(workflow.template?.id || workflow.run.templateId)
      const isApprovalBoundary = step.requiresApproval
        || (policy.approvalStepKind && step.kind === policy.approvalStepKind)

      workflow = isApprovalBoundary
        ? await handleApprovalStep({ workflow, step, chat, chatStore, sessionId, workflowStore })
        : await handleAutomaticStep({ workflow, step, chat, chatStore, sessionId, workflowStore })

      if (findOpenCheckpoint(workflow.run)) break
    }
  } catch (error) {
    const failedWorkflow = {
      ...workflow,
      run: markRunFailed(workflow.run, error),
    }
    pushAssistantMessage(chat, {
      runId: failedWorkflow.run.id,
      stepId: failedWorkflow.run.currentStepId || 'workflow-error',
      phase: 'error',
      text: t('Workflow execution failed: {error}', {
        error: error?.message || String(error),
      }),
    })
    workflow = await persistWorkflow(workflowStore, failedWorkflow, { chatStore, sessionId })
  }

  return findCurrentWorkflow(workflow.run, workflowStore) || workflow
}
