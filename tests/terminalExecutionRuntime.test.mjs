import test from 'node:test'
import assert from 'node:assert/strict'

import { createTerminalExecutionRuntime } from '../src/domains/terminal/terminalExecutionRuntime.js'

test('terminal execution runtime spawns shell sessions and injects shell integration bootstrap', async () => {
  const instance = {
    id: 1,
    kind: 'shell',
    spawnCmd: null,
    spawnArgs: [],
    sessionId: null,
    lastCols: 90,
    lastRows: 30,
  }
  const spawned = []
  const writes = []
  const timeouts = []

  const runtime = createTerminalExecutionRuntime({
    getWorkspacePath: () => '/workspace/demo',
    getInstance: () => instance,
    getSessionId: () => instance.sessionId,
    defaultShell: () => ({ cmd: '/bin/zsh', args: ['-l'] }),
    spawnTerminalSession: async (options) => {
      spawned.push(options)
      return 42
    },
    writeTerminalSession: async (sessionId, data) => {
      writes.push({ sessionId, data })
    },
    buildShellIntegrationBootstrap: () => 'bootstrap\n',
    setTimeoutImpl: (fn, ms) => {
      timeouts.push({ fn, ms })
      return null
    },
    markSessionStarted: (_instanceId, sessionId, options = {}) => {
      instance.sessionId = sessionId
      instance.status = 'running'
      instance.lastExitCode = null
      instance.shellIntegrationReady = options.shellIntegrationReady === true
    },
  })

  assert.equal(await runtime.ensureSession(1), 42)
  assert.deepEqual(spawned, [{
    cmd: '/bin/zsh',
    args: ['-l'],
    cwd: '/workspace/demo',
    cols: 90,
    rows: 30,
  }])
  assert.equal(instance.sessionId, 42)
  assert.equal(instance.shellIntegrationReady, true)
  assert.deepEqual(timeouts.map(({ ms }) => ms), [120])

  await timeouts[0].fn()
  assert.deepEqual(writes, [{ sessionId: 42, data: 'bootstrap\n' }])
})

test('terminal execution runtime chunks large writes and prefers newline boundaries', async () => {
  const instance = {
    id: 1,
    kind: 'shell',
    sessionId: 7,
    spawnCmd: null,
    spawnArgs: [],
    lastCols: 120,
    lastRows: 32,
  }
  const writes = []
  const delays = []

  const runtime = createTerminalExecutionRuntime({
    getWorkspacePath: () => '/workspace/demo',
    getInstance: () => instance,
    getSessionId: () => instance.sessionId,
    writeTerminalSession: async (_sessionId, data) => {
      writes.push(data)
    },
    delay: async (ms) => {
      delays.push(ms)
    },
  })

  const payload = `${'a'.repeat(1000)}\n${'b'.repeat(1200)}`
  assert.equal(await runtime.sendTextToInstance(1, payload), true)
  assert.deepEqual(writes, [
    `${'a'.repeat(1000)}\n`,
    'b'.repeat(1200),
  ])
  assert.deepEqual(delays, [10])
})

test('terminal execution runtime builds multiline repl commands via temp files', async () => {
  const writes = []
  const runtime = createTerminalExecutionRuntime({
    now: () => 123456,
    writeFile: async (path, content) => {
      writes.push({ path, content })
    },
  })

  assert.equal(
    await runtime.buildReplCommand('print("hi")\nprint("bye")', 'python'),
    'exec(open("/tmp/.altals-run-123456.py").read())\n',
  )
  assert.deepEqual(writes, [{
    path: '/tmp/.altals-run-123456.py',
    content: 'print("hi")\nprint("bye")',
  }])
  assert.equal(await runtime.buildReplCommand('1 + 1', 'python'), '1 + 1\n')
})

test('terminal execution runtime routes create and focus terminal events through instance activation', async () => {
  const opened = []
  const activated = []

  const runtime = createTerminalExecutionRuntime({
    ensureSharedShellTerminal: () => 10,
    ensureLanguageTerminal: () => 11,
    findLanguageTerminalInstanceId: () => 12,
    activateInstance: (instanceId) => {
      activated.push(instanceId)
    },
    openBottomPanel: () => {
      opened.push('open')
    },
  })

  assert.equal(await runtime.handleCreateLanguageTerminalEvent({ language: '__shell__' }), 10)
  assert.equal(await runtime.handleCreateLanguageTerminalEvent({ language: 'python' }), 11)
  assert.equal(runtime.handleFocusLanguageTerminalEvent({ language: 'python' }), 12)
  assert.deepEqual(activated, [10, 11, 12])
  assert.deepEqual(opened, ['open', 'open', 'open'])
})

test('terminal execution runtime routes send-to-repl events for shell and language terminals', async () => {
  const instances = new Map([
    [10, {
      id: 10,
      kind: 'shell',
      sessionId: null,
      spawnCmd: null,
      spawnArgs: [],
      lastCols: 120,
      lastRows: 32,
    }],
    [11, {
      id: 11,
      kind: 'repl',
      language: 'python',
      sessionId: 99,
      spawnCmd: 'python',
      spawnArgs: ['-i'],
      lastCols: 120,
      lastRows: 32,
    }],
  ])
  const writes = []
  const tempWrites = []
  const activated = []
  const opened = []

  const runtime = createTerminalExecutionRuntime({
    getWorkspacePath: () => '/workspace/demo',
    getInstance: (instanceId) => instances.get(instanceId) || null,
    getSessionId: (instanceId) => instances.get(instanceId)?.sessionId ?? null,
    defaultShell: () => ({ cmd: '/bin/zsh', args: ['-l'] }),
    spawnTerminalSession: async () => 55,
    writeTerminalSession: async (sessionId, data) => {
      writes.push({ sessionId, data })
    },
    buildShellIntegrationBootstrap: () => '',
    writeFile: async (path, content) => {
      tempWrites.push({ path, content })
    },
    now: () => 77,
    ensureSharedShellTerminal: () => 10,
    ensureLanguageTerminal: () => 11,
    activateInstance: (instanceId) => {
      activated.push(instanceId)
    },
    openBottomPanel: () => {
      opened.push('open')
    },
    markSessionStarted: (instanceId, sessionId, options = {}) => {
      const instance = instances.get(instanceId)
      instance.sessionId = sessionId
      instance.status = 'running'
      instance.shellIntegrationReady = options.shellIntegrationReady === true
    },
  })

  assert.equal(await runtime.handleSendToReplEvent({ code: 'echo hi', language: '__shell__' }), true)
  assert.equal(await runtime.handleSendToReplEvent({ code: 'print("hi")\nprint("bye")', language: 'python' }), true)

  assert.deepEqual(activated, [10, 11])
  assert.deepEqual(opened, ['open', 'open'])
  assert.deepEqual(writes, [
    { sessionId: 55, data: 'echo hi\n' },
    { sessionId: 99, data: 'exec(open("/tmp/.altals-run-77.py").read())\n' },
  ])
  assert.deepEqual(tempWrites, [{
    path: '/tmp/.altals-run-77.py',
    content: 'print("hi")\nprint("bye")',
  }])
})
