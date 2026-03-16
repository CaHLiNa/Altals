import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveOutlineResizeHeights } from '../src/composables/useLeftSidebarPanels.js'

test('resolveOutlineResizeHeights keeps the refs+outline stack total constant', () => {
  const result = resolveOutlineResizeHeights({
    startRefHeight: 250,
    startOutlineHeight: 220,
    delta: 40,
  })

  assert.equal(result.refHeight + result.outlineHeight, 470)
  assert.equal(result.outlineHeight, 260)
  assert.equal(result.refHeight, 210)
})

test('resolveOutlineResizeHeights clamps to minimum heights', () => {
  const result = resolveOutlineResizeHeights({
    startRefHeight: 120,
    startOutlineHeight: 120,
    delta: 200,
  })

  assert.equal(result.outlineHeight, 180)
  assert.equal(result.refHeight, 60)
})
