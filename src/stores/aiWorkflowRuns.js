import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createWorkflowPlan } from '../services/ai/workflowRuns/planner.js'
import { resolveCheckpoint } from '../services/ai/workflowRuns/state.js'

function clone(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {}
  }
  return JSON.parse(JSON.stringify(value))
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeTemplate(template = {}) {
  if (!isRecord(template)) return null

  const id = String(template.id || '').trim()
  if (!id) return null

  return {
    id,
    label: String(template.label || ''),
    role: String(template.role || ''),
    toolProfile: String(template.toolProfile || ''),
    autoAdvanceUntil: template.autoAdvanceUntil ? String(template.autoAdvanceUntil) : null,
    approvalTypes: Array.isArray(template.approvalTypes)
      ? template.approvalTypes.map((type) => String(type)).filter(Boolean)
      : [],
  }
}

export function hydrateSessionWorkflow(snapshot = null) {
  if (!isRecord(snapshot)) return null

  const run = isRecord(snapshot.run) ? clone(snapshot.run) : null
  const template = normalizeTemplate(snapshot.template)

  if (!run?.id || !template) return null

  return {
    run,
    template,
  }
}

export function serializeSessionWorkflow(workflow = null) {
  const normalized = hydrateSessionWorkflow(workflow)
  return normalized ? clone(normalized) : null
}

function findOpenCheckpoint(run) {
  return (run?.checkpoints || []).find((checkpoint) => checkpoint?.status === 'open') || null
}

function findCurrentStep(run) {
  const steps = run?.steps || []
  if (!steps.length) return null

  if (run?.currentStepId) {
    const current = steps.find((step) => step.id === run.currentStepId)
    if (current) return current
  }

  return steps.find((step) => step.status === 'running')
    || steps.find((step) => step.status === 'pending')
    || steps[steps.length - 1]
    || null
}

export const useAiWorkflowRunsStore = defineStore('aiWorkflowRuns', () => {
  const byRunId = ref({})
  const sessionRunMap = ref({})
  const activeRunId = ref(null)

  const activeRun = computed(() => {
    if (!activeRunId.value) return null
    return byRunId.value[activeRunId.value] || null
  })

  function getRun(runId) {
    if (!runId) return null
    return byRunId.value[runId] || null
  }

  function getRunForSession(sessionId) {
    if (!sessionId) return null
    const runId = sessionRunMap.value[sessionId]
    return runId ? getRun(runId) : null
  }

  function dropRunIfUnbound(runId) {
    if (!runId || !byRunId.value[runId]) return
    const stillBound = Object.values(sessionRunMap.value).some((candidate) => candidate === runId)
    if (stillBound) return

    const nextRuns = { ...byRunId.value }
    delete nextRuns[runId]
    byRunId.value = nextRuns

    if (activeRunId.value === runId) {
      activeRunId.value = null
    }
  }

  function storeWorkflow(workflow) {
    const snapshot = serializeSessionWorkflow(workflow)
    if (!snapshot) return null

    byRunId.value = {
      ...byRunId.value,
      [snapshot.run.id]: snapshot,
    }

    return byRunId.value[snapshot.run.id]
  }

  function restoreSessionWorkflow(sessionId, workflow = null) {
    const snapshot = serializeSessionWorkflow(workflow)
    if (!snapshot) {
      clearSessionBinding(sessionId)
      return null
    }

    storeWorkflow(snapshot)
    bindRunToSession(sessionId, snapshot.run.id)
    return getRun(snapshot.run.id)
  }

  function createRunFromTemplate({ templateId, sessionId = null, context = {} } = {}) {
    const workflow = createWorkflowPlan({ templateId, context })
    storeWorkflow(workflow)

    if (sessionId) {
      bindRunToSession(sessionId, workflow.run.id)
    }

    setActiveRun(workflow.run.id)
    return getRun(workflow.run.id)
  }

  function bindRunToSession(sessionId, runId) {
    if (!sessionId || !runId || !byRunId.value[runId]) return null

    const previousRunId = sessionRunMap.value[sessionId] || null
    sessionRunMap.value = {
      ...sessionRunMap.value,
      [sessionId]: runId,
    }

    if (previousRunId && previousRunId !== runId) {
      dropRunIfUnbound(previousRunId)
    }

    return getRun(runId)
  }

  function clearSessionBinding(sessionId) {
    if (!sessionId || !sessionRunMap.value[sessionId]) return

    const runId = sessionRunMap.value[sessionId]
    const nextMap = { ...sessionRunMap.value }
    delete nextMap[sessionId]
    sessionRunMap.value = nextMap

    dropRunIfUnbound(runId)
  }

  function setActiveRun(runId) {
    activeRunId.value = runId && byRunId.value[runId] ? runId : null
    return activeRun.value
  }

  function applyCheckpointDecision({ runId, checkpointId = null, decision, resolvedBy = 'user' } = {}) {
    const current = getRun(runId)
    if (!current) return null

    const targetCheckpointId = checkpointId || current.run.currentCheckpointId || findOpenCheckpoint(current.run)?.id
    if (!targetCheckpointId) return current

    const nextRun = resolveCheckpoint(clone(current.run), targetCheckpointId, {
      resolvedBy,
      payload: decision === undefined ? undefined : clone(decision),
    })

    const nextWorkflow = {
      ...current,
      run: nextRun,
    }

    storeWorkflow(nextWorkflow)
    if (activeRunId.value === runId) {
      activeRunId.value = runId
    }
    return getRun(runId)
  }

  function syncRunToSession(session) {
    if (!session?.id) return null

    let runId = sessionRunMap.value[session.id] || null
    if (!runId && session._workflow) {
      const restored = restoreSessionWorkflow(session.id, session._workflow)
      runId = restored?.run?.id || null
    }

    if (!runId) {
      session._workflow = null
      return null
    }

    const workflow = getRun(runId)
    const snapshot = serializeSessionWorkflow(workflow)
    session._workflow = snapshot
    return snapshot
  }

  function describeRun(runId) {
    const workflow = typeof runId === 'string' ? getRun(runId) : serializeSessionWorkflow(runId)
    if (!workflow) return null

    const currentStep = findCurrentStep(workflow.run)
    return {
      label: workflow.template.label || workflow.run.title || 'Workflow',
      status: workflow.run.status || 'draft',
      currentStepLabel: currentStep?.label || null,
      approvalPending: Boolean(findOpenCheckpoint(workflow.run)),
      templateId: workflow.template.id || workflow.run.templateId || null,
    }
  }

  function clearAll() {
    byRunId.value = {}
    sessionRunMap.value = {}
    activeRunId.value = null
  }

  return {
    byRunId,
    sessionRunMap,
    activeRunId,
    activeRun,
    getRun,
    getRunForSession,
    restoreSessionWorkflow,
    createRunFromTemplate,
    bindRunToSession,
    clearSessionBinding,
    setActiveRun,
    applyCheckpointDecision,
    syncRunToSession,
    describeRun,
    clearAll,
  }
})
