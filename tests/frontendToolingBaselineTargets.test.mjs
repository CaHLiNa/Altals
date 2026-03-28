import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FRONTEND_BASELINE_FORMAT_TARGETS,
  FRONTEND_BASELINE_INLINE_STYLE_FILES,
  FRONTEND_BASELINE_LINT_TARGETS,
  FRONTEND_BASELINE_RAW_FORM_CONTROL_FILES,
} from '../scripts/frontendBaselineTooling.mjs'

test('frontend baseline tooling targets stay in sync', () => {
  const lintTargets = new Set(FRONTEND_BASELINE_LINT_TARGETS)
  const formatTargets = new Set(FRONTEND_BASELINE_FORMAT_TARGETS)
  const auditedFiles = [
    ...FRONTEND_BASELINE_RAW_FORM_CONTROL_FILES,
    ...FRONTEND_BASELINE_INLINE_STYLE_FILES,
  ]

  assert.equal(
    lintTargets.size,
    FRONTEND_BASELINE_LINT_TARGETS.length,
    'lint targets should not contain duplicate entries'
  )
  assert.equal(
    formatTargets.size,
    FRONTEND_BASELINE_FORMAT_TARGETS.length,
    'format targets should not contain duplicate entries'
  )

  for (const relativePath of FRONTEND_BASELINE_LINT_TARGETS) {
    assert.equal(
      formatTargets.has(relativePath),
      true,
      `${relativePath} should stay covered by format when it is covered by lint`
    )
  }

  for (const relativePath of auditedFiles) {
    assert.equal(
      lintTargets.has(relativePath),
      true,
      `${relativePath} should stay inside the lint baseline when it has an audit guardrail`
    )
    assert.equal(
      formatTargets.has(relativePath),
      true,
      `${relativePath} should stay inside the format baseline when it has an audit guardrail`
    )
  }
})
