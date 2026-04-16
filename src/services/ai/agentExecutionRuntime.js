import { extractJsonPayload } from '../../domains/ai/aiArtifactRuntime.js'
import { t } from '../../i18n/index.js'
import { runAiProviderRuntime } from './runtime/providerRuntime.js'

function upsertEvent(events = [], nextEvent = {}) {
  const toolId = String(nextEvent.toolId || nextEvent.id || '').trim()
  if (!toolId) return events

  const normalizedEvent = {
    ...nextEvent,
    toolId,
  }
  const nextEvents = Array.isArray(events) ? [...events] : []
  const existingIndex = nextEvents.findIndex((event) => String(event.toolId || '') === toolId)

  if (existingIndex >= 0) {
    nextEvents.splice(existingIndex, 1, {
      ...nextEvents[existingIndex],
      ...normalizedEvent,
    })
    return nextEvents
  }

  nextEvents.push(normalizedEvent)
  return nextEvents
}

function buildToolEvent({
  toolId = '',
  status = 'done',
  label = '',
  context = '',
  detail = '',
  payload = null,
} = {}) {
  return {
    eventType: 'tool',
    toolId: String(toolId || '').trim(),
    status: String(status || 'done').trim() || 'done',
    label: String(label || '').trim(),
    context: String(context || '').trim(),
    detail: String(detail || '').trim(),
    payload: payload && typeof payload === 'object' ? payload : null,
  }
}

function buildAssistantStreamEvent(eventType = '', text = '', delta = '') {
  return {
    eventType,
    text: String(text || ''),
    delta: String(delta || ''),
  }
}

function buildTaskProgressDetail(event = {}) {
  const segments = []
  const description = String(event.description || '').trim()
  const lastToolName = String(event.lastToolName || '').trim()
  const elapsedSeconds = Number(event.elapsedSeconds || 0)

  if (description) segments.push(description)
  if (lastToolName) segments.push(lastToolName)
  if (elapsedSeconds > 0) {
    segments.push(t('Running for about {count}s.', { count: elapsedSeconds }))
  }

  return segments.join(' · ')
}

function isPassthroughRuntimeEvent(event = {}) {
  return [
    'ask_user_request',
    'ask_user_resolved',
    'exit_plan_mode_request',
    'exit_plan_mode_resolved',
    'plan_mode_start',
    'plan_mode_end',
    'background_task',
    'compacting',
    'compact_complete',
    'permission_mode_changed',
    'task_started',
    'task_progress',
    'task_notification',
    'waiting_resume',
    'resume_start',
  ].includes(String(event?.type || '').trim())
}

function mapRuntimeEventToToolEvent(event = {}) {
  if (event.type === 'compacting') {
    return buildToolEvent({
      toolId: 'runtime:compacting',
      status: 'running',
      label: t('Compact context'),
      detail: t('The runtime is compacting earlier context before continuing.'),
      payload: { eventType: event.type },
    })
  }

  if (event.type === 'compact_complete') {
    return buildToolEvent({
      toolId: 'runtime:compacting',
      status: 'done',
      label: t('Compact context'),
      detail: t('Context compaction completed.'),
      payload: { eventType: event.type },
    })
  }

  if (event.type === 'tool_call_start') {
    const toolName = String(event.toolName || 'tool')
    return buildToolEvent({
      toolId: `runtime:${event.toolCallId || event.toolName || 'tool'}`,
      status: 'running',
      label: toolName,
      detail: t('The model requested a local tool call and is waiting for the result.'),
      payload: {
        eventType: event.type,
        toolName,
        toolCallId: event.toolCallId,
      },
    })
  }

  if (event.type === 'tool_call_progress') {
    const elapsedSeconds = Number(event.elapsedSeconds || 0)
    const toolName = String(event.toolName || 'tool')
    return buildToolEvent({
      toolId: `runtime:${event.toolCallId || event.toolName || 'tool'}`,
      status: 'running',
      label: toolName,
      detail:
        elapsedSeconds > 0
          ? t('Running for about {count}s.', { count: elapsedSeconds })
          : t('The model requested a local tool call and is waiting for the result.'),
      payload: {
        eventType: event.type,
        toolName,
        toolCallId: event.toolCallId,
        elapsedSeconds,
      },
    })
  }

  if (event.type === 'tool_call_done') {
    const toolName = String(event.toolName || 'tool')
    return buildToolEvent({
      toolId: `runtime:${event.toolCallId || event.toolName || 'tool'}`,
      status: event.isError ? 'error' : 'done',
      label: toolName,
      detail:
        String(event.detail || '').trim() ||
        (event.isError ? t('The tool run failed.') : t('The tool run completed.')),
      payload: {
        eventType: event.type,
        toolName,
        toolCallId: event.toolCallId,
        isError: event.isError === true,
      },
    })
  }

  if (event.type === 'task_started' && event.taskId) {
    return buildToolEvent({
      toolId: `task:${event.taskId}`,
      status: 'running',
      label: t('Background task'),
      context: String(event.taskType || event.taskId || '').trim(),
      detail: String(event.description || '').trim() || t('The agent started a background task.'),
      payload: {
        eventType: event.type,
        taskId: event.taskId,
        taskType: event.taskType,
        toolUseId: event.toolUseId,
      },
    })
  }

  if (event.type === 'task_progress' && event.taskId) {
    return buildToolEvent({
      toolId: `task:${event.taskId}`,
      status: 'running',
      label: t('Background task'),
      context: String(event.lastToolName || event.taskId || '').trim(),
      detail: buildTaskProgressDetail(event) || t('The agent started a background task.'),
      payload: {
        eventType: event.type,
        taskId: event.taskId,
        toolUseId: event.toolUseId,
        elapsedSeconds: Number(event.elapsedSeconds || 0) || 0,
        usage: event.usage || null,
      },
    })
  }

  if (event.type === 'task_notification' && event.taskId) {
    return buildToolEvent({
      toolId: `task:${event.taskId}`,
      status: event.status === 'failed' ? 'error' : 'done',
      label: t('Background task'),
      context: String(event.taskId || '').trim(),
      detail:
        String(event.summary || '').trim() ||
        (event.status === 'failed' ? t('The tool run failed.') : t('The tool run completed.')),
      payload: {
        eventType: event.type,
        taskId: event.taskId,
        toolUseId: event.toolUseId,
        status: event.status,
        outputFile: event.outputFile,
        usage: event.usage || null,
      },
    })
  }

  if (event.type === 'permission_request') {
    return buildToolEvent({
      toolId: `permission:${event.requestId || event.toolUseId || event.toolName || 'tool'}`,
      status: 'running',
      label: t('Permission request'),
      context: String(event.displayName || event.toolName || 'tool'),
      detail:
        String(event.title || '').trim() ||
        String(event.description || '').trim() ||
        t('The model is waiting for your approval before using a built-in tool.'),
      payload: {
        eventType: event.type,
        toolName: event.toolName,
        requestId: event.requestId,
      },
    })
  }

  if (event.type === 'permission_resolved') {
    return buildToolEvent({
      toolId: `permission:${event.requestId || event.toolUseId || event.toolName || 'tool'}`,
      status: event.behavior === 'allow' ? 'done' : 'error',
      label: t('Permission request'),
      context: String(event.toolName || 'tool'),
      detail:
        event.behavior === 'allow'
          ? t('You approved this tool request.')
          : t('You denied this tool request.'),
      payload: {
        eventType: event.type,
        toolName: event.toolName,
        requestId: event.requestId,
        behavior: event.behavior,
      },
    })
  }

  return null
}

export async function runAiAgentExecutionRuntime({
  providerId = 'openai',
  config = {},
  apiKey = '',
  conversation = [],
  userPrompt = '',
  systemPrompt = '',
  contextBundle = {},
  supportFiles = [],
  enabledToolIds = [],
  toolRuntime = {},
  onEvent,
  signal,
  runtimeRunner = runAiProviderRuntime,
} = {}) {
  let events = []
  let streamedContent = ''
  let streamedReasoning = ''

  const emitEvent = (event = {}) => {
    events = upsertEvent(events, event)
    onEvent?.(event, events)
  }

  const response = await runtimeRunner({
    providerId,
    config,
    apiKey,
    history: conversation,
    userMessage: userPrompt,
    systemMessage: systemPrompt,
    contextBundle,
    supportFiles,
    enabledToolIds,
    toolRuntime,
    onEvent: (runtimeEvent) => {
      if (runtimeEvent.type === 'chunk') {
        streamedContent += String(runtimeEvent.delta || '')
        onEvent?.(
          buildAssistantStreamEvent('assistant-content', streamedContent, runtimeEvent.delta),
          events
        )
        return
      }

      if (runtimeEvent.type === 'reasoning') {
        streamedReasoning += String(runtimeEvent.delta || '')
        onEvent?.(
          buildAssistantStreamEvent('assistant-reasoning', streamedReasoning, runtimeEvent.delta),
          events
        )
        return
      }

      if (isPassthroughRuntimeEvent(runtimeEvent)) {
        onEvent?.(runtimeEvent, events)
      }

      const mappedToolEvent = mapRuntimeEventToToolEvent(runtimeEvent)
      if (mappedToolEvent) {
        emitEvent(mappedToolEvent)
      }
    },
    signal,
  })

  const content = response.content || streamedContent
  const reasoning = response.reasoning || streamedReasoning
  const transport =
    String(response.transport || '').trim() ||
    (providerId === 'anthropic' && String(config?.sdk?.runtimeMode || 'http') === 'sdk'
      ? 'anthropic-sdk'
      : 'http')

  for (const toolRound of Array.isArray(response.toolRounds) ? response.toolRounds : []) {
    for (const toolCall of Array.isArray(toolRound.toolCalls) ? toolRound.toolCalls : []) {
      emitEvent(
        buildToolEvent({
          toolId: `runtime:${toolCall.id || toolCall.name || 'tool'}`,
          status: toolCall.result?.isError ? 'error' : 'done',
          label: String(toolCall.name || 'tool'),
          detail: String(toolCall.result?.content || '').slice(0, 220),
        })
      )
    }
  }

  return {
    content,
    reasoning,
    transport,
    payload: extractJsonPayload(content) || {
      answer: content,
      rationale: reasoning,
    },
    events,
  }
}
