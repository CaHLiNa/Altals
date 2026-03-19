import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

const MAX_BUFFERED_CHUNKS = 1000
const sessions = new Map()

function getSessionRecord(sessionId) {
  return sessions.get(sessionId) || null
}

function appendBufferedChunk(record, chunk) {
  if (!chunk) return
  record.buffer.push(chunk)
  if (record.buffer.length > MAX_BUFFERED_CHUNKS) {
    record.buffer.splice(0, record.buffer.length - MAX_BUFFERED_CHUNKS)
  }
}

async function cleanupSessionListeners(record) {
  if (!record) return
  if (record.unlistenOutput) {
    await record.unlistenOutput()
    record.unlistenOutput = null
  }
  if (record.unlistenExit) {
    await record.unlistenExit()
    record.unlistenExit = null
  }
}

export async function spawnTerminalSession({ cmd, args = [], cwd, cols = 120, rows = 32 }) {
  const sessionId = await invoke('pty_spawn', {
    cmd,
    args,
    cwd,
    cols,
    rows,
  })

  const record = {
    id: sessionId,
    buffer: [],
    exitPayload: null,
    outputListeners: new Set(),
    exitListeners: new Set(),
    unlistenOutput: null,
    unlistenExit: null,
  }

  record.unlistenOutput = await listen(`pty-output-${sessionId}`, (event) => {
    const data = event.payload?.data || ''
    appendBufferedChunk(record, data)
    for (const listener of record.outputListeners) {
      try {
        listener(data)
      } catch (error) {
        console.warn('[terminal] session output listener failed:', error)
      }
    }
  })

  record.unlistenExit = await listen(`pty-exit-${sessionId}`, (event) => {
    record.exitPayload = event.payload || null
    for (const listener of record.exitListeners) {
      try {
        listener(record.exitPayload)
      } catch (error) {
        console.warn('[terminal] session exit listener failed:', error)
      }
    }
  })

  sessions.set(sessionId, record)
  return sessionId
}

export function subscribeTerminalSession(sessionId, { onOutput, onExit, replay = true } = {}) {
  const record = getSessionRecord(sessionId)
  if (!record) return () => {}

  if (typeof onOutput === 'function') {
    record.outputListeners.add(onOutput)
    if (replay && record.buffer.length > 0) {
      for (const chunk of record.buffer) {
        onOutput(chunk)
      }
    }
  }

  if (typeof onExit === 'function') {
    record.exitListeners.add(onExit)
    if (record.exitPayload) {
      onExit(record.exitPayload)
    }
  }

  return () => {
    if (typeof onOutput === 'function') record.outputListeners.delete(onOutput)
    if (typeof onExit === 'function') record.exitListeners.delete(onExit)
  }
}

export async function writeTerminalSession(sessionId, data) {
  return invoke('pty_write', { id: sessionId, data })
}

export async function resizeTerminalSession(sessionId, cols, rows) {
  return invoke('pty_resize', { id: sessionId, cols, rows })
}

export async function killTerminalSession(sessionId) {
  await invoke('pty_kill', { id: sessionId })
}

export async function disposeTerminalSession(sessionId) {
  const record = getSessionRecord(sessionId)
  if (!record) return
  await cleanupSessionListeners(record)
  sessions.delete(sessionId)
}
