import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const viewerCssSource = readFileSync(
  path.join(repoRoot, 'public/pdfjs-viewer/web/viewer.css'),
  'utf8'
)
const viewerHtmlSource = readFileSync(
  path.join(repoRoot, 'public/pdfjs-viewer/web/viewer.html'),
  'utf8'
)
const viewerRuntimeSource = readFileSync(
  path.join(repoRoot, 'public/pdfjs-viewer/web/viewer.mjs'),
  'utf8'
)
const viewerLocalePath = path.join(repoRoot, 'public/pdfjs-viewer/web/locale/zh-CN/viewer.ftl')
const viewerLocaleSource = existsSync(viewerLocalePath) ? readFileSync(viewerLocalePath, 'utf8') : ''
const pdfIframeSurfaceSource = readFileSync(
  path.join(repoRoot, 'src/components/editor/PdfIframeSurface.vue'),
  'utf8'
)

test('altals pdf viewer sidebar chrome stays flat and padded inside the preview surface', () => {
  assert.match(
    viewerCssSource,
    /#toolbarContainer #toolbarViewer\{[\s\S]*display:grid;[\s\S]*grid-template-columns:minmax\(0, 1fr\) auto minmax\(0, 1fr\);/
  )
  assert.match(viewerCssSource, /#toolbarViewerMiddle\{[\s\S]*position:static;[\s\S]*justify-self:center;/)
  assert.match(viewerCssSource, /#toolbarViewerRight\{[\s\S]*position:static;[\s\S]*justify-self:end;/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*inset-block-start:calc\(100% \+ 1px\);/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*height:calc\(var\(--viewer-container-height\) - var\(--toolbar-height\) - 1px\);/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*width:var\(--viewsManager-width\);/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*border-inline-end:none;/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*border:none;/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*border-radius:0;/)
  assert.match(viewerCssSource, /#viewsManager\{[\s\S]*transform:translateX\(calc\(-100% - 8px\)\);/)
  assert.match(viewerCssSource, /#sidebarContent\{\s*box-shadow:none;/)
  assert.match(
    viewerCssSource,
    /#outerContainer\.viewsManagerOpen #viewerContainer:not\(\.pdfPresentationMode\)\{[\s\S]*inset-inline-start:0;/
  )
  assert.match(viewerCssSource, /#viewsManager #viewsManagerContent\{[\s\S]*padding:12px 10px 20px;/)
  assert.match(
    viewerCssSource,
    /#viewsManager #viewsManagerContent #thumbnailsView\{[\s\S]*padding:6px 10px 20px;/
  )
  assert.match(
    viewerCssSource,
    /#viewsManager #viewsManagerContent #thumbnailsView > \.thumbnail\{[\s\S]*scroll-margin-top:12px;/
  )
  assert.match(viewerCssSource, /#scaleSelectContainer\{\s*min-width:120px;/)
  assert.match(viewerCssSource, /\.dropdownToolbarButton\{[\s\S]*min-width:108px;/)
  assert.match(viewerCssSource, /\.dropdownToolbarButton select\{[\s\S]*padding-inline:12px 26px;/)
  assert.match(viewerCssSource, /\.dropdownToolbarButton select\{[\s\S]*font-size:12px;/)
})

test('pdf iframe surface locks semantic zoom during live shell resize and restores it afterward', () => {
  assert.match(pdfIframeSurfaceSource, /createPdfViewerScaleLock/)
  assert.match(pdfIframeSurfaceSource, /SHELL_RESIZE_PHASE_EVENT/)
  assert.match(pdfIframeSurfaceSource, /isShellResizeActive\(\)/)
  assert.match(pdfIframeSurfaceSource, /const \{ locale: uiLocale, t \} = useI18n\(\)/)
  assert.match(pdfIframeSurfaceSource, /function getViewerLocale\(\) \{\s*return String\(uiLocale\.value \|\| ''\)\.trim\(\) \|\| 'en-US'/)
  assert.match(pdfIframeSurfaceSource, /locale:\s*getViewerLocale\(\)/)
  assert.match(
    pdfIframeSurfaceSource,
    /window\.addEventListener\(SHELL_RESIZE_PHASE_EVENT, handleShellResizePhase\)/
  )
  assert.match(pdfIframeSurfaceSource, /if \(phase === 'live-resize'\) \{\s*lockViewerScaleForResize\(\)/)
  assert.match(
    pdfIframeSurfaceSource,
    /if \(phase === 'settling' \|\| phase === 'idle'\) \{\s*restoreViewerScaleAfterResize\(\)/
  )
})

test('pdf viewer ships a zh-CN locale pack for common toolbar and zoom labels', () => {
  assert.equal(existsSync(viewerLocalePath), true)
  assert.match(viewerLocaleSource, /pdfjs-page-scale-auto = 自动缩放/)
  assert.match(viewerLocaleSource, /pdfjs-page-scale-actual = 实际大小/)
  assert.match(viewerLocaleSource, /pdfjs-page-scale-fit = 适合整页/)
  assert.match(viewerLocaleSource, /pdfjs-page-scale-width = 适合页宽/)
  assert.match(viewerLocaleSource, /pdfjs-toggle-views-manager-button-label = 切换侧边栏/)
})

test('pdf viewer zoom menu excludes auto and page-width, and defaults to page-fit', () => {
  assert.doesNotMatch(viewerHtmlSource, /id="pageAutoOption"/)
  assert.doesNotMatch(viewerHtmlSource, /id="pageWidthOption"/)
  assert.match(viewerHtmlSource, /id="pageFitOption" value="page-fit" selected="selected"/)
  assert.match(viewerRuntimeSource, /const DEFAULT_SCALE_VALUE = "page-fit";/)
})
