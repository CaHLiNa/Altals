const REPL_TEMP_EXT = {
  r: '.R',
  python: '.py',
  julia: '.jl',
}

export function createTerminalExecutionRuntime({
  getWorkspacePath,
  getInstance,
  getSessionId,
  defaultShell,
  spawnTerminalSession,
  writeTerminalSession,
  buildShellIntegrationBootstrap,
  setTimeoutImpl = globalThis.setTimeout,
  delay = (ms) => new Promise((resolve) => setTimeoutImpl(resolve, ms)),
  writeFile,
  now = () => Date.now(),
  ensureSharedShellTerminal,
  ensureLanguageTerminal,
  findLanguageTerminalInstanceId,
  activateInstance,
  openBottomPanel,
  markSessionStarted,
} = {}) {
  async function ensureSession(instanceId) {
    const workspacePath = getWorkspacePath?.()
    const instance = getInstance?.(instanceId)
    if (!workspacePath || !instance || instance.kind === 'log') return null
    if (instance.sessionId !== null) return instance.sessionId

    const shell = defaultShell?.()
    const sessionId = await spawnTerminalSession?.({
      cmd: instance.spawnCmd || shell?.cmd,
      args: instance.spawnCmd ? instance.spawnArgs : shell?.args,
      cwd: workspacePath,
      cols: instance.lastCols || 120,
      rows: instance.lastRows || 32,
    })

    let shellIntegrationReady = false
    if (instance.kind === 'shell' && !instance.spawnCmd) {
      const bootstrap = buildShellIntegrationBootstrap?.(shell?.cmd)
      if (bootstrap) {
        setTimeoutImpl?.(() => {
          if (getSessionId?.(instanceId) !== sessionId) return
          void writeTerminalSession?.(sessionId, bootstrap).catch(() => {})
        }, 120)
      }
      shellIntegrationReady = true
    }

    markSessionStarted?.(instanceId, sessionId, { shellIntegrationReady })
    return sessionId
  }

  async function sendTextToInstance(instanceId, text) {
    const instance = getInstance?.(instanceId)
    if (!instance || instance.kind === 'log') return false

    const sessionId = await ensureSession(instanceId)
    if (sessionId === null) return false

    const payload = String(text || '')
    if (payload.length < 2048) {
      await writeTerminalSession?.(sessionId, payload)
      return true
    }

    const chunkSize = 2048
    let offset = 0
    while (offset < payload.length) {
      let end = Math.min(offset + chunkSize, payload.length)
      if (end < payload.length) {
        const newline = payload.lastIndexOf('\n', end)
        if (newline > offset) end = newline + 1
      }
      await writeTerminalSession?.(sessionId, payload.slice(offset, end))
      if (end < payload.length) {
        await delay(10)
      }
      offset = end
    }

    return true
  }

  async function buildReplCommand(code, language) {
    if (!String(code || '').includes('\n')) return `${code}\n`

    const extension = REPL_TEMP_EXT[language] || '.txt'
    const tempPath = `/tmp/.altals-run-${now()}${extension}`
    await writeFile?.(tempPath, code)

    switch (language) {
      case 'r':
        return `source("${tempPath}", echo = TRUE)\n`
      case 'python':
        return `exec(open("${tempPath}").read())\n`
      case 'julia':
        return `include("${tempPath}")\n`
      default:
        return `${code}\n`
    }
  }

  async function handleCreateLanguageTerminalEvent({ language } = {}) {
    if (!language) return null
    if (language === '__shell__') {
      const id = ensureSharedShellTerminal?.({ activate: false })
      openBottomPanel?.()
      activateInstance?.(id)
      return id
    }

    const id = ensureLanguageTerminal?.(language, { activate: false })
    if (id !== null && id !== undefined) {
      openBottomPanel?.()
      activateInstance?.(id)
      return id
    }
    return null
  }

  function handleFocusLanguageTerminalEvent({ language } = {}) {
    if (!language) return null
    const instanceId = findLanguageTerminalInstanceId?.(language)
    if (instanceId === null || instanceId === undefined) return null
    activateInstance?.(instanceId)
    openBottomPanel?.()
    return instanceId
  }

  async function handleSendToReplEvent({ code, language } = {}) {
    if (!code || !language) return false
    openBottomPanel?.()

    if (language === '__shell__') {
      const id = ensureSharedShellTerminal?.({ activate: false })
      activateInstance?.(id)
      await sendTextToInstance(id, `${code}\n`)
      return true
    }

    const id = ensureLanguageTerminal?.(language, { activate: false })
    if (id === null || id === undefined) return false
    activateInstance?.(id)
    const command = await buildReplCommand(code, language)
    await sendTextToInstance(id, command)
    return true
  }

  return {
    ensureSession,
    sendTextToInstance,
    buildReplCommand,
    handleCreateLanguageTerminalEvent,
    handleFocusLanguageTerminalEvent,
    handleSendToReplEvent,
  }
}
