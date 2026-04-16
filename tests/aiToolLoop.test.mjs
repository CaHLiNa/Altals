import test from 'node:test'
import assert from 'node:assert/strict'

import { executeAiToolCalls, resolveAiRuntimeTools } from '../src/services/ai/runtime/toolLoop.js'
import { resolveRuntimeAiToolIds } from '../src/services/ai/toolRegistry.js'

test('resolveRuntimeAiToolIds adds core workspace tools in agent mode', () => {
  const toolIds = resolveRuntimeAiToolIds(['read-selected-reference'], {
    runtimeIntent: 'agent',
  })

  assert.equal(toolIds.includes('list-workspace-directory'), true)
  assert.equal(toolIds.includes('search-workspace-files'), true)
  assert.equal(toolIds.includes('read-workspace-file'), true)
  assert.equal(toolIds.includes('read-selected-reference'), true)
})

test('resolveAiRuntimeTools registers workspace file tools when enabled', async () => {
  const { tools, executors } = resolveAiRuntimeTools({
    enabledToolIds: ['list-workspace-directory', 'search-workspace-files', 'read-workspace-file'],
    toolRuntime: {
      listWorkspaceDirectory: async () => ({ entries: [{ name: 'src', kind: 'directory' }] }),
      searchWorkspaceFiles: async () => ({ matches: [{ relativePath: 'src/app.ts' }] }),
      readWorkspaceFile: async () => ({
        relativePath: 'src/app.ts',
        content: 'export const ok = true',
      }),
    },
  })

  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['list_workspace_directory', 'search_workspace_files', 'read_workspace_file']
  )

  const results = await executeAiToolCalls(
    [
      { id: 'tool-1', name: 'list_workspace_directory', arguments: {} },
      { id: 'tool-2', name: 'search_workspace_files', arguments: { query: 'app' } },
      { id: 'tool-3', name: 'read_workspace_file', arguments: { path: 'src/app.ts' } },
    ],
    executors
  )

  assert.equal(results.length, 3)
  assert.match(results[0].content, /"src"/)
  assert.match(results[1].content, /src\/app\.ts/)
  assert.match(results[2].content, /export const ok = true/)
})
