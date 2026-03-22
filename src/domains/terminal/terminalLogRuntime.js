export function createTerminalLogRuntime({
  getInstance,
  ensureBuildLogTerminal,
  activateInstance,
  openBottomPanel,
  resolveLogTerminalDefinition,
} = {}) {
  function setLogInstanceStatus(instanceId, status) {
    const instance = getInstance?.(instanceId)
    if (!instance || instance.kind !== 'log' || !status) return

    switch (status) {
      case 'running':
        instance.status = 'busy'
        instance.lastExitCode = null
        break
      case 'success':
        instance.status = 'success'
        instance.lastExitCode = 0
        break
      case 'error':
        instance.status = 'error'
        instance.lastExitCode = 1
        break
      default:
        break
    }
  }

  function clearLogInstance(instanceId) {
    const instance = getInstance?.(instanceId)
    if (!instance || instance.kind !== 'log') return
    instance.logChunks = []
    instance.logRevision += 1
    instance.logResetToken += 1
    instance.status = 'idle'
    instance.lastExitCode = null
  }

  function appendLogChunk(instanceId, text, { clear = false } = {}) {
    const instance = getInstance?.(instanceId)
    if (!instance || instance.kind !== 'log') return
    if (clear) {
      instance.logChunks = []
      instance.logResetToken += 1
    }
    instance.logChunks.push(String(text || ''))
    instance.logRevision += 1
  }

  function buildLogText(label, text, { clear = false } = {}) {
    const body = String(text ?? '').replace(/\r\n/g, '\n')
    const lines = []
    if (!clear) lines.push('')
    lines.push(`[${label}]`)
    lines.push(body.trimEnd())
    lines.push('')
    return lines.join('\n')
  }

  function handleTerminalLogEvent({ key, label, text, clear = false, open = true, status = null } = {}) {
    if (!key || !text) return null
    const definition = resolveLogTerminalDefinition?.(key, label)
    const id = ensureBuildLogTerminal?.({
      key: definition?.terminalKey,
      label: definition?.label,
      activate: open,
    })
    if (id === null || id === undefined) return null
    if (open) {
      activateInstance?.(id)
      openBottomPanel?.()
    }
    const payload = definition?.preserveText
      ? String(text ?? '')
      : buildLogText(label || key, text, { clear })
    appendLogChunk(id, payload, { clear })
    setLogInstanceStatus(id, status)
    return id
  }

  function handleTerminalStreamEvent({
    key,
    label,
    text,
    clear = false,
    open = false,
    header = false,
    status = null,
  } = {}) {
    if (!key || !text) return null
    const definition = resolveLogTerminalDefinition?.(key, label)
    const id = ensureBuildLogTerminal?.({
      key: definition?.terminalKey,
      label: definition?.label,
      activate: open,
    })
    if (id === null || id === undefined) return null
    if (open) {
      activateInstance?.(id)
      openBottomPanel?.()
    }
    const normalizedText = String(text ?? '').replace(/\r\n/g, '\n')
    const prefix = header ? `\n[${label || key}]\n` : ''
    const payload = definition?.preserveText
      ? normalizedText
      : `${prefix}${normalizedText}`
    appendLogChunk(id, payload, { clear })
    setLogInstanceStatus(id, status)
    return id
  }

  return {
    setLogInstanceStatus,
    clearLogInstance,
    appendLogChunk,
    buildLogText,
    handleTerminalLogEvent,
    handleTerminalStreamEvent,
  }
}
