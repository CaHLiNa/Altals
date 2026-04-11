import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTypstPreviewStartArgs,
  clearPendingTypstForwardSync,
  peekPendingTypstForwardSync,
  PENDING_FORWARD_SYNC_TTL_MS,
  rememberPendingTypstForwardSync,
  resolveTypstPreviewNotificationFilePath,
  resolveTypstPreviewNotificationLocation,
  shouldRecoverTypstPreviewStart,
} from '../src/services/typst/previewSync.js'

test('typst preview start args align with tinymist vscode preview launch defaults', () => {
  assert.deepEqual(buildTypstPreviewStartArgs('/workspace/main.typ'), [
    '--task-id',
    'altals-typst-preview-sync',
    '--data-plane-host',
    '127.0.0.1:0',
    '/workspace/main.typ',
  ])
})

test('typst preview start args return empty args when root is missing', () => {
  assert.deepEqual(buildTypstPreviewStartArgs(''), [])
})

test('typst preview start args support slide mode and non-primary tasks when requested', () => {
  assert.deepEqual(buildTypstPreviewStartArgs('/workspace/slides.typ', {
    taskId: 'slides-preview',
    dataPlaneHost: '127.0.0.1:24567',
    previewMode: 'slide',
    notPrimary: true,
  }), [
    '--task-id',
    'slides-preview',
    '--data-plane-host',
    '127.0.0.1:24567',
    '--preview-mode=slide',
    '--not-primary',
    '/workspace/slides.typ',
  ])
})

test('typst preview start args keep a stable single-task id for the app background preview', () => {
  const args = buildTypstPreviewStartArgs('/workspace/main.typ')
  const taskIdIndex = args.indexOf('--task-id')
  assert.notEqual(taskIdIndex, -1)
  assert.equal(args[taskIdIndex + 1], 'altals-typst-preview-sync')
})

test('typst preview start recovery recognizes compiler preview registration conflicts', () => {
  assert.equal(
    shouldRecoverTypstPreviewStart(new Error('cannot register preview to the compiler instance')),
    true,
  )
  assert.equal(
    shouldRecoverTypstPreviewStart('failed to register background preview to the primary instance'),
    true,
  )
  assert.equal(
    shouldRecoverTypstPreviewStart(new Error('Tinymist preview did not expose a valid data plane port')),
    false,
  )
})

test('typst preview notifications normalize source file paths from file paths and uris', () => {
  assert.equal(
    resolveTypstPreviewNotificationFilePath({
      filepath: '/workspace/sections/intro.typ',
    }),
    '/workspace/sections/intro.typ',
  )
  assert.equal(
    resolveTypstPreviewNotificationFilePath({
      uri: 'file:///workspace/sections/intro.typ',
    }),
    '/workspace/sections/intro.typ',
  )
})

test('typst preview notifications normalize standard LSP ranges for reverse sync focus', () => {
  assert.deepEqual(
    resolveTypstPreviewNotificationLocation({
      uri: 'file:///workspace/sections/intro.typ',
      range: {
        start: { line: 12, character: 3 },
        end: { line: 14, character: 1 },
      },
      targetSelectionRange: {
        start: { line: 12, character: 5 },
        end: { line: 12, character: 11 },
      },
    }),
    {
      filePath: '/workspace/sections/intro.typ',
      range: {
        start: { line: 12, character: 3 },
        end: { line: 14, character: 1 },
      },
      targetSelectionRange: {
        start: { line: 12, character: 5 },
        end: { line: 12, character: 11 },
      },
    },
  )
})

test('pending typst forward sync stays available briefly for source-driven preview reveals', () => {
  clearPendingTypstForwardSync()
  const originalNow = Date.now
  try {
    Date.now = () => 100
    rememberPendingTypstForwardSync({
      sourcePath: '/workspace/main.typ',
      rootPath: '/workspace/main.typ',
      line: 12,
      character: 4,
    })

    Date.now = () => 100 + PENDING_FORWARD_SYNC_TTL_MS - 1
    assert.deepEqual(
      peekPendingTypstForwardSync('/workspace/main.typ'),
      {
        sourcePath: '/workspace/main.typ',
        rootPath: '/workspace/main.typ',
        line: 12,
        character: 4,
        createdAt: 100,
      },
    )
  } finally {
    Date.now = originalNow
    clearPendingTypstForwardSync()
  }
})

test('stale pending typst forward sync expires instead of reopening the preview at an old cursor location', () => {
  clearPendingTypstForwardSync()
  const originalNow = Date.now
  try {
    Date.now = () => 200
    rememberPendingTypstForwardSync({
      sourcePath: '/workspace/main.typ',
      rootPath: '/workspace/main.typ',
      line: 0,
      character: 0,
    })

    Date.now = () => 200 + PENDING_FORWARD_SYNC_TTL_MS + 1
    assert.equal(peekPendingTypstForwardSync('/workspace/main.typ'), null)
  } finally {
    Date.now = originalNow
    clearPendingTypstForwardSync()
  }
})
