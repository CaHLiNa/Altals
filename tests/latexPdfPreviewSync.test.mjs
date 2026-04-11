import test from 'node:test'
import assert from 'node:assert/strict'

import {
  capturePdfPreviewSelectionContext,
  resolveLatexPdfReverseSyncPayload,
  resolvePdfPreviewEventTarget,
  scrollPdfPreviewToPoint,
} from '../src/services/latex/pdfPreviewSync.js'

test('pdf preview sync resolves text node targets across iframe realms', () => {
  const parent = { nodeType: 1, nodeName: 'SPAN' }
  const text = { nodeType: 3, parentElement: parent }

  assert.equal(resolvePdfPreviewEventTarget(parent), parent)
  assert.equal(resolvePdfPreviewEventTarget(text), parent)
  assert.equal(resolvePdfPreviewEventTarget(null), null)
})

test('pdf preview sync captures selection context around the cursor', () => {
  const result = capturePdfPreviewSelectionContext({
    anchorNode: {
      nodeName: '#text',
      textContent: 'alpha beta gamma',
    },
    anchorOffset: 6,
  })

  assert.deepEqual(result, {
    textBeforeSelection: 'alpha ',
    textAfterSelection: 'beta gamma',
  })
})

test('pdf preview sync resolves reverse-sync payload from iframe viewer events', () => {
  const textLayerRect = {
    left: 120,
    top: 220,
    width: 400,
    height: 800,
  }
  const pageDom = {
    dataset: { pageNumber: '2' },
    getElementsByClassName(name) {
      return name === 'canvasWrapper'
        ? [{
          getBoundingClientRect() {
            return {
              left: 120,
              top: 220,
              width: 400,
              height: 800,
            }
          },
        }]
        : []
    },
  }
  const target = {
    nodeType: 1,
    nodeName: 'SPAN',
    closest(selector) {
      return selector === '.page' ? pageDom : null
    },
  }
  const frameWindow = {
    PDFViewerApplication: {
      pdfViewer: {
        _pages: [
          null,
          {
            textLayer: {
              div: {
                getBoundingClientRect() {
                  return textLayerRect
                },
              },
            },
            viewport: {
              rawDims: {
                pageHeight: 900,
              },
            },
            getPagePoint(left, top) {
              return [left + 1, top + 2]
            },
          },
        ],
      },
    },
    getSelection() {
      return {
        anchorNode: { nodeName: '#text', textContent: 'hello world' },
        anchorOffset: 5,
      }
    },
  }

  const result = resolveLatexPdfReverseSyncPayload({
    event: {
      target,
      currentTarget: null,
      clientX: 180,
      clientY: 260,
    },
    frameWindow,
  })

  assert.deepEqual(result, {
    page: 2,
    pos: [61, 858],
    textBeforeSelection: 'hello',
    textAfterSelection: ' world',
  })
})

test('pdf preview sync prefers the selected text rect over the raw mouse point', () => {
  const textLayerRect = {
    left: 120,
    top: 220,
    width: 400,
    height: 800,
  }
  const pageDom = {
    dataset: { pageNumber: '2' },
    getElementsByClassName(name) {
      return name === 'canvasWrapper'
        ? [{
          getBoundingClientRect() {
            return textLayerRect
          },
        }]
        : []
    },
  }
  const target = {
    nodeType: 1,
    nodeName: 'SPAN',
    closest(selector) {
      return selector === '.page' ? pageDom : null
    },
  }
  const frameWindow = {
    PDFViewerApplication: {
      pdfViewer: {
        _pages: [
          null,
          {
            textLayer: {
              div: {
                getBoundingClientRect() {
                  return textLayerRect
                },
              },
            },
            viewport: {
              rawDims: {
                pageHeight: 600,
              },
            },
            getPagePoint(left, top) {
              return [left + 1, top + 2]
            },
          },
        ],
      },
    },
    getSelection() {
      return {
        anchorNode: { nodeName: '#text', textContent: 'selected word context' },
        anchorOffset: 8,
        rangeCount: 1,
        getRangeAt() {
          return {
            getBoundingClientRect() {
              return {
                left: 200,
                top: 300,
                width: 50,
                height: 20,
              }
            },
          }
        },
      }
    },
  }

  const result = resolveLatexPdfReverseSyncPayload({
    event: {
      target,
      currentTarget: null,
      clientX: 180,
      clientY: 260,
    },
    frameWindow,
  })

  assert.deepEqual(result?.pos, [106, 508])
})

test('pdf preview sync keeps reverse-sync coordinates stable across viewer zoom levels', () => {
  function createPageDom(pageRect) {
    return {
      dataset: { pageNumber: '1' },
      getElementsByClassName(name) {
        return name === 'canvasWrapper'
          ? [{
            getBoundingClientRect() {
              return pageRect
            },
          }]
          : []
      },
    }
  }

  const targetFactory = (pageDom) => ({
    nodeType: 1,
    nodeName: 'SPAN',
    closest(selector) {
      return selector === '.page' ? pageDom : null
    },
  })

  const calls = []
  function createFrameWindow(scale) {
    return {
      PDFViewerApplication: {
        pdfViewer: {
          _pages: [
            {
              viewport: {
                rawDims: {
                  pageHeight: 800,
                },
              },
              getPagePoint(left, top) {
                calls.push([scale, left, top])
                return [left / scale, top / scale]
              },
            },
          ],
        },
      },
      getSelection() {
        return null
      },
    }
  }

  const zoom100 = createPageDom({ left: 100, top: 200, width: 400, height: 800 })
  const zoom150 = createPageDom({ left: 100, top: 200, width: 600, height: 1200 })

  const result100 = resolveLatexPdfReverseSyncPayload({
    event: {
      target: targetFactory(zoom100),
      currentTarget: null,
      clientX: 300,
      clientY: 600,
    },
    frameWindow: createFrameWindow(1),
  })

  const result150 = resolveLatexPdfReverseSyncPayload({
    event: {
      target: targetFactory(zoom150),
      currentTarget: null,
      clientX: 400,
      clientY: 800,
    },
    frameWindow: createFrameWindow(1.5),
  })

  assert.deepEqual(result100?.pos, [200, 400])
  assert.deepEqual(result150?.pos, [200, 400])
  assert.deepEqual(calls, [
    [1, 200, 400],
    [1.5, 300, 600],
  ])
})

test('pdf preview sync scrolls via viewport coordinates when available', () => {
  const viewerContainer = { scrollTop: 0, scrollLeft: 0, clientHeight: 500 }
  const pageDom = { offsetTop: 200, offsetHeight: 1000, offsetLeft: 50 }
  const app = {
    pdfViewer: {
      scrollMode: 0,
      _pages: [
        {
          viewport: {
            convertToViewportPoint(x, y) {
              return [x * 2, y * 3]
            },
          },
        },
      ],
      scrollPageIntoView() {
        throw new Error('should not use fallback scroll path')
      },
    },
  }
  const doc = {
    getElementsByClassName(name) {
      return name === 'page' ? [pageDom] : []
    },
    getElementById(id) {
      return id === 'viewerContainer' ? viewerContainer : null
    },
  }

  const scrolled = scrollPdfPreviewToPoint({
    app,
    doc,
    point: { page: 1, x: 20, y: 100 },
  })

  assert.equal(scrolled, true)
  assert.equal(viewerContainer.scrollTop, 700)
})
