import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcRoot = path.join(repoRoot, 'src')

function walkFiles(rootDir) {
  const output = []
  const pending = [rootDir]
  while (pending.length) {
    const current = pending.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        pending.push(fullPath)
        continue
      }
      if (!/\.(js|mjs|vue)$/.test(entry.name)) continue
      output.push(fullPath)
    }
  }
  return output
}

function findDirectCallers(callPattern, { exclude = [] } = {}) {
  return walkFiles(srcRoot)
    .map((absolutePath) => {
      const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join('/')
      const content = readFileSync(absolutePath, 'utf8')
      return { relativePath, content }
    })
    .filter(({ relativePath, content }) => {
      if (exclude.includes(relativePath)) return false
      return content.includes(callPattern)
    })
    .map(({ relativePath }) => relativePath)
    .sort()
}

test('remaining direct launchAiTask callers stay explicit and the document workflow composable does not regress', () => {
  const callers = findDirectCallers('launchAiTask(', {
    exclude: ['src/services/ai/launch.js'],
  })

  assert.deepEqual(callers, [
    'src/components/ai/AiQuickPanel.vue',
    'src/components/ai/AiWorkbenchHome.vue',
    'src/components/chat/ChatSession.vue',
    'src/components/editor/AiLauncher.vue',
    'src/components/editor/NotebookEditor.vue',
    'src/components/editor/ReferenceView.vue',
    'src/components/sidebar/ReferenceList.vue',
    'src/services/commentActions.js',
  ])

  const workflowComposable = readFileSync(
    path.join(repoRoot, 'src/composables/useEditorPaneWorkflow.js'),
    'utf8',
  )
  assert.equal(workflowComposable.includes('launchAiTask('), false)
  assert.equal(workflowComposable.includes('createTexTypFixTask'), false)
  assert.equal(workflowComposable.includes('createTexTypDiagnoseTask'), false)
})

test('remaining direct launchWorkflowTask callers stay explicit after the document AI seam landed', () => {
  const callers = findDirectCallers('launchWorkflowTask(', {
    exclude: ['src/services/ai/launch.js'],
  })

  assert.deepEqual(callers, [
    'src/components/ai/AiQuickPanel.vue',
    'src/components/ai/AiWorkbenchHome.vue',
    'src/components/editor/AiLauncher.vue',
  ])
})
