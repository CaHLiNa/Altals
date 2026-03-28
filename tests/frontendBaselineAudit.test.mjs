import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRONTEND_BASELINE_RAW_FORM_CONTROL_FILES } from '../scripts/frontendBaselineTooling.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('doc-only editor and workspace surfaces outside pdf.js integration no longer use raw form controls', () => {
  for (const relativePath of FRONTEND_BASELINE_RAW_FORM_CONTROL_FILES) {
    const absolutePath = path.join(repoRoot, relativePath)
    const content = readFileSync(absolutePath, 'utf8')
    assert.equal(
      /<(button|input|select|textarea)\b/.test(content),
      false,
      `${relativePath} should use shared UI primitives instead of raw form controls`
    )
  }
})
