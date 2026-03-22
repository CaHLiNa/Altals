import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceVersionHistoryRuntime } from '../src/domains/changes/workspaceVersionHistoryRuntime.js'

test('workspace version history runtime returns an empty list when inputs are missing', async () => {
  const runtime = createWorkspaceVersionHistoryRuntime({
    gitLogImpl: async () => {
      throw new Error('should not load git history without both paths')
    },
  })

  assert.deepEqual(await runtime.loadFileHistory({
    workspacePath: '',
    filePath: '/workspace/demo/draft.md',
  }), [])
  assert.deepEqual(await runtime.loadFileHistory({
    workspacePath: '/workspace/demo',
    filePath: '',
  }), [])
})

test('workspace version history runtime loads file history through git log', async () => {
  const calls = []
  const runtime = createWorkspaceVersionHistoryRuntime({
    gitLogImpl: async (workspacePath, filePath, limit) => {
      calls.push(['gitLog', workspacePath, filePath, limit])
      return [{ hash: 'abc', message: 'Save: 2026-03-22 10:11' }]
    },
  })

  const result = await runtime.loadFileHistory({
    workspacePath: '/workspace/demo',
    filePath: '/workspace/demo/draft.md',
  })

  assert.deepEqual(calls, [
    ['gitLog', '/workspace/demo', '/workspace/demo/draft.md', 50],
  ])
  assert.deepEqual(result, [{ hash: 'abc', message: 'Save: 2026-03-22 10:11' }])
})

test('workspace version history runtime loads workspace history through git log without a file path', async () => {
  const calls = []
  const runtime = createWorkspaceVersionHistoryRuntime({
    gitLogImpl: async (workspacePath, filePath, limit) => {
      calls.push(['gitLog', workspacePath, filePath, limit])
      return [{ hash: 'abc', message: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]' }]
    },
  })

  const result = await runtime.loadWorkspaceHistory({
    workspacePath: '/workspace/demo',
    limit: 10,
  })

  assert.deepEqual(calls, [
    ['gitLog', '/workspace/demo', null, 10],
  ])
  assert.deepEqual(result, [{ hash: 'abc', message: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]' }])
})

test('workspace version history runtime loads preview text through git show', async () => {
  const calls = []
  const runtime = createWorkspaceVersionHistoryRuntime({
    gitShowImpl: async (workspacePath, commitHash, filePath) => {
      calls.push(['gitShow', workspacePath, commitHash, filePath])
      return '# Restored draft'
    },
  })

  const result = await runtime.loadFileHistoryPreview({
    workspacePath: '/workspace/demo',
    filePath: '/workspace/demo/draft.md',
    commitHash: 'abc123',
  })

  assert.deepEqual(calls, [
    ['gitShow', '/workspace/demo', 'abc123', '/workspace/demo/draft.md'],
  ])
  assert.equal(result, '# Restored draft')
})

test('workspace version history runtime restores a history entry and reloads the file', async () => {
  const calls = []
  const runtime = createWorkspaceVersionHistoryRuntime({
    gitShowImpl: async (workspacePath, commitHash, filePath) => {
      calls.push(['gitShow', workspacePath, commitHash, filePath])
      return 'restored content'
    },
    writeFileImpl: async (path, content) => {
      calls.push(['writeFile', path, content])
    },
  })

  const result = await runtime.restoreFileHistoryEntry({
    workspacePath: '/workspace/demo',
    filePath: '/workspace/demo/draft.md',
    commitHash: 'abc123',
    reloadFileImpl: async (path) => {
      calls.push(['reloadFile', path])
    },
  })

  assert.deepEqual(result, {
    restored: true,
    content: 'restored content',
  })
  assert.deepEqual(calls, [
    ['gitShow', '/workspace/demo', 'abc123', '/workspace/demo/draft.md'],
    ['writeFile', '/workspace/demo/draft.md', 'restored content'],
    ['reloadFile', '/workspace/demo/draft.md'],
  ])
})
