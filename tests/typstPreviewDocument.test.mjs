import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_TINYMIST_PREVIEW_MODE,
  PREVIEW_DOCUMENT_CACHE_VERSION,
  TINYMIST_PREVIEW_MODE_PLACEHOLDER,
  TINYMIST_PREVIEW_STATE_PLACEHOLDER,
  TINYMIST_WS_PLACEHOLDER,
  buildPreviewDocumentCacheKey,
  patchTypstPreviewDocumentHtml,
  resolveSessionWebSocketUrl,
} from '../src/services/typst/previewDocument.js'

test('resolveSessionWebSocketUrl prefers explicit websocket URLs and falls back to the data plane port', () => {
  assert.equal(
    resolveSessionWebSocketUrl({ dataPlaneWsUrl: 'ws://127.0.0.1:24424' }),
    'ws://127.0.0.1:24424',
  )
  assert.equal(
    resolveSessionWebSocketUrl({ dataPlaneUrl: 'http://127.0.0.1:24424' }),
    'ws://127.0.0.1:24424',
  )
  assert.equal(
    resolveSessionWebSocketUrl({ dataPlanePort: 24424 }),
    'ws://127.0.0.1:24424',
  )
})

test('patchTypstPreviewDocumentHtml rewrites Tinymist websocket placeholders to the active data plane url', () => {
  const html = `
    <script>
      let urlObject = new URL("${TINYMIST_WS_PLACEHOLDER}", window.location.href);
    </script>
  `

  const result = patchTypstPreviewDocumentHtml(html, {
    websocketUrl: 'ws://127.0.0.1:24424',
  })

  assert.match(result.html, /ws:\/\/127\.0\.0\.1:24424/)
  assert.equal(result.patched, true)
})

test('patchTypstPreviewDocumentHtml only rewrites the preview mode placeholder when a non-default mode is requested', () => {
  const html = `<body>${TINYMIST_PREVIEW_MODE_PLACEHOLDER}</body>`

  const defaultResult = patchTypstPreviewDocumentHtml(html)
  assert.equal(defaultResult.html, html)
  assert.equal(defaultResult.patched, false)

  const slideResult = patchTypstPreviewDocumentHtml(html, {
    previewMode: 'slide',
  })
  assert.equal(slideResult.html, '<body>preview-arg:previewMode:Slide</body>')
  assert.equal(slideResult.patched, true)
})

test('patchTypstPreviewDocumentHtml injects preview state only when explicitly provided', () => {
  const html = `<body>${TINYMIST_PREVIEW_STATE_PLACEHOLDER}</body>`

  const emptyResult = patchTypstPreviewDocumentHtml(html)
  assert.equal(emptyResult.html, html)
  assert.equal(emptyResult.patched, false)

  const stateResult = patchTypstPreviewDocumentHtml(html, {
    previewState: 'eyJmb28iOiJiYXIifQ==',
  })
  assert.equal(stateResult.html, '<body>preview-arg:state:eyJmb28iOiJiYXIifQ==</body>')
  assert.equal(stateResult.patched, true)
})

test('buildPreviewDocumentCacheKey tracks the Tinymist websocket endpoint, preview mode, and workspace path', () => {
  assert.equal(
    buildPreviewDocumentCacheKey({
      dataPlanePort: 24424,
      workspacePath: '/workspace/project',
    }, {}),
    `ws://127.0.0.1:24424::v${PREVIEW_DOCUMENT_CACHE_VERSION}::${DEFAULT_TINYMIST_PREVIEW_MODE}::/workspace/project`,
  )
  assert.equal(
    buildPreviewDocumentCacheKey({
      dataPlaneWsUrl: 'ws://127.0.0.1:24424',
      workspacePath: '/workspace/project',
    }, {
      previewMode: 'slide',
    }),
    `ws://127.0.0.1:24424::v${PREVIEW_DOCUMENT_CACHE_VERSION}::Slide::/workspace/project`,
  )
})
