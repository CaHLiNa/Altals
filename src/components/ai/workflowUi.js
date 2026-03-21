import { t } from '../../i18n/index.js'

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function resolveWorkflow(value) {
  if (!isRecord(value)) return null
  if (isRecord(value.run)) {
    return {
      run: value.run,
      template: isRecord(value.template) ? value.template : null,
    }
  }
  if (Array.isArray(value.steps) || Array.isArray(value.checkpoints)) {
    return {
      run: value,
      template: isRecord(value.template) ? value.template : null,
    }
  }
  return null
}

function findCurrentStep(run) {
  const steps = Array.isArray(run?.steps) ? run.steps : []
  if (!steps.length) return null

  if (run?.currentStepId) {
    const current = steps.find((step) => step?.id === run.currentStepId)
    if (current) return current
  }

  return steps.find((step) => step?.status === 'running')
    || steps.find((step) => step?.status === 'pending')
    || steps[steps.length - 1]
    || null
}

export function describeWorkflowHeader(value) {
  const workflow = resolveWorkflow(value)
  const run = workflow?.run
  if (!run) return null

  const rawTemplateLabel = String(workflow?.template?.label || run.templateLabel || '').trim()
  const rawTitle = String(run.title || rawTemplateLabel || 'Workflow').trim() || 'Workflow'
  const currentStep = findCurrentStep(run)

  return {
    title: t(rawTitle),
    templateLabel: t(rawTemplateLabel || rawTitle),
    status: String(run.status || 'draft'),
    currentStepLabel: currentStep?.label ? t(currentStep.label) : null,
    artifactCount: Array.isArray(run.artifacts) ? run.artifacts.length : 0,
    executionMode: String(run.executionMode || 'foreground'),
    backgroundCapable: run.backgroundCapable !== false,
    lastHeartbeatAt: run.lastHeartbeatAt || null,
    resumeHint: run.resumeHint ? t(run.resumeHint) : null,
  }
}

export function getPendingCheckpoint(value) {
  const workflow = resolveWorkflow(value)
  const run = workflow?.run
  if (!run) return null

  const checkpoints = Array.isArray(run.checkpoints) ? run.checkpoints : []
  if (!checkpoints.length) return null

  const currentCheckpointId = String(run.currentCheckpointId || '').trim()
  if (currentCheckpointId) {
    const current = checkpoints.find((checkpoint) => checkpoint?.id === currentCheckpointId && checkpoint?.status === 'open')
    if (current) return current
  }

  return checkpoints.find((checkpoint) => checkpoint?.status === 'open') || null
}

export function shouldPersistCheckpointLater(action) {
  return String(action || '').trim() === 'continue_later'
}
