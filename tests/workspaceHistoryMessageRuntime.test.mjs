import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildWorkspaceHistoryAutoMessage,
  buildWorkspaceHistorySaveMessage,
  getWorkspaceHistoryMessageKind,
  isNamedWorkspaceHistoryMessage,
} from '../src/domains/changes/workspaceHistoryMessageRuntime.js'

test('workspace history message runtime builds the default save message timestamp', () => {
  const result = buildWorkspaceHistorySaveMessage({
    now: new Date('2026-03-22T10:11:12.000Z'),
  })

  assert.equal(result, 'Save: 2026-03-22 10:11')
})

test('workspace history message runtime builds the default auto message timestamp', () => {
  const result = buildWorkspaceHistoryAutoMessage({
    now: new Date('2026-03-22T10:11:12.000Z'),
  })

  assert.equal(result, 'Auto: 2026-03-22 10:11')
})

test('workspace history message runtime classifies english auto and save messages as system history entries', () => {
  assert.equal(getWorkspaceHistoryMessageKind({
    message: 'Auto: 2026-03-22 10:11',
  }), 'auto')
  assert.equal(getWorkspaceHistoryMessageKind({
    message: 'Save: 2026-03-22 10:11',
  }), 'save')
})

test('workspace history message runtime classifies translated save messages via the translated template', () => {
  const t = (value, params = {}) => {
    if (value === 'Save: {ts}') {
      return `保存：${params.ts}`
    }
    return value
  }

  assert.equal(getWorkspaceHistoryMessageKind({
    message: '保存：2026-03-22 10:11',
    t,
  }), 'save')
  assert.equal(isNamedWorkspaceHistoryMessage({
    message: '保存：2026-03-22 10:11',
    t,
  }), false)
})

test('workspace history message runtime supports timestamp templates where the suffix carries the label', () => {
  const t = (value, params = {}) => {
    if (value === 'Save: {ts}') {
      return `${params.ts} 保存`
    }
    return value
  }

  assert.equal(getWorkspaceHistoryMessageKind({
    message: '2026-03-22 10:11 保存',
    t,
  }), 'save')
})

test('workspace history message runtime keeps custom history labels as named entries', () => {
  assert.equal(getWorkspaceHistoryMessageKind({
    message: 'Chapter 2 ready for advisor review',
  }), 'named')
  assert.equal(isNamedWorkspaceHistoryMessage({
    message: 'Chapter 2 ready for advisor review',
  }), true)
})
