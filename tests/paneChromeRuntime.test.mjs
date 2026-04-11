import test from 'node:test'
import assert from 'node:assert/strict'

import { shouldShowIntegratedDocumentTitle } from '../src/domains/editor/paneChromeRuntime.js'

test('integrated document title is hidden on the settings surface', () => {
  assert.equal(
    shouldShowIntegratedDocumentTitle({
      hasIntegratedDocumentTitle: true,
      activeTab: '/tmp/demo.md',
      isActive: true,
      hasSinglePane: true,
      isSettingsSurface: true,
    }),
    false
  )
})

test('integrated document title stays visible for the active workspace pane', () => {
  assert.equal(
    shouldShowIntegratedDocumentTitle({
      hasIntegratedDocumentTitle: true,
      activeTab: '/tmp/demo.md',
      isActive: true,
      hasSinglePane: false,
      isSettingsSurface: false,
    }),
    true
  )
})

test('integrated document title stays available for single-pane workspace layouts', () => {
  assert.equal(
    shouldShowIntegratedDocumentTitle({
      hasIntegratedDocumentTitle: true,
      activeTab: '/tmp/demo.md',
      isActive: false,
      hasSinglePane: true,
      isSettingsSurface: false,
    }),
    true
  )
})
