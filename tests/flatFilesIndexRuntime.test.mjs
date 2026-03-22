import test from 'node:test'
import assert from 'node:assert/strict'

import { createFlatFilesIndexRuntime } from '../src/domains/files/flatFilesIndexRuntime.js'

test('flat files index runtime coalesces pending requests and reuses ready cache', async () => {
  let workspacePath = '/ws'
  let flatFilesReady = false
  let flatFilesCache = []
  let listCalls = 0
  let releaseList
  const listPromise = new Promise((resolve) => {
    releaseList = resolve
  })

  const runtime = createFlatFilesIndexRuntime({
    getWorkspacePath: () => workspacePath,
    getFlatFilesReady: () => flatFilesReady,
    getFlatFilesCache: () => flatFilesCache,
    setFlatFiles: (flatFiles) => {
      flatFilesCache = flatFiles
      flatFilesReady = true
    },
    markFlatFilesNotReady: () => {
      flatFilesReady = false
    },
    listFilesRecursive: async (path) => {
      assert.equal(path, '/ws')
      listCalls += 1
      await listPromise
      return [
        '/ws/chapter1.md',
        '/ws/chapter2.md',
      ]
    },
  })

  const first = runtime.indexWorkspaceFiles()
  const second = runtime.indexWorkspaceFiles()

  releaseList()
  const [indexedFiles, secondResult] = await Promise.all([first, second])

  assert.equal(listCalls, 1)
  assert.deepEqual(indexedFiles, [
    '/ws/chapter1.md',
    '/ws/chapter2.md',
  ])
  assert.deepEqual(secondResult, indexedFiles)
  assert.deepEqual(await runtime.ensureFlatFilesReady(), indexedFiles)
  assert.equal(listCalls, 1)
})

test('flat files index runtime suppresses stale results after workspace switch', async () => {
  let workspacePath = '/ws-a'
  let flatFilesReady = false
  let flatFilesCache = []
  let setCalls = 0
  let releaseList
  const listPromise = new Promise((resolve) => {
    releaseList = resolve
  })

  const runtime = createFlatFilesIndexRuntime({
    getWorkspacePath: () => workspacePath,
    getFlatFilesReady: () => flatFilesReady,
    getFlatFilesCache: () => flatFilesCache,
    setFlatFiles: (flatFiles) => {
      setCalls += 1
      flatFilesCache = flatFiles
      flatFilesReady = true
    },
    markFlatFilesNotReady: () => {
      flatFilesReady = false
    },
    listFilesRecursive: async () => {
      await listPromise
      return ['/ws-a/chapter1.md']
    },
  })

  const pendingIndex = runtime.ensureFlatFilesReady()
  workspacePath = '/ws-b'
  releaseList()

  assert.deepEqual(await pendingIndex, [])
  assert.equal(setCalls, 0)
  assert.equal(flatFilesReady, false)
  assert.deepEqual(flatFilesCache, [])
})

test('flat files index runtime clears scheduled timers on reset', async () => {
  let workspacePath = '/ws'
  let flatFilesReady = false
  let flatFilesCache = []
  const timers = []
  const clearedTimers = []

  const runtime = createFlatFilesIndexRuntime({
    getWorkspacePath: () => workspacePath,
    getFlatFilesReady: () => flatFilesReady,
    getFlatFilesCache: () => flatFilesCache,
    setFlatFiles: (flatFiles) => {
      flatFilesCache = flatFiles
      flatFilesReady = true
    },
    markFlatFilesNotReady: () => {
      flatFilesReady = false
    },
    listFilesRecursive: async () => ['/ws/chapter1.md'],
    createTimer: (callback, delayMs) => {
      const timer = { callback, delayMs }
      timers.push(timer)
      return timer
    },
    clearScheduledTimer: (timer) => {
      clearedTimers.push(timer)
    },
  })

  void runtime.indexWorkspaceFiles({ delayMs: 50 })
  runtime.reset()

  assert.equal(timers.length, 1)
  assert.deepEqual(clearedTimers, [timers[0]])
})
