import { t } from '../../i18n/index.js'

function mergeToolEventRecord(events = [], nextEvent = {}) {
  const toolId = String(nextEvent.toolId || nextEvent.id || '').trim()
  if (!toolId) return Array.isArray(events) ? events : []

  const nextEvents = Array.isArray(events) ? [...events] : []
  const existingIndex = nextEvents.findIndex((event) => String(event.toolId || '') === toolId)

  if (existingIndex >= 0) {
    nextEvents.splice(existingIndex, 1, {
      ...nextEvents[existingIndex],
      ...nextEvent,
      toolId,
    })
    return nextEvents
  }

  nextEvents.push({
    ...nextEvent,
    toolId,
  })
  return nextEvents
}

function normalizeBackgroundTaskStatus(status = 'running') {
  const normalized = String(status || 'running')
    .trim()
    .toLowerCase()
  if (['failed', 'error'].includes(normalized)) return 'error'
  if (['done', 'completed', 'stopped'].includes(normalized)) return 'done'
  return 'running'
}

function findBackgroundTaskIndex(tasks = [], task = {}) {
  const normalizedId = String(task.id || '').trim()
  const normalizedTaskId = String(task.taskId || '').trim()
  const normalizedToolUseId = String(task.toolUseId || task.toolId || '').trim()

  return (Array.isArray(tasks) ? tasks : []).findIndex((entry) => {
    if (normalizedTaskId && String(entry.taskId || '').trim() === normalizedTaskId) return true
    if (normalizedToolUseId && String(entry.toolUseId || '').trim() === normalizedToolUseId) {
      return true
    }
    if (normalizedId && String(entry.id || '').trim() === normalizedId) return true
    return false
  })
}

function buildBackgroundTaskRecord(task = {}, previous = null, translate = t) {
  const taskId = String(task.taskId || previous?.taskId || '').trim()
  const toolUseId = String(
    task.toolUseId || task.toolId || previous?.toolUseId || task.id || ''
  ).trim()
  const recordId = taskId ? `task:${taskId}` : toolUseId ? `tool:${toolUseId}` : ''
  const detail = String(
    task.detail || task.description || task.summary || previous?.detail || ''
  ).trim()
  const elapsedSeconds = Number(task.elapsedSeconds)
  const usage =
    task.usage && typeof task.usage === 'object'
      ? task.usage
      : previous?.usage && typeof previous.usage === 'object'
        ? previous.usage
        : null

  return {
    id: recordId,
    taskId,
    toolUseId,
    label: String(
      task.label ||
        task.title ||
        previous?.label ||
        task.lastToolName ||
        task.taskType ||
        toolUseId ||
        taskId ||
        translate('Background task')
    ).trim(),
    status: normalizeBackgroundTaskStatus(task.status || previous?.status || 'running'),
    detail,
    taskType: String(task.taskType || previous?.taskType || '').trim(),
    lastToolName: String(task.lastToolName || previous?.lastToolName || '').trim(),
    outputFile: String(task.outputFile || previous?.outputFile || '').trim(),
    elapsedSeconds: Number.isFinite(elapsedSeconds)
      ? Math.max(0, Math.round(elapsedSeconds))
      : Number(previous?.elapsedSeconds || 0) || 0,
    usage,
    updatedAt: Date.now(),
  }
}

export function mergeAgentRunToolEventState(events = [], event = {}) {
  return mergeToolEventRecord(events, event)
}

export function upsertQueuedRequestState(requests = [], nextRequest = {}) {
  const requestId = String(nextRequest.requestId || '').trim()
  if (!requestId) return Array.isArray(requests) ? requests : []

  return [
    ...(Array.isArray(requests) ? requests : []).filter(
      (request) => request.requestId !== requestId
    ),
    nextRequest,
  ]
}

export function removeQueuedRequestState(requests = [], requestId = '') {
  const normalizedRequestId = String(requestId || '').trim()
  if (!normalizedRequestId) return Array.isArray(requests) ? requests : []

  return (Array.isArray(requests) ? requests : []).filter(
    (request) => request.requestId !== normalizedRequestId
  )
}

export function buildAgentPlanModeState(planMode = {}) {
  return {
    active: planMode.active === true,
    summary: String(planMode.summary || '').trim(),
    note: String(planMode.note || '').trim(),
  }
}

export function applyAgentRunBackgroundTaskEvent(session = {}, event = {}, translate = t) {
  const entries = Array.isArray(session.backgroundTasks) ? [...session.backgroundTasks] : []
  const existingIndex = findBackgroundTaskIndex(entries, event)
  const previous = existingIndex >= 0 ? entries[existingIndex] : null
  const nextTask = buildBackgroundTaskRecord(event, previous, translate)

  if (String(nextTask.id || '').trim()) {
    if (existingIndex >= 0) {
      entries.splice(existingIndex, 1, nextTask)
    } else {
      entries.push(nextTask)
    }
  }

  return {
    ...session,
    backgroundTasks: entries
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
      .slice(0, 12),
  }
}
