import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceHistoryPreparationRuntime } from '../src/domains/changes/workspaceHistoryPreparationRuntime.js'

function createRuntimeHarness(overrides = {}) {
  const editorStore = {
    allOpenFiles: new Set(['/workspace/chapter.md']),
    persistCalls: [],
    getDirtyFiles(paths) {
      return paths.filter((path) => path === '/workspace/chapter.md')
    },
    async persistPaths(paths) {
      this.persistCalls.push(paths)
      return true
    },
    ...overrides.editorStore,
  }

  const filesStore = {
    fileContents: {
      '/workspace/chapter.md': '# Chapter',
    },
    saveCalls: [],
    async saveFile(path, content) {
      this.saveCalls.push({ path, content })
      return true
    },
    ...overrides.filesStore,
  }

  const runtime = createWorkspaceHistoryPreparationRuntime(overrides.runtimeOptions)
  return {
    runtime,
    editorStore,
    filesStore,
  }
}

test('workspace history preparation runtime persists dirty editors before saving eligible open files', async () => {
  const { runtime, editorStore, filesStore } = createRuntimeHarness({
    editorStore: {
      allOpenFiles: new Set([
        '/workspace/chapter.md',
        '/workspace/notes.md',
        'preview:/workspace/chapter.md',
        'newtab:1',
      ]),
      getDirtyFiles(paths) {
        return paths.filter((path) => path === '/workspace/chapter.md')
      },
    },
    filesStore: {
      fileContents: {
        '/workspace/chapter.md': '# Chapter',
        '/workspace/notes.md': '# Notes',
        'preview:/workspace/chapter.md': 'preview cache',
      },
    },
  })

  const result = await runtime.prepareWorkspaceHistoryFiles({ editorStore, filesStore })

  assert.deepEqual(editorStore.persistCalls, [['/workspace/chapter.md']])
  assert.deepEqual(filesStore.saveCalls, [
    { path: '/workspace/chapter.md', content: '# Chapter' },
    { path: '/workspace/notes.md', content: '# Notes' },
  ])
  assert.deepEqual(result, {
    ok: true,
    dirtyPaths: ['/workspace/chapter.md'],
    persistedFiles: ['/workspace/chapter.md', '/workspace/notes.md'],
  })
})

test('workspace history preparation runtime stops when dirty editor persistence fails', async () => {
  const { runtime, editorStore, filesStore } = createRuntimeHarness({
    editorStore: {
      async persistPaths(paths) {
        this.persistCalls.push(paths)
        return false
      },
    },
  })

  const result = await runtime.prepareWorkspaceHistoryFiles({ editorStore, filesStore })

  assert.deepEqual(editorStore.persistCalls, [['/workspace/chapter.md']])
  assert.deepEqual(filesStore.saveCalls, [])
  assert.deepEqual(result, {
    ok: false,
    reason: 'dirty-persist-failed',
    dirtyPaths: ['/workspace/chapter.md'],
  })
})

test('workspace history preparation runtime reports file save failures after eligible filtering', async () => {
  const { runtime, editorStore, filesStore } = createRuntimeHarness({
    editorStore: {
      allOpenFiles: new Set([
        '/workspace/chapter.md',
        '/workspace/notes.md',
        'preview:/workspace/chapter.md',
      ]),
      getDirtyFiles() {
        return []
      },
    },
    filesStore: {
      fileContents: {
        '/workspace/chapter.md': '# Chapter',
        '/workspace/notes.md': '# Notes',
        'preview:/workspace/chapter.md': 'ignore me',
      },
      async saveFile(path, content) {
        this.saveCalls.push({ path, content })
        return path !== '/workspace/notes.md'
      },
    },
  })

  const result = await runtime.prepareWorkspaceHistoryFiles({ editorStore, filesStore })

  assert.deepEqual(filesStore.saveCalls, [
    { path: '/workspace/chapter.md', content: '# Chapter' },
    { path: '/workspace/notes.md', content: '# Notes' },
  ])
  assert.deepEqual(result, {
    ok: false,
    reason: 'file-save-failed',
    filePath: '/workspace/notes.md',
    dirtyPaths: [],
    persistedFiles: ['/workspace/chapter.md'],
  })
})
