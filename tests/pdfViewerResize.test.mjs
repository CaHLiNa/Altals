import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createPdfViewerScaleLock,
  isPdfViewerSemanticScaleValue,
} from '../src/services/pdf/viewerResize.js'

test('isPdfViewerSemanticScaleValue only matches semantic fit modes', () => {
  assert.equal(isPdfViewerSemanticScaleValue('auto'), true)
  assert.equal(isPdfViewerSemanticScaleValue('page-fit'), true)
  assert.equal(isPdfViewerSemanticScaleValue('page-width'), true)
  assert.equal(isPdfViewerSemanticScaleValue('1.25'), false)
  assert.equal(isPdfViewerSemanticScaleValue('page-actual'), false)
})

test('createPdfViewerScaleLock snapshots semantic fit modes into a numeric lock value', () => {
  assert.deepEqual(createPdfViewerScaleLock('page-width', 1.234567), {
    lockedScaleValue: '1.2346',
    restoreScaleValue: 'page-width',
  })
})

test('createPdfViewerScaleLock ignores numeric zoom states and invalid scales', () => {
  assert.equal(createPdfViewerScaleLock('1.2', 1.2), null)
  assert.equal(createPdfViewerScaleLock('auto', 0), null)
  assert.equal(createPdfViewerScaleLock('page-fit', Number.NaN), null)
})
