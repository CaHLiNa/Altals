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
  if (file) parts.push(`文件：${file}`)
  if (prompt) parts.push(`目标：${prompt}`)
  return parts.join('；')
}

function buildStepNarrative(workflow, step) {
  const contextSummary = buildContextSummary(workflow?.run?.context)
  switch (step.kind) {
    case 'read_context':
      return contextSummary
        ? `已读取启动上下文。${contextSummary}。`
        : '已读取启动上下文，并整理了当前任务的输入材料。'
    case 'analyze_goal':
      return '已提炼任务目标，明确了这次运行的输出边界和停止条件。'
    case 'generate_review':
      return '已生成结构化审阅要点，准备把可安全修改的问题整理成补丁。'
    case 'generate_patch':
      return '已生成可直接应用的补丁草案，并在应用前停下来等待确认。'
    case 'await_patch_decision':
      return '补丁草案已准备好。请确认是否继续应用这些修改。'
    case 'search_local_references':
      return '已先检查本地参考文献上下文，筛出和当前论点最接近的候选来源。'
    case 'search_external_sources':
      return '本地来源不足以覆盖目标论点，已补充外部检索候选。'
    case 'generate_citation_set':
      return '已整理候选引文集合，并按相关性和证据匹配度完成排序。'
    case 'await_source_decision':
      return '候选来源清单已准备好。请确认要接受哪些来源。'
    case 'diagnose_issue':
      return '已整理当前问题的主要故障假设和排查方向。'
    case 'generate_fix_suggestions':
      return '已生成最可能有效的修复建议，并给出后续验证方向。'
    case 'summarize_outcome':
      return '本次工作流的阶段性结果已汇总，可以直接继续对话细化后续动作。'
    default:
      return `${step.label || step.kind || '当前步骤'} 已自动完成。`
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
    default:
      return null
  }
}

function hasArtifactForStep(run, step, artifactType) {
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
      text: `工作流执行失败：${error?.message || String(error)}`,
    })
    workflow = await persistWorkflow(workflowStore, failedWorkflow, { chatStore, sessionId })
  }

  return findCurrentWorkflow(workflow.run, workflowStore) || workflow
}
