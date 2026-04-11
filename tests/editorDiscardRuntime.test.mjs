import test from 'node:test'
import assert from 'node:assert/strict'

import { discardEditorPaths } from '../src/domains/editor/editorDiscardRuntime.js'

test('discard runtime removes transient new files instead of keeping shell files around', async () => {
  const deletedPaths = []
  const clearedTransientPaths = []
  const clearedDirtyPaths = []

  await discardEditorPaths(['/ws/Untitled.md'], {
    isTransientFile: (path) => path === '/ws/Untitled.md',
    clearTransientFile: (path) => clearedTransientPaths.push(path),
    deletePath: async (path) => {
      deletedPaths.push(path)
      return true
    },
    clearDirtyPath: (path) => clearedDirtyPaths.push(path),
  })

  assert.deepEqual(deletedPaths, ['/ws/Untitled.md'])
  assert.deepEqual(clearedTransientPaths, ['/ws/Untitled.md'])
  assert.deepEqual(clearedDirtyPaths, ['/ws/Untitled.md'])
})

test('discard runtime clears draft buffers without touching the filesystem', async () => {
  const clearedDraftPaths = []
  const clearedDirtyPaths = []

  await discardEditorPaths(['draft:1/Untitled.md'], {
    isDraftFile: (path) => path === 'draft:1/Untitled.md',
    clearDraftFile: (path) => clearedDraftPaths.push(path),
    clearDirtyPath: (path) => clearedDirtyPaths.push(path),
  })

  assert.deepEqual(clearedDraftPaths, ['draft:1/Untitled.md'])
  assert.deepEqual(clearedDirtyPaths, ['draft:1/Untitled.md'])
})

test('discard runtime reloads existing files from disk after clearing cached unsaved content', async () => {
  const deletedContentPaths = []
  const reloadedPaths = []
  const clearedDirtyPaths = []

  await discardEditorPaths(['/ws/chapter.md'], {
    isTransientFile: () => false,
    deleteFileContent: (path) => deletedContentPaths.push(path),
    reloadFile: async (path) => {
      reloadedPaths.push(path)
      return '# saved on disk'
    },
    clearDirtyPath: (path) => clearedDirtyPaths.push(path),
  })

  assert.deepEqual(deletedContentPaths, ['/ws/chapter.md'])
  assert.deepEqual(reloadedPaths, ['/ws/chapter.md'])
  assert.deepEqual(clearedDirtyPaths, ['/ws/chapter.md'])
})
