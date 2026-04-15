import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTauriSpawnSpec } from '../scripts/run-tauri.mjs'

test('run-tauri uses cmd.exe to launch npx on Windows', () => {
  const spec = buildTauriSpawnSpec('win32', ['build', '--', '--bundles', 'nsis'])

  assert.equal(spec.command, 'cmd.exe')
  assert.deepEqual(spec.args, ['/d', '/s', '/c', 'npx', 'tauri', 'build', '--', '--bundles', 'nsis'])
})

test('run-tauri launches npx directly on non-Windows platforms', () => {
  const spec = buildTauriSpawnSpec('linux', ['build'])

  assert.equal(spec.command, 'npx')
  assert.deepEqual(spec.args, ['tauri', 'build'])
})
