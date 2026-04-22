import { createPluginRegistration } from '@embedpdf/core'
import { DocumentManagerPluginPackage } from '@embedpdf/plugin-document-manager/vue'
import { RenderPluginPackage } from '@embedpdf/plugin-render/vue'
import { ScrollPluginPackage, ScrollStrategy } from '@embedpdf/plugin-scroll/vue'
import { SpreadMode, SpreadPluginPackage } from '@embedpdf/plugin-spread/vue'
import { ViewportPluginPackage } from '@embedpdf/plugin-viewport/vue'
import { ZoomMode, ZoomPluginPackage } from '@embedpdf/plugin-zoom/vue'

function resolveEmbedPdfSpreadMode(value) {
  return String(value || '').trim().toLowerCase() === 'double'
    ? SpreadMode.Odd
    : SpreadMode.None
}

function resolveEmbedPdfZoomLevel(options = {}) {
  const zoomMode = String(options.pdfViewerZoomMode || '').trim().toLowerCase()
  const lastScale = String(options.pdfViewerLastScale || '').trim().toLowerCase()

  if (zoomMode === 'page-fit') return ZoomMode.FitPage
  if (zoomMode === 'remember-last' && lastScale) {
    if (lastScale === 'page-fit') return ZoomMode.FitPage
    if (lastScale === 'page-width') return ZoomMode.FitWidth
    if (lastScale === 'auto') return ZoomMode.Automatic

    const numericScale = Number(lastScale)
    if (Number.isFinite(numericScale) && numericScale > 0) {
      return numericScale
    }
  }

  return ZoomMode.FitWidth
}

export function decodePdfBase64ToArrayBuffer(base64 = '') {
  const binary = atob(String(base64 || ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

export function buildEmbedPdfPluginRegistrations(options = {}) {
  const documentBuffer = options.documentBuffer
  const documentName = String(options.documentName || 'document.pdf').trim() || 'document.pdf'

  if (!(documentBuffer instanceof ArrayBuffer)) {
    return []
  }

  return [
    createPluginRegistration(DocumentManagerPluginPackage, {
      initialDocuments: [
        {
          buffer: documentBuffer,
          name: documentName,
        },
      ],
      maxDocuments: 1,
    }),
    createPluginRegistration(ViewportPluginPackage, {
      viewportGap: 12,
    }),
    createPluginRegistration(ScrollPluginPackage, {
      defaultStrategy: ScrollStrategy.Vertical,
    }),
    createPluginRegistration(SpreadPluginPackage, {
      defaultSpreadMode: resolveEmbedPdfSpreadMode(options.pdfViewerSpreadMode),
    }),
    createPluginRegistration(ZoomPluginPackage, {
      defaultZoomLevel: resolveEmbedPdfZoomLevel(options),
    }),
    createPluginRegistration(RenderPluginPackage),
  ]
}
