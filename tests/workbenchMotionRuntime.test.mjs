import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkbenchMotionRuntime } from '../src/domains/workbench/workbenchMotionRuntime.js'

function createFrameHarness() {
  let nextId = 1
  const queue = new Map()

  return {
    requestFrame(callback) {
      const id = nextId
      nextId += 1
      queue.set(id, callback)
      return id
    },

    cancelFrame(id) {
      queue.delete(id)
    },

    flushNext() {
      const nextEntry = queue.entries().next()
      if (nextEntry.done) return false
      const [id, callback] = nextEntry.value
      queue.delete(id)
      callback(Date.now())
      return true
    },

    flushAll() {
      while (this.flushNext()) {
        // Drain queued callbacks in insertion order.
      }
    },
  }
}

test('workbench motion runtime coalesces repeated updates to one frame commit', () => {
  const frames = createFrameHarness()
  const commits = []
  const runtime = createWorkbenchMotionRuntime({
    requestFrame: frames.requestFrame.bind(frames),
    cancelFrame: frames.cancelFrame.bind(frames),
  })

  runtime.schedule('split', 0.58, value => commits.push(value))
  runtime.schedule('split', 0.61, value => commits.push(value))

  assert.equal(runtime.pendingCommitCount(), 1)
  assert.deepEqual(commits, [])

  frames.flushAll()

  assert.deepEqual(commits, [0.61])
  assert.equal(runtime.pendingCommitCount(), 0)
})

test('workbench motion runtime flushes the latest scheduled value immediately', () => {
  const frames = createFrameHarness()
  const commits = []
  const runtime = createWorkbenchMotionRuntime({
    requestFrame: frames.requestFrame.bind(frames),
    cancelFrame: frames.cancelFrame.bind(frames),
  })

  runtime.schedule('left-sidebar', 240, value => commits.push(value))
  runtime.schedule('left-sidebar', 268, value => commits.push(value))

  assert.equal(runtime.flush('left-sidebar'), true)
  assert.deepEqual(commits, [268])
  assert.equal(runtime.pendingCommitCount(), 0)

  frames.flushAll()
  assert.deepEqual(commits, [268])
})

test('workbench motion runtime transitions through live-resize, settling, and idle', () => {
  const frames = createFrameHarness()
  const phases = []
  const runtime = createWorkbenchMotionRuntime({
    requestFrame: frames.requestFrame.bind(frames),
    cancelFrame: frames.cancelFrame.bind(frames),
    onPhaseChange: (phase) => phases.push(phase),
  })

  runtime.begin('split:vertical')
  assert.equal(runtime.getPhase(), 'live-resize')

  runtime.end('split:vertical')
  assert.equal(runtime.getPhase(), 'settling')

  frames.flushAll()

  assert.equal(runtime.getPhase(), 'idle')
  assert.deepEqual(phases, ['live-resize', 'settling', 'idle'])
})
