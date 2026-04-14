import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'))
}

test('macOS window override preserves base geometry and minimum size constraints', () => {
  const macosConfig = readJson('src-tauri/tauri.macos.conf.json')
  const macosWindow = macosConfig.app?.windows?.[0]

  assert.equal(macosWindow?.title, 'Altals')
  assert.equal(macosWindow?.width, 1120)
  assert.equal(macosWindow?.height, 720)
  assert.equal(macosWindow?.minWidth, 1120)
  assert.equal(macosWindow?.minHeight, 720)
  assert.equal(macosWindow?.resizable, true)
})

test('default tauri capability allows runtime minimum size enforcement', () => {
  const capability = readJson('src-tauri/capabilities/default.json')
  const permissions = new Set(capability.permissions || [])

  assert.equal(permissions.has('core:window:allow-set-min-size'), true)
})
