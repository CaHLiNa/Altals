<template>
  <Viewport :document-id="documentId" class="pdf-artifact-preview__viewport">
    <Scroller :document-id="documentId" v-slot="{ page }">
      <div
        :ref="(element) => setPageElement(page.pageNumber, element)"
        class="pdf-artifact-preview__page"
        :data-page-number="page.pageNumber"
        :style="{ width: `${page.width}px`, height: `${page.height}px` }"
      >
        <RenderLayer :document-id="documentId" :page-index="page.pageIndex" />
      </div>
    </Scroller>
  </Viewport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import { RenderLayer } from '@embedpdf/plugin-render/vue'
import { Scroller, useScroll, useScrollCapability } from '@embedpdf/plugin-scroll/vue'
import { SpreadMode, useSpread } from '@embedpdf/plugin-spread/vue'
import { Viewport, useViewportCapability } from '@embedpdf/plugin-viewport/vue'
import { ZoomMode, useZoom } from '@embedpdf/plugin-zoom/vue'

import { useWorkspaceStore } from '../../stores/workspace.js'
import {
  normalizeWorkspacePdfViewerLastScale,
  normalizeWorkspacePdfViewerSpreadMode,
  normalizeWorkspacePdfViewerZoomMode,
} from '../../services/workspacePreferences.js'

const props = defineProps({
  documentId: { type: String, required: true },
  pdfViewerZoomMode: { type: String, default: 'page-width' },
  pdfViewerSpreadMode: { type: String, default: 'single' },
  pdfViewerLastScale: { type: String, default: '' },
  restoreState: { type: Object, default: null },
})

const emit = defineEmits(['view-state-change', 'restore-state-consumed'])

const workspace = useWorkspaceStore()
const zoom = useZoom(() => props.documentId)
const spread = useSpread(() => props.documentId)
const scroll = useScroll(() => props.documentId)
const { provides: scrollCapability } = useScrollCapability()
const { provides: viewportCapability } = useViewportCapability()

const pageElements = new Map()
const pendingRestoreState = ref(null)
const initialLayoutHandled = ref(false)

let scheduledViewStateFrame = 0
let restoreRevision = 0

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function setPageElement(pageNumber, element) {
  const numericPageNumber = Number(pageNumber || 0)
  if (!Number.isInteger(numericPageNumber) || numericPageNumber < 1) return
  if (element) {
    pageElements.set(numericPageNumber, element)
    return
  }
  pageElements.delete(numericPageNumber)
}

function resolveScaleValueFromZoomState(state = zoom.state.value) {
  const zoomLevel = state?.zoomLevel
  if (zoomLevel === ZoomMode.FitPage) return 'page-fit'
  if (zoomLevel === ZoomMode.FitWidth) return 'page-width'
  if (zoomLevel === ZoomMode.Automatic) return 'auto'

  const currentZoomLevel = Number(state?.currentZoomLevel || 0)
  if (!Number.isFinite(currentZoomLevel) || currentZoomLevel <= 0) return ''
  return String(Math.round(currentZoomLevel * 10000) / 10000)
}

function resolvePreferredSpreadMode() {
  return normalizeWorkspacePdfViewerSpreadMode(props.pdfViewerSpreadMode) === 'double'
    ? SpreadMode.Odd
    : SpreadMode.None
}

function resolvePreferredZoomValue() {
  const normalizedZoomMode = normalizeWorkspacePdfViewerZoomMode(props.pdfViewerZoomMode)
  if (normalizedZoomMode === 'page-fit') return 'page-fit'
  if (normalizedZoomMode === 'remember-last') {
    return normalizeWorkspacePdfViewerLastScale(props.pdfViewerLastScale) || 'page-width'
  }
  return 'page-width'
}

function applyZoomValue(scaleValue) {
  const zoomScope = zoom.provides.value
  if (!zoomScope || !scaleValue) return false

  if (scaleValue === 'page-fit') {
    zoomScope.requestZoom(ZoomMode.FitPage)
    return true
  }

  if (scaleValue === 'page-width') {
    zoomScope.requestZoom(ZoomMode.FitWidth)
    return true
  }

  if (scaleValue === 'auto') {
    zoomScope.requestZoom(ZoomMode.Automatic)
    return true
  }

  const numericScale = Number(scaleValue)
  if (!Number.isFinite(numericScale) || numericScale <= 0) return false
  zoomScope.requestZoom(numericScale)
  return true
}

function applyViewerPreferences() {
  spread.provides.value?.setSpreadMode(resolvePreferredSpreadMode())
  applyZoomValue(resolvePreferredZoomValue())
}

function captureCurrentViewState() {
  const viewportScope = viewportCapability.value?.forDocument(props.documentId)
  if (!viewportScope) return null

  const pageNumber = Math.max(1, Number(scroll.state.value?.currentPage || 1))
  const scaleValue = normalizeWorkspacePdfViewerLastScale(resolveScaleValueFromZoomState())
  const viewportMetrics = viewportScope.getMetrics()
  const pageElement = pageElements.get(pageNumber)
  const pageHeight = Number(pageElement?.offsetHeight || 0)
  const pageTop = Number(pageElement?.offsetTop || 0)
  const pageScrollRatio =
    Number.isFinite(pageHeight) && pageHeight > 0
      ? clamp((Number(viewportMetrics?.scrollTop || 0) - pageTop) / pageHeight, 0, 1)
      : null

  return {
    pageNumber,
    scaleValue,
    pageScrollRatio,
    scrollLeft: Number(viewportMetrics?.scrollLeft || 0),
  }
}

function emitCurrentViewState() {
  scheduledViewStateFrame = 0
  const nextState = captureCurrentViewState()
  if (!nextState) return
  emit('view-state-change', nextState)
}

function scheduleViewStateEmission() {
  if (typeof window === 'undefined') {
    emitCurrentViewState()
    return
  }
  if (scheduledViewStateFrame) return
  scheduledViewStateFrame = window.requestAnimationFrame(() => {
    emitCurrentViewState()
  })
}

async function restoreViewState(state) {
  const currentRevision = ++restoreRevision
  if (!state) return false

  const scrollScope = scroll.provides.value
  const viewportScope = viewportCapability.value?.forDocument(props.documentId)
  if (!scrollScope || !viewportScope) return false

  spread.provides.value?.setSpreadMode(resolvePreferredSpreadMode())
  applyZoomValue(String(state.scaleValue || '').trim() || resolvePreferredZoomValue())

  await nextTick()
  if (currentRevision !== restoreRevision) return false

  if (typeof window !== 'undefined') {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  }

  if (currentRevision !== restoreRevision) return false

  const pageNumber = Math.max(1, Number(state.pageNumber || 1))
  scrollScope.scrollToPage({
    pageNumber,
    behavior: 'instant',
  })

  await nextTick()
  if (currentRevision !== restoreRevision) return false

  if (typeof window !== 'undefined') {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()))
  }

  if (currentRevision !== restoreRevision) return false

  const pageElement = pageElements.get(pageNumber)
  const pageTop = Number(pageElement?.offsetTop || 0)
  const pageHeight = Number(pageElement?.offsetHeight || 0)
  const pageScrollRatio = Number(state.pageScrollRatio)
  const scrollLeft = Number(state.scrollLeft)
  const nextScrollTop =
    Number.isFinite(pageScrollRatio) && Number.isFinite(pageHeight) && pageHeight > 0
      ? pageTop + pageHeight * clamp(pageScrollRatio, 0, 1)
      : viewportScope.getMetrics().scrollTop

  viewportScope.scrollTo({
    x: Number.isFinite(scrollLeft) ? scrollLeft : 0,
    y: nextScrollTop,
    behavior: 'instant',
  })

  await nextTick()
  if (currentRevision !== restoreRevision) return false

  scheduleViewStateEmission()
  initialLayoutHandled.value = true
  emit('restore-state-consumed')
  return true
}

watch(
  () => props.restoreState,
  (nextState) => {
    pendingRestoreState.value = nextState ? { ...nextState } : null
  },
  { immediate: true }
)

watch(
  () => [props.pdfViewerZoomMode, props.pdfViewerSpreadMode, props.pdfViewerLastScale],
  () => {
    if (pendingRestoreState.value) return
    applyViewerPreferences()
    scheduleViewStateEmission()
  }
)

watch(
  () => resolveScaleValueFromZoomState(),
  (nextScaleValue) => {
    const normalizedScaleValue = normalizeWorkspacePdfViewerLastScale(nextScaleValue)
    if (normalizedScaleValue && workspace.pdfViewerLastScale !== normalizedScaleValue) {
      void workspace.setPdfViewerLastScale(normalizedScaleValue).catch(() => {})
    }
    scheduleViewStateEmission()
  }
)

watch(
  () => scroll.state.value?.currentPage,
  () => {
    scheduleViewStateEmission()
  }
)

watch(
  () => spread.spreadMode.value,
  () => {
    scheduleViewStateEmission()
  }
)

watch(
  () => props.documentId,
  () => {
    pageElements.clear()
    initialLayoutHandled.value = false
    scheduleViewStateEmission()
  }
)

watch(
  [scrollCapability, () => props.documentId],
  ([capability, documentId], _, onCleanup) => {
    if (!capability || !documentId) return

    const unsubscribeLayoutReady = capability.onLayoutReady((event) => {
      if (event.documentId !== documentId) return

      if (pendingRestoreState.value) {
        void restoreViewState(pendingRestoreState.value)
        return
      }

      if (!initialLayoutHandled.value) {
        applyViewerPreferences()
        initialLayoutHandled.value = true
      }
      scheduleViewStateEmission()
    })

    const unsubscribeScroll = capability.onScroll((event) => {
      if (event.documentId !== documentId) return
      scheduleViewStateEmission()
    })

    onCleanup(() => {
      unsubscribeLayoutReady?.()
      unsubscribeScroll?.()
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  pageElements.clear()
  if (scheduledViewStateFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(scheduledViewStateFrame)
    scheduledViewStateFrame = 0
  }
})
</script>

<style scoped>
.pdf-artifact-preview__viewport {
  width: 100%;
  height: 100%;
  background: var(--embedpdf-surface);
}

.pdf-artifact-preview__page {
  margin: 12px auto;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.16);
  background: var(--embedpdf-page);
}
</style>
