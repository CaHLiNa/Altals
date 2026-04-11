import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSource(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('markdown preview uses the shared surface context menu', () => {
  const source = readSource('src/components/editor/MarkdownPreview.vue')
  assert.match(source, /SurfaceContextMenu/)
  assert.match(source, /data-surface-context-guard="true"/)
  assert.match(source, /@contextmenu\.prevent="handleContextMenu"/)
  assert.match(source, /t\('Open Link'\)/)
  assert.match(source, /t\('Reveal Source'\)/)
})

test('pdf preview intercepts iframe context menus and routes them through the shared menu', () => {
  const source = readSource('src/components/editor/PdfArtifactPreview.vue')
  assert.match(source, /SurfaceContextMenu/)
  assert.match(source, /data-surface-context-guard="true"/)
  assert.match(source, /frameWindow\.document\.addEventListener\('contextmenu', contextMenuHandler, true\)/)
  assert.match(source, /t\('Reload PDF'\)/)
  assert.match(source, /resolveLatexPdfReverseSyncPayload/)
})

test('typst preview intercepts iframe context menus and routes them through the shared menu', () => {
  const source = readSource('src/components/editor/TypstNativePreview.vue')
  assert.match(source, /SurfaceContextMenu/)
  assert.match(source, /data-surface-context-guard="true"/)
  assert.match(source, /frameDocument\.addEventListener\('contextmenu', handler, true\)/)
  assert.match(source, /t\('Reload Preview'\)/)
})

test('app shell installs a capture-phase guard against default preview surface context menus', () => {
  const source = readSource('src/app/shell/useAppShellEventBridge.js')
  assert.match(source, /handleSurfaceContextMenuGuard/)
  assert.match(source, /document\.addEventListener\('contextmenu', handleSurfaceContextMenuGuard, true\)/)
  assert.match(source, /closest\?\.\('\[data-surface-context-guard="true"\]'\)/)
})

test('settings surfaces suppress default context menus via the shell guard', () => {
  const settingsSource = readSource('src/components/settings/Settings.vue')
  const sidebarSource = readSource('src/components/settings/SettingsSidebar.vue')
  assert.match(settingsSource, /data-surface-context-guard="true"/)
  assert.match(sidebarSource, /data-surface-context-guard="true"/)
})

test('workspace starter and right sidebar suppress default context menus without adding local menus', () => {
  const starterSource = readSource('src/components/editor/WorkspaceStarter.vue')
  const rightSidebarSource = readSource('src/components/sidebar/RightSidebar.vue')
  assert.match(starterSource, /data-surface-context-guard="true"/)
  assert.match(rightSidebarSource, /data-surface-context-guard="true"/)
  assert.doesNotMatch(starterSource, /SurfaceContextMenu/)
  assert.doesNotMatch(rightSidebarSource, /SurfaceContextMenu/)
})

test('editor context menu avoids the native paste fallback and exposes a host hint path', () => {
  const menuSource = readSource('src/components/editor/EditorContextMenu.vue')
  const editorSource = readSource('src/components/editor/TextEditor.vue')
  assert.doesNotMatch(menuSource, /execCommand\('paste'\)/)
  assert.match(menuSource, /@tauri-apps\/plugin-clipboard-manager/)
  assert.match(menuSource, /readClipboardText/)
  assert.match(menuSource, /emit\('paste-unavailable'\)/)
  assert.match(editorSource, /@paste-unavailable="handleContextMenuPasteUnavailable"/)
})
