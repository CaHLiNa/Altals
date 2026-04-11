import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(
  path.join(repoRoot, 'src/composables/useEditorPaneWorkflow.js'),
  'utf8',
)

test('typst existing artifact recovery resolves project preview artifacts before giving up', () => {
  assert.match(source, /resolveTypstPreviewArtifact/)
  assert.match(source, /adapter\.kind === 'typst'/)
  assert.match(source, /resolvedArtifactPath = await resolveTypstPreviewArtifact/)
  assert.match(source, /typstStore\.registerExistingArtifact\?\.\(filePath, resolvedArtifactPath\)/)
})
