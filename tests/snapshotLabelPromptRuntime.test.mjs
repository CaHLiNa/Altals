import test from 'node:test'
import assert from 'node:assert/strict'

import { createSnapshotLabelPromptRuntime } from '../src/app/changes/snapshotLabelPromptRuntime.js'

test('snapshot label prompt runtime opens and resolves the named-history dialog flow', async () => {
  const states = []
  const timers = []
  const runtime = createSnapshotLabelPromptRuntime({
    onStateChange: (state) => {
      states.push(state)
    },
    setTimeoutImpl: (callback, ms) => {
      timers.push({ callback, ms })
      return { callback, ms }
    },
    clearTimeoutImpl: () => {},
  })

  const pending = runtime.beginSnapshotLabelConfirmation()
  assert.deepEqual(runtime.getState(), {
    promptActive: true,
    dialogVisible: false,
  })
  assert.equal(timers.length, 1)
  assert.equal(timers[0].ms, 8000)

  assert.equal(runtime.openSnapshotLabelDialog(), true)
  assert.deepEqual(runtime.getState(), {
    promptActive: true,
    dialogVisible: true,
  })

  runtime.resolveSnapshotLabelDialog('Submitted draft')
  assert.equal(await pending, 'Submitted draft')
  assert.deepEqual(runtime.getState(), {
    promptActive: false,
    dialogVisible: false,
  })
  assert.deepEqual(states.at(-1), {
    promptActive: false,
    dialogVisible: false,
  })
})

test('snapshot label prompt runtime resolves null when the timer expires', async () => {
  let timerCallback = null
  const runtime = createSnapshotLabelPromptRuntime({
    setTimeoutImpl: (callback) => {
      timerCallback = callback
      return callback
    },
    clearTimeoutImpl: () => {},
  })

  const pending = runtime.beginSnapshotLabelConfirmation()
  timerCallback()

  assert.equal(await pending, null)
  assert.deepEqual(runtime.getState(), {
    promptActive: false,
    dialogVisible: false,
  })
})

test('snapshot label prompt runtime clears the previous pending confirmation before starting a new one', async () => {
  const runtime = createSnapshotLabelPromptRuntime({
    setTimeoutImpl: () => Symbol('timer'),
    clearTimeoutImpl: () => {},
  })

  const first = runtime.beginSnapshotLabelConfirmation()
  const second = runtime.beginSnapshotLabelConfirmation()

  assert.equal(await first, null)
  runtime.resolveSnapshotLabelDialog('Revision ready')
  assert.equal(await second, 'Revision ready')
})

test('snapshot label prompt runtime resolves the pending confirmation when disposed', async () => {
  const runtime = createSnapshotLabelPromptRuntime({
    setTimeoutImpl: () => Symbol('timer'),
    clearTimeoutImpl: () => {},
  })

  const pending = runtime.beginSnapshotLabelConfirmation()
  runtime.dispose()

  assert.equal(await pending, null)
  assert.deepEqual(runtime.getState(), {
    promptActive: false,
    dialogVisible: false,
  })
})
