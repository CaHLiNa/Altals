import test from 'node:test'
import assert from 'node:assert/strict'

import { createFileCreationRuntime } from '../src/domains/files/fileCreationRuntime.js'

test('file creation runtime shows duplicate-name error when create file collides', async () => {
  const collisions = []

  const runtime = createFileCreationRuntime({
    createWorkspaceFile: async () => ({ ok: false, path: '/ws/docs/chapter1.md' }),
    showCreateExistsError: (path, name) => {
      collisions.push({ path, name })
    },
  })

  assert.equal(await runtime.createFile('/ws/docs', 'chapter1.md'), null)
  assert.deepEqual(collisions, [{
    path: '/ws/docs/chapter1.md',
    name: 'chapter1.md',
  }])
})

test('file creation runtime creates folders, expands them, and forces hydration', async () => {
  const syncCalls = []
  const ensured = []
  const expanded = new Set()
  let snapshotCalls = 0

  const runtime = createFileCreationRuntime({
    createWorkspaceFolder: async () => '/ws/docs/new-folder',
    syncTreeAfterMutation: async (options) => {
      syncCalls.push(options)
    },
    ensureDirLoaded: async (path, options) => {
      ensured.push({ path, options })
    },
    addExpandedDir: (path) => {
      expanded.add(path)
    },
    cacheSnapshot: () => {
      snapshotCalls += 1
    },
  })

  assert.equal(await runtime.createFolder('/ws/docs', 'new-folder'), '/ws/docs/new-folder')
  assert.deepEqual(syncCalls, [{ expandPath: '/ws/docs' }])
  assert.deepEqual(ensured, [{
    path: '/ws/docs/new-folder',
    options: { force: true },
  }])
  assert.deepEqual([...expanded], ['/ws/docs/new-folder'])
  assert.equal(snapshotCalls, 1)
})

test('file creation runtime syncs tree after duplicate and external copy operations', async () => {
  const syncCalls = []

  const runtime = createFileCreationRuntime({
    duplicateWorkspacePath: async () => '/ws/docs/chapter1 copy.md',
    copyExternalWorkspaceFile: async () => ({ path: '/ws/docs/imported.pdf', isDir: false }),
    syncTreeAfterMutation: async (options) => {
      syncCalls.push(options)
    },
  })

  assert.equal(await runtime.duplicatePath('/ws/docs/chapter1.md'), '/ws/docs/chapter1 copy.md')
  assert.deepEqual(await runtime.copyExternalFile('/tmp/imported.pdf', '/ws/docs'), {
    path: '/ws/docs/imported.pdf',
    isDir: false,
  })
  assert.deepEqual(syncCalls, [
    { expandPath: '/ws/docs' },
    { expandPath: '/ws/docs' },
  ])
})
