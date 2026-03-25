import test from 'node:test'
import assert from 'node:assert/strict'

import {
  __resetShellResizeSignalsForTests,
  isShellResizeActive,
  setShellResizeActive,
  SHELL_RESIZE_BODY_CLASS,
  SHELL_RESIZE_END_EVENT,
  SHELL_RESIZE_START_EVENT,
} from '../src/shared/shellResizeSignals.js'

function createMockClassList() {
  const values = new Set()
  return {
    add(value) {
      values.add(value)
    },
    remove(value) {
      values.delete(value)
    },
    toggle(value, force) {
      if (force) {
        values.add(value)
        return true
      }
      values.delete(value)
      return false
    },
    contains(value) {
      return values.has(value)
    },
  }
}

test('setShellResizeActive toggles the shared body class and dispatches matching events', () => {
  const classList = createMockClassList()
  const events = []
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const previousCustomEvent = globalThis.CustomEvent

  globalThis.document = {
    body: { classList },
  }
  globalThis.window = {
    dispatchEvent(event) {
      events.push(event)
    },
  }
  globalThis.CustomEvent = class CustomEventMock {
    constructor(type, init = {}) {
      this.type = type
      this.detail = init.detail
    }
  }

  try {
    __resetShellResizeSignalsForTests()
    assert.equal(isShellResizeActive(), false)

    setShellResizeActive(true, { source: 'layout' })
    assert.equal(classList.contains(SHELL_RESIZE_BODY_CLASS), true)
    assert.equal(isShellResizeActive(), true)
    assert.equal(events[0].type, SHELL_RESIZE_START_EVENT)
    assert.deepEqual(events[0].detail, { source: 'layout' })

    setShellResizeActive(false, { source: 'layout' })
    assert.equal(classList.contains(SHELL_RESIZE_BODY_CLASS), false)
    assert.equal(isShellResizeActive(), false)
    assert.equal(events[1].type, SHELL_RESIZE_END_EVENT)
    assert.deepEqual(events[1].detail, { source: 'layout' })
  } finally {
    __resetShellResizeSignalsForTests()
    globalThis.document = previousDocument
    globalThis.window = previousWindow
    globalThis.CustomEvent = previousCustomEvent
  }
})

test('setShellResizeActive keeps the shared resize state active until every source is cleared', () => {
  const classList = createMockClassList()
  const events = []
  const previousDocument = globalThis.document
  const previousWindow = globalThis.window
  const previousCustomEvent = globalThis.CustomEvent

  globalThis.document = {
    body: { classList },
  }
  globalThis.window = {
    dispatchEvent(event) {
      events.push(event)
    },
  }
  globalThis.CustomEvent = class CustomEventMock {
    constructor(type, init = {}) {
      this.type = type
      this.detail = init.detail
    }
  }

  try {
    __resetShellResizeSignalsForTests()

    setShellResizeActive(true, { source: 'layout-handle', direction: 'vertical' })
    setShellResizeActive(true, { source: 'sidebar-toggle', side: 'left' })
    assert.equal(isShellResizeActive(), true)
    assert.equal(classList.contains(SHELL_RESIZE_BODY_CLASS), true)
    assert.equal(events.length, 1)
    assert.equal(events[0].type, SHELL_RESIZE_START_EVENT)

    setShellResizeActive(false, { source: 'sidebar-toggle', side: 'left' })
    assert.equal(isShellResizeActive(), true)
    assert.equal(classList.contains(SHELL_RESIZE_BODY_CLASS), true)
    assert.equal(events.length, 1)

    setShellResizeActive(false, { source: 'layout-handle', direction: 'vertical' })
    assert.equal(isShellResizeActive(), false)
    assert.equal(classList.contains(SHELL_RESIZE_BODY_CLASS), false)
    assert.equal(events.length, 2)
    assert.equal(events[1].type, SHELL_RESIZE_END_EVENT)
  } finally {
    __resetShellResizeSignalsForTests()
    globalThis.document = previousDocument
    globalThis.window = previousWindow
    globalThis.CustomEvent = previousCustomEvent
  }
})
