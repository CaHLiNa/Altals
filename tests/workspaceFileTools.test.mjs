import test from 'node:test'
import assert from 'node:assert/strict'

import {
  listWorkspaceDirectory,
  readWorkspaceFile,
  resolveWorkspaceToolPath,
  searchWorkspaceFiles,
} from '../src/services/ai/runtime/workspaceFileTools.js'

test('resolveWorkspaceToolPath keeps relative paths inside the current workspace', () => {
  assert.equal(resolveWorkspaceToolPath('src/app.ts', '/workspace'), '/workspace/src/app.ts')
  assert.equal(
    resolveWorkspaceToolPath('/workspace/src/app.ts', '/workspace'),
    '/workspace/src/app.ts'
  )
  assert.throws(
    () => resolveWorkspaceToolPath('../secret.txt', '/workspace'),
    /inside the current workspace/
  )
})

test('listWorkspaceDirectory returns immediate child files and directories', () => {
  const result = listWorkspaceDirectory({
    workspacePath: '/workspace',
    path: 'src',
    files: [
      { path: '/workspace/src/app.ts' },
      { path: '/workspace/src/runtime/toolLoop.js' },
      { path: '/workspace/README.md' },
    ],
  })

  assert.equal(result.relativePath, 'src')
  assert.deepEqual(
    result.entries.map((entry) => [entry.name, entry.kind]),
    [
      ['runtime', 'directory'],
      ['app.ts', 'file'],
    ]
  )
})

test('searchWorkspaceFiles searches by path and filename inside the workspace', () => {
  const result = searchWorkspaceFiles({
    workspacePath: '/workspace',
    query: 'tool',
    files: [
      { path: '/workspace/src/runtime/toolLoop.js' },
      { path: '/workspace/src/services/agentPromptBuilder.js' },
      { path: '/workspace/README.md' },
    ],
  })

  assert.equal(result.matches.length, 1)
  assert.equal(result.matches[0].relativePath, 'src/runtime/toolLoop.js')
})

test('readWorkspaceFile reads a workspace file through the provided file reader', async () => {
  const result = await readWorkspaceFile({
    workspacePath: '/workspace',
    path: 'src/app.ts',
    readFile: async (path) => `content:${path}`,
  })

  assert.equal(result.available, true)
  assert.equal(result.relativePath, 'src/app.ts')
  assert.equal(result.content, 'content:/workspace/src/app.ts')
})
