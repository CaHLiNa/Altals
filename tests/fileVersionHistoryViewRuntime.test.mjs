import test from 'node:test'
import assert from 'node:assert/strict'

import {
  shouldLoadFileVersionHistoryView,
  shouldResetFileVersionHistoryView,
} from '../src/domains/changes/fileVersionHistoryViewRuntime.js'

test('file version history view loads immediately when mounted visible with a file path', () => {
  assert.equal(
    shouldLoadFileVersionHistoryView({
      visible: true,
      filePath: '/workspace/demo/draft.md',
    }),
    true
  )
})

test('file version history view does not load when hidden or missing a file path', () => {
  assert.equal(
    shouldLoadFileVersionHistoryView({
      visible: false,
      filePath: '/workspace/demo/draft.md',
    }),
    false
  )
  assert.equal(
    shouldLoadFileVersionHistoryView({
      visible: true,
      filePath: '',
    }),
    false
  )
})

test('file version history view reloads when reopened or switched to a different file', () => {
  assert.equal(
    shouldLoadFileVersionHistoryView({
      visible: true,
      filePath: '/workspace/demo/draft.md',
      previousVisible: false,
      previousFilePath: '/workspace/demo/draft.md',
    }),
    true
  )

  assert.equal(
    shouldLoadFileVersionHistoryView({
      visible: true,
      filePath: '/workspace/demo/notes.md',
      previousVisible: true,
      previousFilePath: '/workspace/demo/draft.md',
    }),
    true
  )

  assert.equal(
    shouldLoadFileVersionHistoryView({
      visible: true,
      filePath: '/workspace/demo/draft.md',
      previousVisible: true,
      previousFilePath: '/workspace/demo/draft.md',
    }),
    false
  )
})

test('file version history view resets when hidden', () => {
  assert.equal(shouldResetFileVersionHistoryView({ visible: false }), true)
  assert.equal(shouldResetFileVersionHistoryView({ visible: true }), false)
})
