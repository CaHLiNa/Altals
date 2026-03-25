import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isPdfViewerRenderReady,
  shouldPulseShellResizeForSidebarToggle,
  shouldRebuildPdfViewerOnActivation,
  SIDEBAR_TOGGLE_RESIZE_PULSE_MS,
} from '../src/domains/editor/pdfViewerRuntime.js'

test('shouldPulseShellResizeForSidebarToggle only pulses when a visible PDF sidebar state changes', () => {
  assert.equal(
    shouldPulseShellResizeForSidebarToggle({
      previousOpen: true,
      nextOpen: false,
      hasVisiblePdfPane: true,
    }),
    true
  )
  assert.equal(
    shouldPulseShellResizeForSidebarToggle({
      previousOpen: false,
      nextOpen: false,
      hasVisiblePdfPane: true,
    }),
    false
  )
  assert.equal(
    shouldPulseShellResizeForSidebarToggle({
      previousOpen: true,
      nextOpen: false,
      hasVisiblePdfPane: false,
    }),
    false
  )
})

test('isPdfViewerRenderReady requires both page nodes and visible page height', () => {
  assert.equal(
    isPdfViewerRenderReady({ pageElementCount: 3, firstPageHeight: 812, pagesCount: 9 }),
    true
  )
  assert.equal(
    isPdfViewerRenderReady({ pageElementCount: 3, firstPageHeight: 812, pagesCount: 0 }),
    false
  )
  assert.equal(
    isPdfViewerRenderReady({ pageElementCount: 0, firstPageHeight: 812, pagesCount: 9 }),
    false
  )
  assert.equal(
    isPdfViewerRenderReady({ pageElementCount: 3, firstPageHeight: 0, pagesCount: 9 }),
    false
  )
})

test('SIDEBAR_TOGGLE_RESIZE_PULSE_MS stays in a compact UI-safe range', () => {
  assert.equal(Number.isInteger(SIDEBAR_TOGGLE_RESIZE_PULSE_MS), true)
  assert.equal(SIDEBAR_TOGGLE_RESIZE_PULSE_MS >= 80, true)
  assert.equal(SIDEBAR_TOGGLE_RESIZE_PULSE_MS <= 240, true)
})

test('shouldRebuildPdfViewerOnActivation rejects cached viewers with zero pages or blank first pages', () => {
  assert.equal(
    shouldRebuildPdfViewerOnActivation({
      pagesCount: 0,
      pageElementCount: 3,
      firstPageHeight: 812,
    }),
    true
  )
  assert.equal(
    shouldRebuildPdfViewerOnActivation({
      pagesCount: 9,
      pageElementCount: 0,
      firstPageHeight: 812,
    }),
    true
  )
  assert.equal(
    shouldRebuildPdfViewerOnActivation({
      pagesCount: 9,
      pageElementCount: 3,
      firstPageHeight: 812,
    }),
    false
  )
})
