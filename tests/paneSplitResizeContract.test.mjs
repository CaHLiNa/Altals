import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSource(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('split handle reports resize lifecycle and participates in shell resize state', () => {
  const source = readSource('src/components/editor/SplitHandle.vue')

  assert.match(source, /defineEmits\(\['resize', 'resize-start', 'resize-end'\]\)/)
  assert.match(source, /setShellResizeActive\(true, \{ source: 'split-handle', direction: props\.direction \}\)/)
  assert.match(source, /setShellResizeActive\(false, \{ source: 'split-handle', direction: props\.direction \}\)/)
})

test('pane container coalesces split updates through the workbench motion runtime and commits on drag end', () => {
  const source = readSource('src/components/editor/PaneContainer.vue')

  assert.match(source, /scheduleWorkbenchMotionCommit/)
  assert.match(source, /flushWorkbenchMotionCommit/)
  assert.match(source, /@resize-end="handleResizeEnd"/)
  assert.match(source, /editorStore\.commitSplitRatio\(props\.node\)/)
})

test('editor store separates live split updates from persisted split commits', () => {
  const source = readSource('src/stores/editor.js')

  assert.match(source, /setSplitRatio\(splitNode, ratio, \{ persist = false \} = \{\}\)/)
  assert.match(source, /if \(persist\) \{\s*this\.saveEditorState\(\)\s*\}/)
  assert.match(source, /commitSplitRatio\(splitNode\)/)
})

test('app shell disables sidebar transitions while a resize interaction is active', () => {
  const source = readSource('src/App.vue')

  assert.match(source, /body\.altals-shell-resizing/)
  assert.match(source, /transition: none !important;/)
})
