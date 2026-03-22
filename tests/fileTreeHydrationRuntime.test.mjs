import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createFileTreeHydrationRuntime,
  findTreeEntry,
} from '../src/domains/files/fileTreeHydrationRuntime.js'

test('findTreeEntry resolves nested file entries', () => {
  const tree = [
    {
      path: '/ws/docs',
      is_dir: true,
      children: [
        {
          path: '/ws/docs/chapter1.md',
          is_dir: false,
        },
      ],
    },
  ]

  assert.deepEqual(findTreeEntry(tree, '/ws/docs/chapter1.md'), {
    path: '/ws/docs/chapter1.md',
    is_dir: false,
  })
  assert.equal(findTreeEntry(tree, '/ws/missing.md'), null)
})

test('ensureDirLoaded coalesces concurrent loads for the same directory', async () => {
  let currentTree = [
    { path: '/ws/docs', is_dir: true },
  ]
  let readCalls = 0
  let releaseRead
  const readPromise = new Promise((resolve) => {
    releaseRead = resolve
  })

  const runtime = createFileTreeHydrationRuntime({
    getWorkspacePath: () => '/ws',
    getCurrentTree: () => currentTree,
    readDirShallow: async (path) => {
      assert.equal(path, '/ws/docs')
      readCalls += 1
      await readPromise
      return [
        { path: '/ws/docs/chapter1.md', is_dir: false },
      ]
    },
    applyTree: (nextTree) => {
      currentTree = nextTree
    },
  })

  const firstLoad = runtime.ensureDirLoaded('/ws/docs')
  const secondLoad = runtime.ensureDirLoaded('/ws/docs')
  releaseRead()

  const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad])

  assert.equal(readCalls, 1)
  assert.deepEqual(firstResult, [
    { path: '/ws/docs/chapter1.md', is_dir: false },
  ])
  assert.deepEqual(secondResult, firstResult)
  assert.deepEqual(currentTree, [
    {
      path: '/ws/docs',
      is_dir: true,
      children: [
        { path: '/ws/docs/chapter1.md', is_dir: false },
      ],
    },
  ])
})

test('revealPath loads and expands ancestor directories for nested files', async () => {
  let currentTree = [
    { path: '/ws/docs', is_dir: true },
    { path: '/ws/docs/chapters', is_dir: true },
  ]
  const expanded = new Set()
  let snapshotCalls = 0
  const readCalls = []

  const runtime = createFileTreeHydrationRuntime({
    getWorkspacePath: () => '/ws',
    getCurrentTree: () => currentTree,
    readDirShallow: async (path) => {
      readCalls.push(path)
      return []
    },
    applyTree: (nextTree) => {
      currentTree = nextTree
    },
    addExpandedDir: (path) => expanded.add(path),
    cacheSnapshot: () => {
      snapshotCalls += 1
    },
  })

  await runtime.revealPath('/ws/docs/chapters/chapter1.md')

  assert.deepEqual(readCalls, ['/ws/docs', '/ws/docs/chapters'])
  assert.deepEqual([...expanded], ['/ws/docs', '/ws/docs/chapters'])
  assert.equal(snapshotCalls, 1)
})

test('syncTreeAfterMutation refreshes tree, reloads expanded directory, and invalidates flat files', async () => {
  let currentTree = [
    { path: '/ws/docs', is_dir: true },
  ]
  const expanded = new Set()
  const refreshReasons = []
  const applyCalls = []
  let invalidations = 0
  let snapshotCalls = 0

  const runtime = createFileTreeHydrationRuntime({
    getWorkspacePath: () => '/ws',
    getCurrentTree: () => currentTree,
    readDirShallow: async (path) => {
      assert.equal(path, '/ws/docs')
      return [
        { path: '/ws/docs/chapter1.md', is_dir: false },
      ]
    },
    applyTree: (nextTree, workspacePath, options = {}) => {
      applyCalls.push({ workspacePath, options })
      currentTree = nextTree
    },
    refreshVisibleTree: async ({ reason }) => {
      refreshReasons.push(reason)
    },
    addExpandedDir: (path) => expanded.add(path),
    cacheSnapshot: () => {
      snapshotCalls += 1
    },
    invalidateFlatFiles: () => {
      invalidations += 1
    },
  })

  await runtime.syncTreeAfterMutation({ expandPath: '/ws/docs' })

  assert.deepEqual(refreshReasons, ['mutation'])
  assert.equal(invalidations, 1)
  assert.equal(snapshotCalls, 1)
  assert.deepEqual([...expanded], ['/ws/docs'])
  assert.deepEqual(applyCalls, [
    {
      workspacePath: '/ws',
      options: { preserveFlatFiles: true },
    },
  ])
  assert.deepEqual(currentTree, [
    {
      path: '/ws/docs',
      is_dir: true,
      children: [
        { path: '/ws/docs/chapter1.md', is_dir: false },
      ],
    },
  ])
})
