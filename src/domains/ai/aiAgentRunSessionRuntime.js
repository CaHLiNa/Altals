import {
  applyAiConversationEventToMessage,
  buildAiAssistantConversationMessage,
  buildAiFailedAssistantMessage,
  buildAiPendingAssistantMessage,
  buildAiUserConversationMessage,
} from './aiConversationRuntime.js'
import {
  applyAgentRunBackgroundTaskEvent,
  buildAgentPlanModeState,
  removeQueuedRequestState,
  upsertQueuedRequestState,
} from './aiAgentRunEventState.js'
import { deriveAiSessionTitle, normalizeAiSessionPermissionMode } from './aiSessionRuntime.js'
import { t } from '../../i18n/index.js'

function applyPendingAssistantEvent(messages = [], pendingAssistantId = '', event = {}) {
  const normalizedPendingAssistantId = String(pendingAssistantId || '').trim()
  if (!normalizedPendingAssistantId) return Array.isArray(messages) ? messages : []

  return (Array.isArray(messages) ? messages : []).map((message) =>
    message.id === normalizedPendingAssistantId
      ? applyAiConversationEventToMessage(message, event)
      : message
  )
}

export function startAgentRunSessionState({
  session = null,
  skill = null,
  providerState = {},
  contextBundle = {},
  userInstruction = '',
  promptDraft = '',
  effectivePermissionMode = 'accept-edits',
  pendingAssistantId = '',
  userMessageId = '',
  createdAt = Date.now(),
  fallbackTitle = 'New session',
} = {}) {
  const currentSession = session && typeof session === 'object' ? session : {}
  const userMessage = buildAiUserConversationMessage({
    id: userMessageId,
    skill,
    userInstruction,
    contextBundle,
    createdAt,
  })
  const pendingAssistantMessage = buildAiPendingAssistantMessage({
    id: pendingAssistantId,
    skill,
    providerState,
    contextBundle,
    createdAt: createdAt + 1,
  })
  const currentMessages = Array.isArray(currentSession.messages) ? currentSession.messages : []

  return {
    assistantMessage: pendingAssistantMessage,
    userMessage,
    session: {
      ...currentSession,
      title:
        currentMessages.length === 0
          ? deriveAiSessionTitle(
              userInstruction || promptDraft,
              currentSession.title || fallbackTitle
            )
          : currentSession.title,
      messages: [...currentMessages, userMessage, pendingAssistantMessage],
      isRunning: true,
      lastError: '',
      waitingResume: false,
      waitingResumeMessage: '',
      permissionMode:
        effectivePermissionMode === 'chat'
          ? currentSession.permissionMode
          : normalizeAiSessionPermissionMode(effectivePermissionMode),
    },
  }
}

export function applyAgentRunEventToSessionState({
  session = null,
  event = {},
  pendingAssistantId = '',
  translate = t,
} = {}) {
  const currentSession = session && typeof session === 'object' ? session : {}
  let nextSession = {
    ...currentSession,
  }

  if (String(event?.transport || '').trim()) {
    nextSession.runtimeTransport = String(event.transport || '').trim()
  }

  if (event?.type === 'permission_request') {
    nextSession.permissionRequests = upsertQueuedRequestState(currentSession.permissionRequests, {
      requestId: String(event.requestId || event.toolUseId || '').trim(),
      streamId: String(event.streamId || '').trim(),
      toolName: String(event.toolName || '').trim(),
      displayName: String(event.displayName || event.toolName || '').trim(),
      title: String(event.title || '').trim(),
      description: String(event.description || '').trim(),
      decisionReason: String(event.decisionReason || '').trim(),
      inputPreview: String(event.inputPreview || '').trim(),
    })
  }

  if (event?.type === 'permission_resolved') {
    nextSession.permissionRequests = removeQueuedRequestState(
      nextSession.permissionRequests || currentSession.permissionRequests,
      event.requestId || event.toolUseId
    )
  }

  if (event?.type === 'ask_user_request') {
    nextSession.askUserRequests = upsertQueuedRequestState(currentSession.askUserRequests, {
      requestId: String(event.requestId || '').trim(),
      streamId: String(event.streamId || '').trim(),
      title: String(event.title || '').trim(),
      prompt: String(event.prompt || event.question || '').trim(),
      description: String(event.description || '').trim(),
      questions: Array.isArray(event.questions) ? event.questions : [],
    })
  }

  if (event?.type === 'ask_user_resolved') {
    nextSession.askUserRequests = removeQueuedRequestState(
      nextSession.askUserRequests || currentSession.askUserRequests,
      event.requestId
    )
  }

  if (event?.type === 'exit_plan_mode_request') {
    nextSession.exitPlanRequests = upsertQueuedRequestState(currentSession.exitPlanRequests, {
      requestId: String(event.requestId || '').trim(),
      streamId: String(event.streamId || '').trim(),
      toolUseId: String(event.toolUseId || '').trim(),
      title: String(event.title || '').trim(),
      allowedPrompts: Array.isArray(event.allowedPrompts) ? event.allowedPrompts : [],
    })
  }

  if (event?.type === 'exit_plan_mode_resolved') {
    nextSession.exitPlanRequests = removeQueuedRequestState(
      nextSession.exitPlanRequests || currentSession.exitPlanRequests,
      event.requestId
    )
  }

  if (event?.type === 'permission_mode_changed') {
    nextSession.permissionMode = normalizeAiSessionPermissionMode(event.mode)
  }

  if (event?.type === 'plan_mode_start') {
    nextSession.planMode = buildAgentPlanModeState({
      active: true,
      summary: event.summary,
      note: event.note,
    })
  }

  if (event?.type === 'plan_mode_end') {
    nextSession.planMode = buildAgentPlanModeState()
  }

  if (event?.type === 'compacting') {
    nextSession.isCompacting = true
  }

  if (event?.type === 'compact_complete') {
    nextSession.isCompacting = false
    nextSession.lastCompactAt = Date.now()
  }

  if (event?.type === 'waiting_resume') {
    nextSession.waitingResume = true
    nextSession.waitingResumeMessage = String(event.message || '').trim()
  }

  if (event?.type === 'resume_start') {
    nextSession.waitingResume = false
    nextSession.waitingResumeMessage = ''
  }

  if (event?.type === 'background_task') {
    nextSession = applyAgentRunBackgroundTaskEvent(
      {
        ...nextSession,
        backgroundTasks: Array.isArray(nextSession.backgroundTasks)
          ? nextSession.backgroundTasks
          : currentSession.backgroundTasks,
      },
      {
        ...event,
        toolUseId: event.toolUseId || event.id || event.toolId || '',
      },
      translate
    )
  }

  if (event?.type === 'task_started') {
    nextSession = applyAgentRunBackgroundTaskEvent(
      nextSession,
      {
        taskId: event.taskId,
        toolUseId: event.toolUseId,
        taskType: event.taskType,
        label: event.description || translate('Background task'),
        description: event.description,
        status: 'running',
      },
      translate
    )
  }

  if (event?.type === 'task_progress') {
    nextSession = applyAgentRunBackgroundTaskEvent(
      nextSession,
      {
        taskId: event.taskId,
        toolUseId: event.toolUseId,
        lastToolName: event.lastToolName,
        detail: String(event.description || event.lastToolName || '').trim(),
        elapsedSeconds: event.elapsedSeconds,
        usage: event.usage,
        status: 'running',
      },
      translate
    )
  }

  if (event?.type === 'task_notification') {
    nextSession = applyAgentRunBackgroundTaskEvent(
      nextSession,
      {
        taskId: event.taskId,
        toolUseId: event.toolUseId,
        summary: event.summary,
        outputFile: event.outputFile,
        usage: event.usage,
        status: event.status,
      },
      translate
    )
  }

  if (event?.eventType === 'tool' || event?.toolId) {
    const payloadEventType = String(event?.payload?.eventType || '').trim()
    const payloadToolName = String(event?.payload?.toolName || event.label || '').trim()

    if (payloadEventType === 'tool_call_start' && payloadToolName === 'EnterPlanMode') {
      nextSession.planMode = buildAgentPlanModeState({
        active: true,
        summary: translate('The agent is currently drafting a plan.'),
        note: translate('Plan mode stays visible until the runtime exits it.'),
      })
    }

    if (payloadEventType === 'tool_call_done' && payloadToolName === 'ExitPlanMode') {
      nextSession.planMode = buildAgentPlanModeState()
    }
  }

  nextSession.messages = applyPendingAssistantEvent(
    nextSession.messages || currentSession.messages,
    pendingAssistantId,
    event
  )

  return nextSession
}

export function completeAgentRunSessionState({
  session = null,
  pendingAssistantId = '',
  skill = null,
  result = null,
  artifact = null,
  providerState = {},
  contextBundle = {},
  createdAt = Date.now(),
} = {}) {
  const currentSession = session && typeof session === 'object' ? session : {}
  const assistantMessage = buildAiAssistantConversationMessage({
    id: pendingAssistantId,
    skill,
    result,
    artifact,
    providerState,
    contextBundle,
    createdAt,
  })

  return {
    assistantMessage,
    session: {
      ...currentSession,
      runtimeTransport: String(result?.transport || currentSession.runtimeTransport || '').trim(),
      messages: (Array.isArray(currentSession.messages) ? currentSession.messages : []).map(
        (message) => (message.id === pendingAssistantId ? assistantMessage : message)
      ),
      artifacts: artifact
        ? [artifact, ...(Array.isArray(currentSession.artifacts) ? currentSession.artifacts : [])]
        : Array.isArray(currentSession.artifacts)
          ? currentSession.artifacts
          : [],
      attachments: [],
      promptDraft: '',
    },
  }
}

export function failAgentRunSessionState({
  session = null,
  pendingAssistantId = '',
  skill = null,
  error = '',
  providerState = {},
  contextBundle = {},
  events = [],
  createdAt = Date.now(),
} = {}) {
  const currentSession = session && typeof session === 'object' ? session : {}
  const message = String(error || '').trim() || t('AI execution failed.')
  const failedAssistantMessage = buildAiFailedAssistantMessage({
    id: pendingAssistantId,
    skill,
    error: message,
    transport: String(currentSession.runtimeTransport || '').trim(),
    providerState,
    contextBundle,
    events,
    createdAt,
  })

  return {
    failedAssistantMessage,
    session: {
      ...currentSession,
      lastError: message,
      messages: (Array.isArray(currentSession.messages) ? currentSession.messages : []).map(
        (conversationMessage) =>
          conversationMessage.id === pendingAssistantId
            ? failedAssistantMessage
            : conversationMessage
      ),
    },
  }
}

export function finalizeAgentRunSessionState({ session = null } = {}) {
  const currentSession = session && typeof session === 'object' ? session : {}
  return {
    ...currentSession,
    isRunning: false,
    permissionRequests: [],
    exitPlanRequests: [],
    waitingResume: false,
    waitingResumeMessage: '',
    isCompacting: false,
  }
}
