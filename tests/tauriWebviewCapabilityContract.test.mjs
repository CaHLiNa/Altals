import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const capabilityPath = path.join(repoRoot, 'src-tauri/capabilities/default.json')
const capability = JSON.parse(readFileSync(capabilityPath, 'utf8'))

test('default tauri capability allows hosted child webviews for preview surfaces', () => {
  const permissions = new Set(capability.permissions || [])

  assert.equal(permissions.has('core:webview:allow-create-webview'), true)
  assert.equal(permissions.has('core:webview:allow-set-webview-position'), true)
  assert.equal(permissions.has('core:webview:allow-set-webview-size'), true)
  assert.equal(permissions.has('core:webview:allow-set-webview-auto-resize'), true)
  assert.equal(permissions.has('core:webview:allow-webview-show'), true)
  assert.equal(permissions.has('core:webview:allow-webview-hide'), true)
  assert.equal(permissions.has('core:webview:allow-webview-close'), true)
  assert.equal(permissions.has('core:webview:allow-set-webview-zoom'), true)
})
