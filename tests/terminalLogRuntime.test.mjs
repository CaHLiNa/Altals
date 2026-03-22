import test from 'node:test'
import assert from 'node:assert/strict'

import { createTerminalLogRuntime } from '../src/domains/terminal/terminalLogRuntime.js'

function createLogInstance(id, key = 'shared-build-terminal') {
  return {
    id,
    key,
    groupId: 1,
    kind: 'log',
    mode: 'log',
    label: 'Build',
    customLabel: null,
    title: '',
    language: null,
    spawnCmd: null,
    spawnArgs: [],
    cwd: '',
    status: 'idle',
    lastExitCode: null,
    lastCols: 120,
    lastRows: 32,
    sessionId: null,
    shellIntegrationReady: false,
    commandMarkers: [],
    activeCommandMarkerId: null,
    logChunks: [],
    logRevision: 0,
    logResetToken: 0,
  }
}

function createHarness() {
  const state = {
    instances: [],
    activeInstanceId: null,
    nextId: 1,
  }
  const activationCalls = []
  const openCalls = []

  const runtime = createTerminalLogRuntime({
    getInstance: (instanceId) => state.instances.find((instance) => instance.id === instanceId) || null,
    ensureBuildLogTerminal: ({ key = 'shared-build-terminal', label = 'Build', activate = true } = {}) => {
      let instance = state.instances.find((item) => item.key === key)
      if (!instance) {
        instance = createLogInstance(state.nextId++, key)
        instance.label = label
        state.instances.push(instance)
      }
      if (activate) {
        state.activeInstanceId = instance.id
        activationCalls.push(instance.id)
      }
      return instance.id
    },
    activateInstance: (instanceId) => {
      state.activeInstanceId = instanceId
      activationCalls.push(instanceId)
    },
    openBottomPanel: () => openCalls.push(true),
    resolveLogTerminalDefinition: (key, label) => {
      if (key === 'latex-log') {
        return {
          terminalKey: 'tool-latex-terminal',
          label: label || 'LaTeX',
          preserveText: true,
        }
      }
      return {
        terminalKey: 'shared-build-terminal',
        label: label || 'Build',
        preserveText: false,
      }
    },
  })

  return {
    state,
    runtime,
    activationCalls,
    openCalls,
  }
}

test('terminal log runtime maps log statuses onto log instances', () => {
  const { state, runtime } = createHarness()
  state.instances.push(createLogInstance(1))

  runtime.setLogInstanceStatus(1, 'running')
  assert.equal(state.instances[0].status, 'busy')
  assert.equal(state.instances[0].lastExitCode, null)

  runtime.setLogInstanceStatus(1, 'success')
  assert.equal(state.instances[0].status, 'success')
  assert.equal(state.instances[0].lastExitCode, 0)

  runtime.setLogInstanceStatus(1, 'error')
  assert.equal(state.instances[0].status, 'error')
  assert.equal(state.instances[0].lastExitCode, 1)
})

test('terminal log runtime clears and appends buffered log chunks', () => {
  const { state, runtime } = createHarness()
  state.instances.push(createLogInstance(1))

  runtime.appendLogChunk(1, 'first')
  runtime.appendLogChunk(1, 'second')
  runtime.clearLogInstance(1)
  runtime.appendLogChunk(1, 'replacement', { clear: true })

  assert.deepEqual(state.instances[0].logChunks, ['replacement'])
  assert.equal(state.instances[0].logRevision, 4)
  assert.equal(state.instances[0].logResetToken, 2)
  assert.equal(state.instances[0].status, 'idle')
})

test('terminal log runtime formats build logs and opens the panel when requested', () => {
  const { state, runtime, openCalls } = createHarness()

  const id = runtime.handleTerminalLogEvent({
    key: 'build',
    label: 'Build',
    text: 'step 1\r\nstep 2',
    clear: false,
    open: true,
    status: 'success',
  })

  assert.equal(id, 1)
  assert.equal(openCalls.length, 1)
  assert.equal(state.activeInstanceId, 1)
  assert.deepEqual(state.instances[0].logChunks, ['\n[Build]\nstep 1\nstep 2\n'])
  assert.equal(state.instances[0].status, 'success')
  assert.equal(state.instances[0].lastExitCode, 0)
})

test('terminal log runtime preserves raw text for tool logs', () => {
  const { state, runtime, openCalls } = createHarness()

  const id = runtime.handleTerminalStreamEvent({
    key: 'latex-log',
    label: 'LaTeX',
    text: 'raw\r\noutput',
    open: false,
    status: 'running',
  })

  assert.equal(id, 1)
  assert.equal(openCalls.length, 0)
  assert.deepEqual(state.instances[0].logChunks, ['raw\noutput'])
  assert.equal(state.instances[0].status, 'busy')
  assert.equal(state.instances[0].lastExitCode, null)
})

test('terminal log runtime prefixes streamed headers for shared logs', () => {
  const { state, runtime } = createHarness()

  runtime.handleTerminalStreamEvent({
    key: 'build',
    label: 'Build',
    text: 'chunk',
    clear: true,
    header: true,
    open: false,
  })

  assert.deepEqual(state.instances[0].logChunks, ['\n[Build]\nchunk'])
  assert.equal(state.instances[0].logRevision, 1)
  assert.equal(state.instances[0].logResetToken, 1)
})
