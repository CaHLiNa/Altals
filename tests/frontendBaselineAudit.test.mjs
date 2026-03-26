import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const baselineFiles = [
  'src/components/editor/ReferenceView.vue',
  'src/components/editor/NotebookCell.vue',
  'src/components/sidebar/FileTree.vue',
  'src/components/sidebar/AddReferenceDialog.vue',
]

test('newly-baselined editor and sidebar surfaces no longer use raw form controls', () => {
  for (const relativePath of baselineFiles) {
    const absolutePath = path.join(repoRoot, relativePath)
    const content = readFileSync(absolutePath, 'utf8')
    assert.equal(
      /<(button|input|select|textarea)\b/.test(content),
      false,
      `${relativePath} should use shared UI primitives instead of raw form controls`
    )
  }
})
