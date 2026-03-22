import test from 'node:test'
import assert from 'node:assert/strict'

import { createDocumentWorkflowBuildOperationRuntime } from '../src/domains/document/documentWorkflowBuildOperationRuntime.js'

test('document workflow build operation runtime runs build through the adapter compile seam', async () => {
  const compileCalls = []
  const runtime = createDocumentWorkflowBuildOperationRuntime({
    getBuildRuntime: () => ({
      buildAdapterContext(filePath, options = {}) {
        return {
          adapter: {
            compile: {
              async compile(nextFilePath, context, nextOptions = {}) {
                compileCalls.push({
                  filePath: nextFilePath,
                  context,
                  options: nextOptions,
                })
                return { filePath: nextFilePath, phase: 'queued' }
              },
            },
          },
          filePath,
          marker: 'context-built',
          trigger: options.trigger || '',
        }
      },
    }),
  })

  const result = await runtime.runBuildForFile('/workspace/main.tex', {
    trigger: 'latex-compile-button',
    sourcePaneId: 'pane-1',
  })

  assert.deepEqual(result, {
    filePath: '/workspace/main.tex',
    phase: 'queued',
  })
  assert.equal(compileCalls.length, 1)
  assert.equal(compileCalls[0].filePath, '/workspace/main.tex')
  assert.equal(compileCalls[0].context.marker, 'context-built')
  assert.equal(compileCalls[0].options.trigger, 'latex-compile-button')
  assert.equal(compileCalls[0].options.sourcePaneId, 'pane-1')
})

test('document workflow build operation runtime returns null when the file has no compile adapter', async () => {
  const runtime = createDocumentWorkflowBuildOperationRuntime({
    getBuildRuntime: () => ({
      buildAdapterContext() {
        return {
          adapter: {
            compile: null,
          },
        }
      },
    }),
  })

  const result = await runtime.runBuildForFile('/workspace/chapter.md', {
    trigger: 'markdown-preview-toggle',
  })

  assert.equal(result, null)
})
