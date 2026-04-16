function normalizeAgentSdkLine(line = '') {
  try {
    return JSON.parse(String(line || '').trim())
  } catch {
    return null
  }
}

export function normalizeAnthropicSdkBridgeEvent(event = {}, streamId = '') {
  return {
    ...event,
    type: String(event?.type || '').trim(),
    streamId: String(streamId || '').trim(),
    transport: 'anthropic-sdk',
  }
}

export function consumeAnthropicSdkBridgeChunk({
  buffer = '',
  chunk = '',
  streamId = '',
  onEvent,
} = {}) {
  let nextBuffer = `${String(buffer || '')}${String(chunk || '')}`
  const lines = nextBuffer.split('\n')
  nextBuffer = lines.pop() || ''

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const payload = normalizeAgentSdkLine(line)
    if (!payload) continue

    if (payload.kind === 'event' && payload.event) {
      onEvent?.(normalizeAnthropicSdkBridgeEvent(payload.event, streamId))
      continue
    }

    if (payload.kind === 'done') {
      return {
        buffer: nextBuffer,
        done: {
          content: String(payload.content || ''),
          reasoning: String(payload.reasoning || ''),
          stopReason: String(payload.stopReason || ''),
        },
        error: null,
      }
    }

    if (payload.kind === 'error') {
      return {
        buffer: nextBuffer,
        done: null,
        error: new Error(String(payload.error || 'Anthropic Agent SDK run failed.')),
      }
    }
  }

  return {
    buffer: nextBuffer,
    done: null,
    error: null,
  }
}

export function flushAnthropicSdkBridgeBuffer({ buffer = '', streamId = '', onEvent } = {}) {
  if (!String(buffer || '').trim()) {
    return {
      buffer: '',
      done: null,
      error: null,
    }
  }

  return consumeAnthropicSdkBridgeChunk({
    buffer,
    chunk: '\n',
    streamId,
    onEvent,
  })
}
