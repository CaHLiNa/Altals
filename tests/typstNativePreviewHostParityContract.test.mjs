import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(
  new URL('../src/components/editor/TypstNativePreview.vue', import.meta.url),
  'utf8',
)

test('typst native preview host stays close to tinymist upstream and avoids custom iframe repair layers', () => {
  assert.doesNotMatch(source, /ResizeObserver/)
  assert.doesNotMatch(source, /shouldRepairTypstPreviewFit/)
  assert.doesNotMatch(source, /dispatchEvent\(new Event\('resize'\)\)/)
  assert.doesNotMatch(source, /installPreviewScrollSourceIntentTracking/)
  assert.doesNotMatch(source, /contextmenu/)
})
