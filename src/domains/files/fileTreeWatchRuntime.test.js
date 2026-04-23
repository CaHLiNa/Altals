import test from 'node:test'
import assert from 'node:assert/strict'

import { createFileTreeWatchRuntime } from './fileTreeWatchRuntime.js'

function createTimerHarness() {
  let nextId = 1
  const timers = new Map()

  return {
    createTimer(callback, delayMs) {
      const id = nextId++
      timers.set(id, { callback, delayMs })
      return id
    },
    clearTimer(id) {
      timers.delete(id)
    },
    async runByDelay(delayMs) {
      const matchingIds = [...timers.entries()]
        .filter(([, value]) => value.delayMs === delayMs)
        .map(([id]) => id)

      for (const id of matchingIds) {
        const timer = timers.get(id)
        if (!timer) continue
        timers.delete(id)
        await timer.callback()
      }
    },
  }
}

function createRuntimeHarness(options = {}) {
  const timerHarness = createTimerHarness()
  const refreshCalls = []
  let nativeHandler = null
  let nativeStopCalls = 0

  const runtime = createFileTreeWatchRuntime({
    getWorkspaceContext: () => ({ path: '/workspace' }),
    refreshVisibleTree: async (payload = {}) => {
      refreshCalls.push(payload)
    },
    addWindowListener: () => {},
    removeWindowListener: () => {},
    addDocumentListener: () => {},
    removeDocumentListener: () => {},
    getVisibilityState: () => 'visible',
    createTimer: (callback, delayMs) => timerHarness.createTimer(callback, delayMs),
    clearScheduledTimer: (id) => timerHarness.clearTimer(id),
    startNativeWatcher: async () => {},
    stopNativeWatcher: async () => {
      nativeStopCalls += 1
    },
    subscribeNativeWatcher: async (handler) => {
      nativeHandler = handler
      return () => {
        nativeHandler = null
      }
    },
    now: () => 0,
    ...options,
  })

  return {
    runtime,
    timerHarness,
    refreshCalls,
    getNativeHandler: () => nativeHandler,
    getNativeStopCalls: () => nativeStopCalls,
  }
}

test('native workspace changes trigger one debounced refresh', async () => {
  const harness = createRuntimeHarness()

  await harness.runtime.startWatching()
  const nativeHandler = harness.getNativeHandler()
  assert.equal(typeof nativeHandler, 'function')

  nativeHandler({ workspacePath: '/workspace', changedPaths: ['/workspace/a.md'] })
  nativeHandler({ workspacePath: '/workspace', changedPaths: ['/workspace/b.md'] })

  assert.equal(harness.refreshCalls.length, 0)
  await harness.timerHarness.runByDelay(180)

  assert.equal(harness.refreshCalls.length, 1)
  assert.equal(harness.refreshCalls[0].reason, 'fs-watch')
})

test('native changes from other workspaces are ignored and watcher stops cleanly', async () => {
  const harness = createRuntimeHarness()

  await harness.runtime.startWatching()
  const nativeHandler = harness.getNativeHandler()
  assert.equal(typeof nativeHandler, 'function')

  nativeHandler({ workspacePath: '/other-workspace', changedPaths: ['/other-workspace/a.md'] })
  await harness.timerHarness.runByDelay(180)

  assert.equal(harness.refreshCalls.length, 0)

  harness.runtime.stopWatching()
  assert.equal(harness.getNativeHandler(), null)
  assert.equal(harness.getNativeStopCalls(), 1)
})
