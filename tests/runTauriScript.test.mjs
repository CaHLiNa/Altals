import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTauriSpawnSpec } from '../scripts/run-tauri.mjs'

test('run-tauri uses a shell command to launch npx on Windows', () => {
  const spec = buildTauriSpawnSpec('win32', ['build', '--', '--bundles', 'nsis'])

  assert.equal(spec.command, 'npx tauri build -- --bundles nsis')
  assert.deepEqual(spec.args, [])
  assert.deepEqual(spec.options, { shell: true })
})

test('run-tauri launches npx directly on non-Windows platforms', () => {
  const spec = buildTauriSpawnSpec('linux', ['build'])

  assert.equal(spec.command, 'npx')
  assert.deepEqual(spec.args, ['tauri', 'build'])
})
