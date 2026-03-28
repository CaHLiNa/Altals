import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FRONTEND_BASELINE_INLINE_STYLE_FILES } from '../scripts/frontendBaselineTooling.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('baselined surfaces avoid static inline style chrome', () => {
  for (const relativePath of FRONTEND_BASELINE_INLINE_STYLE_FILES) {
    const absolutePath = path.join(repoRoot, relativePath)
    const content = readFileSync(absolutePath, 'utf8')
    assert.equal(
      /(^|\s)style="/m.test(content),
      false,
      `${relativePath} should move static chrome styles into scoped CSS`
    )
  }
})
