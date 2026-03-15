<template>
  <div class="h-full flex flex-col overflow-hidden">
    <Teleport :to="toolbarTargetSelector || 'body'" :disabled="!toolbarTargetSelector">
      <div v-if="!error" class="pdf-toolbar-wrap" :class="{ 'pdf-toolbar-wrap-embedded': !!toolbarTargetSelector }">
        <div class="pdf-toolbar">
          <div class="pdf-toolbar-left">
            <div class="pdf-toolbar-group">
              <button
                class="pdf-toolbar-btn"
                :class="{ 'pdf-toolbar-btn-active': pdfUi.sidebarOpen }"
                :disabled="!pdfUi.ready || !sidebarAvailable"
                :title="t('Toggle sidebar')"
                @click="toggleSidebar"
              >
                <component :is="sidebarIcon" :size="14" :stroke-width="1.6" />
              </button>
            </div>

            <div class="pdf-toolbar-separator"></div>

            <div class="pdf-toolbar-group">
              <button
                class="pdf-toolbar-btn"
                :disabled="!pdfUi.ready || !pdfUi.canGoPrevious"
                :title="t('Previous page')"
                @click="goPreviousPage"
              >
                <IconChevronUp :size="13" :stroke-width="1.8" />
              </button>
              <button
                class="pdf-toolbar-btn"
                :disabled="!pdfUi.ready || !pdfUi.canGoNext"
                :title="t('Next page')"
                @click="goNextPage"
              >
                <IconChevronDown :size="13" :stroke-width="1.8" />
              </button>
              <div class="pdf-page-indicator">
                <input
                  ref="pageInputRef"
                  v-model="pageInput"
                  class="pdf-toolbar-input pdf-page-input"
                  type="text"
                  inputmode="numeric"
                  spellcheck="false"
                  :disabled="!pdfUi.ready"
                  @keydown.enter.prevent="commitPageNumber"
                  @blur="commitPageNumber"
                />
                <span class="pdf-toolbar-label">/ {{ pdfUi.pagesCount || 0 }}</span>
              </div>
            </div>
          </div>

          <div class="pdf-toolbar-center">
            <div class="pdf-toolbar-group pdf-toolbar-group-scale">
              <button
                class="pdf-toolbar-btn"
                :disabled="!pdfUi.ready || !pdfUi.canZoomOut"
                :title="t('Zoom out')"
                @click="zoomOut"
              >
                <IconMinus :size="13" :stroke-width="1.8" />
              </button>
              <button
                class="pdf-toolbar-btn"
                :disabled="!pdfUi.ready || !pdfUi.canZoomIn"
                :title="t('Zoom in')"
                @click="zoomIn"
              >
                <IconPlus :size="13" :stroke-width="1.8" />
              </button>
              <select
                v-model="pdfUi.scaleValue"
                class="pdf-toolbar-select"
                :disabled="!pdfUi.ready || scaleOptions.length === 0"
                @change="applyScale"
              >
                <option
                  v-for="option in scaleOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </div>

          <div class="pdf-toolbar-right">
            <div class="pdf-toolbar-group pdf-toolbar-group-translate">
              <span
                v-if="translateStatus"
                class="pdf-translate-status"
                :title="translateTask?.message || ''"
                :style="{ color: translateStatusColor }"
              >
                {{ translateStatus }}
              </span>
              <button
                class="pdf-translate-btn"
                :disabled="translateTask?.status === 'running'"
                :style="{ color: translateTask?.status === 'failed' ? 'var(--error)' : 'var(--accent)' }"
                :title="t('Translate this PDF')"
                @click="translatePdf"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M2.5 3.5h11v9h-11z"/>
                  <path d="M5 6.5h1.5M5 9h4"/>
                  <path d="M9.5 5.75l2 4.5M10 9.25h3"/>
                </svg>
                <span>{{ translateTask?.status === 'running' ? t('Translating...') : t('Translate') }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="relative flex-1 overflow-hidden">
      <div class="pdf-reader-shell">
        <div class="pdf-stage-shell">
          <div
            ref="viewerContainerRef"
            class="pdf-stage altals-pdf-stage"
            @dblclick="handleViewerDoubleClick"
          >
            <div ref="viewerRef" class="pdfViewer"></div>
          </div>
        </div>

        <Transition name="pdf-sidebar-overlay">
          <aside
            v-if="pdfUi.sidebarOpen"
            class="pdf-sidebar-shell"
          >
            <div class="pdf-sidebar-header">
              <button
                type="button"
                class="pdf-sidebar-tab"
                :class="{ 'pdf-sidebar-tab-active': pdfUi.sidebarMode === 'outline' }"
                :disabled="!pdfUi.outlineSupported && !outlineLoading"
                @click="selectSidebarMode('outline')"
              >
                {{ t('Outline') }}
              </button>
              <button
                type="button"
                class="pdf-sidebar-tab"
                :class="{ 'pdf-sidebar-tab-active': pdfUi.sidebarMode === 'pages' }"
                :disabled="!pdfUi.pagesSupported"
                @click="selectSidebarMode('pages')"
              >
                {{ t('Page View') }}
              </button>
            </div>

            <div
              v-if="pdfUi.sidebarMode === 'outline'"
              class="pdf-outline-list"
            >
              <div
                v-if="outlineLoading"
                class="pdf-outline-empty"
              >
                {{ t('Loading PDF...') }}
              </div>
              <div
                v-else-if="outlineItems.length === 0"
                class="pdf-outline-empty"
              >
                {{ t('No outline') }}
              </div>
              <button
                v-for="item in outlineItems"
                :key="item.id"
                type="button"
                class="pdf-outline-item"
                :style="{
                  paddingLeft: `${12 + item.depth * 14}px`,
                  fontWeight: item.bold ? 600 : 500,
                  fontStyle: item.italic ? 'italic' : 'normal',
                }"
                :title="item.title"
                @click="activateOutlineItem(item)"
              >
                <span class="pdf-outline-item-title">{{ item.title }}</span>
              </button>
            </div>

            <div
              v-else
              ref="sidebarScrollRef"
              class="pdf-page-list"
            >
              <button
                v-for="thumbnail in pageThumbnails"
                :key="thumbnail.pageNumber"
                :ref="el => setThumbnailItemRef(thumbnail.pageNumber, el)"
                type="button"
                class="pdf-page-item"
                :class="{ 'pdf-page-item-active': thumbnail.pageNumber === pdfUi.pageNumber }"
                :data-page-number="thumbnail.pageNumber"
                :title="t('Page {page}', { page: thumbnail.pageNumber })"
                @click="activatePageThumbnail(thumbnail.pageNumber)"
              >
                <div
                  class="pdf-page-thumb"
                  :style="thumbnailPreviewStyle(thumbnail)"
                >
                  <img
                    v-if="thumbnail.imageSrc"
                    class="pdf-page-thumb-image"
                    :src="thumbnail.imageSrc"
                    :alt="t('Page {page}', { page: thumbnail.pageNumber })"
                  />
                  <div
                    v-else-if="thumbnail.status === 'error'"
                    class="pdf-page-thumb-fallback"
                  >
                    {{ t('Preview unavailable') }}
                  </div>
                  <div
                    v-else
                    class="pdf-page-thumb-skeleton"
                  ></div>
                </div>
                <div class="pdf-page-label">{{ t('Page {page}', { page: thumbnail.pageNumber }) }}</div>
              </button>
            </div>
          </aside>
        </Transition>
      </div>

      <div
        v-if="loading"
        class="absolute inset-0 flex items-center justify-center text-sm"
        style="color: var(--fg-muted); background: var(--bg-primary);"
      >
        {{ t('Loading PDF...') }}
      </div>
      <div
        v-else-if="error"
        class="absolute inset-0 flex items-center justify-center px-6 text-sm"
        style="color: var(--fg-muted); background: var(--bg-primary);"
      >
        <div class="max-w-xl text-center">
          <div>{{ t('Could not load PDF') }}</div>
          <div v-if="error" class="mt-2 text-xs" style="word-break: break-word;">{{ error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, defineExpose, defineEmits, nextTick, shallowRef } from 'vue'
import {
  IconChevronDown,
  IconChevronUp,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMinus,
  IconPlus,
} from '@tabler/icons-vue'
import { invoke } from '@tauri-apps/api/core'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { EventBus, PDFLinkService, PDFViewer } from 'pdfjs-dist/legacy/web/pdf_viewer.mjs'
import 'pdfjs-dist/legacy/web/pdf_viewer.css'
import { useI18n } from '../../i18n'
import { usePdfTranslateStore } from '../../stores/pdfTranslate'
import { useToastStore } from '../../stores/toast'
import { useWorkspaceStore } from '../../stores/workspace'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href

const emit = defineEmits(['dblclick-page'])

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
  toolbarTargetSelector: { type: String, default: '' },
})

const PDF_SCALE_PRESETS = [
  'auto',
  'page-width',
  'page-fit',
  'page-actual',
  '0.5',
  '0.75',
  '1',
  '1.25',
  '1.5',
  '2',
  '3',
]
const MIN_SCALE = 0.3
const MAX_SCALE = 5
const DEFAULT_PAGE_THUMB_ASPECT_RATIO = 1 / Math.SQRT2
const PAGE_THUMBNAIL_TARGET_WIDTH = 132
const PAGE_THUMBNAIL_CONCURRENCY = 2
const PAGE_THUMBNAIL_NEARBY_RANGE = 1

const workspace = useWorkspaceStore()
const pdfTranslateStore = usePdfTranslateStore()
const toastStore = useToastStore()
const { t } = useI18n()

const viewerContainerRef = ref(null)
const viewerRef = ref(null)
const sidebarScrollRef = ref(null)
const pageInputRef = ref(null)
const pageInput = ref('1')
const loading = ref(true)
const error = ref(null)
const pdfSession = shallowRef(null)
const outlineItems = ref([])
const outlineLoading = ref(false)
const outlineResolved = ref(false)
const pageThumbnails = ref([])

const pdfUi = reactive({
  ready: false,
  pageNumber: 1,
  pagesCount: 0,
  canGoPrevious: false,
  canGoNext: false,
  canZoomOut: false,
  canZoomIn: false,
  scaleValue: 'page-width',
  scaleLabel: '',
  sidebarOpen: false,
  sidebarMode: 'outline',
  sidebarSupported: false,
  outlineSupported: false,
  pagesSupported: false,
})

let loadRequestId = 0
let resizeObserver = null
let thumbnailObserver = null
let thumbnailQueue = []
const thumbnailQueuedPages = new Set()
const thumbnailRenderingPages = new Set()
const thumbnailItemElements = new Map()

const sidebarIcon = computed(() => (
  pdfUi.sidebarOpen ? IconLayoutSidebarLeftCollapse : IconLayoutSidebarLeftExpand
))
const sidebarAvailable = computed(() => (
  pdfUi.sidebarSupported || outlineLoading.value
))
const translateTask = computed(() => (
  props.filePath ? pdfTranslateStore.latestTaskForInput(props.filePath) : null
))
const translateStatus = computed(() => {
  const task = translateTask.value
  if (!task) return ''
  if (task.status === 'running') {
    const pct = Number.isFinite(task.progress) ? Math.round(task.progress) : 0
    return `${pct}%`
  }
  if (task.status === 'completed') return t('Ready')
  if (task.status === 'failed') return t('Failed')
  if (task.status === 'canceled') return t('Canceled')
  return ''
})
const translateStatusColor = computed(() => {
  const status = translateTask.value?.status
  if (status === 'completed') return 'var(--success, #4ade80)'
  if (status === 'failed') return 'var(--error)'
  if (status === 'running') return 'var(--accent)'
  return 'var(--fg-muted)'
})
const scaleOptions = computed(() => {
  const options = PDF_SCALE_PRESETS.map((value) => ({
    value,
    label: localizeScaleLabel(value),
  }))
  const currentValue = String(pdfUi.scaleValue || '').trim()
  if (!currentValue || options.some(option => option.value === currentValue)) {
    return options
  }
  return [
    ...options,
    {
      value: currentValue,
      label: localizeScaleLabel(currentValue, getPdfViewer()?.currentScale || 1),
    },
  ]
})

function getPdfViewer() {
  return pdfSession.value?.pdfViewer || null
}

function getPdfLinkService() {
  return pdfSession.value?.linkService || null
}

function localizeScaleLabel(value, numericScale = null) {
  switch (String(value || '').trim()) {
    case 'auto':
      return t('Automatic Zoom')
    case 'page-width':
      return t('Page Width')
    case 'page-fit':
      return t('Page Fit')
    case 'page-actual':
      return t('Actual Size')
    default: {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) {
        const percent = Math.round((numericScale ?? parsed) * 100)
        return `${percent}%`
      }
      return String(value || '')
    }
  }
}

function resetPdfUi() {
  pdfUi.ready = false
  pdfUi.pageNumber = 1
  pdfUi.pagesCount = 0
  pdfUi.canGoPrevious = false
  pdfUi.canGoNext = false
  pdfUi.canZoomOut = false
  pdfUi.canZoomIn = false
  pdfUi.scaleValue = 'page-width'
  pdfUi.scaleLabel = t('Page Width')
  pdfUi.sidebarOpen = false
  pdfUi.sidebarMode = 'outline'
  pdfUi.sidebarSupported = false
  pdfUi.outlineSupported = false
  pdfUi.pagesSupported = false
  pageInput.value = '1'
  outlineItems.value = []
  outlineLoading.value = false
  outlineResolved.value = false
  resetPageThumbnails()
}

function syncPdfUi() {
  const viewer = getPdfViewer()
  const session = pdfSession.value
  if (!viewer || !session?.pdfDocument) {
    pdfUi.ready = false
    return
  }

  const pageNumber = Number(viewer.currentPageNumber || 1)
  const pagesCount = Number(viewer.pagesCount || session.pdfDocument.numPages || 0)
  const currentScale = Number(viewer.currentScale || 1)
  const currentScaleValue = String(viewer.currentScaleValue || pdfUi.scaleValue || 'page-width')

  pdfUi.ready = true
  pdfUi.pageNumber = pageNumber
  pdfUi.pagesCount = pagesCount
  pdfUi.canGoPrevious = pageNumber > 1
  pdfUi.canGoNext = pageNumber < pagesCount
  pdfUi.canZoomOut = currentScale > MIN_SCALE
  pdfUi.canZoomIn = currentScale < MAX_SCALE
  pdfUi.scaleValue = currentScaleValue
  pdfUi.scaleLabel = localizeScaleLabel(currentScaleValue, currentScale)
  pdfUi.pagesSupported = pagesCount > 0

  if (pageThumbnails.value.length !== pagesCount) {
    initializePageThumbnails(pagesCount)
  }
  syncSidebarSupport()

  if (document.activeElement !== pageInputRef.value) {
    pageInput.value = String(pageNumber || 1)
  }
}

function syncSidebarSupport() {
  pdfUi.sidebarSupported = pdfUi.pagesSupported || pdfUi.outlineSupported
  if (!pdfUi.sidebarSupported && !outlineLoading.value) {
    pdfUi.sidebarOpen = false
  }
  if (outlineResolved.value && !pdfUi.outlineSupported && pdfUi.pagesSupported && pdfUi.sidebarMode === 'outline') {
    pdfUi.sidebarMode = 'pages'
  }
  if (!pdfUi.pagesSupported && pdfUi.sidebarMode === 'pages') {
    pdfUi.sidebarMode = 'outline'
  }
}

function initializePageThumbnails(totalPages) {
  const count = Math.max(0, Number(totalPages || 0))
  pageThumbnails.value = Array.from({ length: count }, (_, index) => ({
    pageNumber: index + 1,
    status: 'idle',
    imageSrc: '',
    aspectRatio: DEFAULT_PAGE_THUMB_ASPECT_RATIO,
  }))
}

function resetPageThumbnails() {
  disconnectThumbnailObserver()
  thumbnailQueue = []
  thumbnailQueuedPages.clear()
  thumbnailRenderingPages.clear()
  thumbnailItemElements.clear()
  pageThumbnails.value = []
}

function disconnectThumbnailObserver() {
  if (!thumbnailObserver) return
  thumbnailObserver.disconnect()
  thumbnailObserver = null
}

function updatePageThumbnail(pageNumber, patch) {
  const index = Number(pageNumber) - 1
  const current = pageThumbnails.value[index]
  if (!current) return
  pageThumbnails.value[index] = {
    ...current,
    ...patch,
  }
}

function queueThumbnailWindow(pageNumber) {
  const center = Number(pageNumber)
  if (!Number.isInteger(center) || center < 1) return
  const start = Math.max(1, center - PAGE_THUMBNAIL_NEARBY_RANGE)
  const end = Math.min(pageThumbnails.value.length, center + PAGE_THUMBNAIL_NEARBY_RANGE)
  for (let page = start; page <= end; page += 1) {
    enqueueThumbnail(page)
  }
}

function enqueueThumbnail(pageNumber) {
  const page = Number(pageNumber)
  const thumbnail = pageThumbnails.value[page - 1]
  if (!thumbnail) return
  if (thumbnail.status === 'ready' || thumbnail.status === 'loading') return
  if (thumbnailQueuedPages.has(page) || thumbnailRenderingPages.has(page)) return
  thumbnailQueuedPages.add(page)
  thumbnailQueue.push(page)
  processThumbnailQueue()
}

function processThumbnailQueue() {
  while (thumbnailRenderingPages.size < PAGE_THUMBNAIL_CONCURRENCY && thumbnailQueue.length > 0) {
    const pageNumber = thumbnailQueue.shift()
    thumbnailQueuedPages.delete(pageNumber)
    const thumbnail = pageThumbnails.value[pageNumber - 1]
    if (!thumbnail || thumbnail.status === 'ready' || thumbnail.status === 'loading') continue
    thumbnailRenderingPages.add(pageNumber)
    updatePageThumbnail(pageNumber, { status: 'loading' })

    const requestId = loadRequestId
    void renderPageThumbnail(pageNumber, requestId).finally(() => {
      thumbnailRenderingPages.delete(pageNumber)
      processThumbnailQueue()
    })
  }
}

async function renderPageThumbnail(pageNumber, requestId) {
  const session = pdfSession.value
  const pdfDocument = session?.pdfDocument
  if (!pdfDocument || requestId !== loadRequestId) return

  let page = null
  try {
    page = await pdfDocument.getPage(pageNumber)
    if (requestId !== loadRequestId || session !== pdfSession.value) return

    const baseViewport = page.getViewport({ scale: 1 })
    const scale = PAGE_THUMBNAIL_TARGET_WIDTH / Math.max(baseViewport.width || 1, 1)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) {
      throw new Error('Canvas 2D context unavailable')
    }

    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))

    const renderTask = page.render({
      canvasContext: context,
      viewport,
      background: 'rgb(255,255,255)',
    })
    await renderTask.promise
    if (requestId !== loadRequestId || session !== pdfSession.value) return

    updatePageThumbnail(pageNumber, {
      status: 'ready',
      imageSrc: canvas.toDataURL('image/png'),
      aspectRatio: canvas.width / Math.max(canvas.height, 1),
    })
  } catch (thumbnailError) {
    if (requestId !== loadRequestId || session !== pdfSession.value) return
    console.warn('[pdf] failed to render page thumbnail:', thumbnailError)
    updatePageThumbnail(pageNumber, { status: 'error' })
  } finally {
    try {
      page?.cleanup?.()
    } catch {}
  }
}

function connectThumbnailObserver() {
  disconnectThumbnailObserver()

  if (!sidebarScrollRef.value || pageThumbnails.value.length === 0) return
  if (typeof IntersectionObserver !== 'function') {
    queueThumbnailWindow(pdfUi.pageNumber || 1)
    return
  }

  thumbnailObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      const pageNumber = Number(entry.target?.dataset?.pageNumber || 0)
      if (!Number.isInteger(pageNumber) || pageNumber < 1) return
      queueThumbnailWindow(pageNumber)
    })
  }, {
    root: sidebarScrollRef.value,
    rootMargin: '160px 0px 160px 0px',
    threshold: 0.01,
  })

  thumbnailItemElements.forEach((element) => {
    thumbnailObserver?.observe(element)
  })
  queueThumbnailWindow(pdfUi.pageNumber || 1)
}

function setThumbnailItemRef(pageNumber, element) {
  const key = Number(pageNumber)
  const previous = thumbnailItemElements.get(key)
  if (previous && thumbnailObserver) {
    thumbnailObserver.unobserve(previous)
  }

  if (element) {
    thumbnailItemElements.set(key, element)
    if (thumbnailObserver) {
      thumbnailObserver.observe(element)
    }
    return
  }

  thumbnailItemElements.delete(key)
}

function thumbnailPreviewStyle(thumbnail) {
  const ratio = Number(thumbnail?.aspectRatio)
  return {
    aspectRatio: String(Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_PAGE_THUMB_ASPECT_RATIO),
  }
}

function scrollCurrentThumbnailIntoView() {
  if (!pdfUi.sidebarOpen || pdfUi.sidebarMode !== 'pages') return
  const element = thumbnailItemElements.get(Number(pdfUi.pageNumber))
  if (!element) return
  window.requestAnimationFrame(() => {
    element.scrollIntoView({ block: 'nearest' })
  })
}

function attachViewerListeners(session, requestId) {
  const { eventBus, pdfViewer } = session

  eventBus.on('pagesinit', () => {
    if (requestId !== loadRequestId) return
    pdfViewer.currentScaleValue = pdfUi.scaleValue || 'page-width'
    syncPdfUi()
  })

  eventBus.on('pagerendered', () => {
    if (requestId !== loadRequestId) return
    loading.value = false
    syncPdfUi()
  }, { once: true })

  eventBus.on('pagesloaded', () => {
    if (requestId !== loadRequestId) return
    syncPdfUi()
  })

  eventBus.on('pagechanging', () => {
    if (requestId !== loadRequestId) return
    syncPdfUi()
  })

  eventBus.on('scalechanging', () => {
    if (requestId !== loadRequestId) return
    syncPdfUi()
  })
}

async function cleanupPdfSession() {
  const session = pdfSession.value
  pdfSession.value = null

  if (viewerRef.value) {
    viewerRef.value.replaceChildren()
  }

  if (!session) return

  try {
    session.abortController?.abort()
  } catch {}

  try {
    session.linkService?.setDocument(null, null)
  } catch {}

  try {
    session.pdfViewer?.setDocument(null)
    session.pdfViewer?.cleanup?.()
  } catch {}

  try {
    await session.loadingTask?.destroy?.()
  } catch {}
}

async function buildViewerSession(requestId, bytes) {
  await nextTick()
  if (requestId !== loadRequestId || !viewerContainerRef.value || !viewerRef.value) return null

  const eventBus = new EventBus()
  const linkService = new PDFLinkService({ eventBus })
  const abortController = new AbortController()
  const pdfViewer = new PDFViewer({
    container: viewerContainerRef.value,
    viewer: viewerRef.value,
    eventBus,
    linkService,
    removePageBorders: true,
    abortSignal: abortController.signal,
  })

  linkService.setViewer(pdfViewer)

  const loadingTask = pdfjsLib.getDocument({ data: bytes })
  const session = {
    requestId,
    eventBus,
    linkService,
    pdfViewer,
    loadingTask,
    abortController,
    pdfDocument: null,
  }
  pdfSession.value = session
  attachViewerListeners(session, requestId)
  return session
}

function normalizeOutlineTitle(title) {
  const normalized = String(title || '').replace(/\u0000/g, '').trim()
  return normalized || '-'
}

function flattenOutline(items, depth = 0, path = '', acc = []) {
  if (!Array.isArray(items)) return acc

  items.forEach((item, index) => {
    const id = path ? `${path}.${index}` : String(index)
    acc.push({
      id,
      depth,
      title: normalizeOutlineTitle(item?.title),
      dest: item?.dest ?? null,
      url: item?.url ?? '',
      bold: !!item?.bold,
      italic: !!item?.italic,
    })
    if (Array.isArray(item?.items) && item.items.length > 0) {
      flattenOutline(item.items, depth + 1, id, acc)
    }
  })

  return acc
}

async function loadOutline(session, requestId) {
  outlineResolved.value = false
  outlineLoading.value = true
  pdfUi.outlineSupported = false
  syncSidebarSupport()

  try {
    const outline = await session.pdfDocument?.getOutline?.()
    if (requestId !== loadRequestId || session !== pdfSession.value) return

    const nextOutlineItems = flattenOutline(outline)
    outlineItems.value = nextOutlineItems
    pdfUi.outlineSupported = nextOutlineItems.length > 0
  } catch (outlineError) {
    if (requestId !== loadRequestId || session !== pdfSession.value) return
    console.warn('[pdf] failed to load outline:', outlineError)
    outlineItems.value = []
    pdfUi.outlineSupported = false
  } finally {
    if (requestId === loadRequestId) {
      outlineLoading.value = false
      outlineResolved.value = true
      syncSidebarSupport()
    }
  }
}

async function loadPdf() {
  const requestId = ++loadRequestId
  loading.value = true
  error.value = null
  resetPdfUi()
  await cleanupPdfSession()

  try {
    const rawBytes = await invoke('read_file_binary', { path: props.filePath })
    if (requestId !== loadRequestId) return
    const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes)
    const session = await buildViewerSession(requestId, bytes)
    if (!session || requestId !== loadRequestId) return

    const pdfDocument = await session.loadingTask.promise
    if (requestId !== loadRequestId) {
      await session.loadingTask.destroy().catch(() => {})
      return
    }

    session.pdfDocument = pdfDocument
    session.linkService.setDocument(pdfDocument, null)
    await session.pdfViewer.setDocument(pdfDocument)
    syncPdfUi()
    void loadOutline(session, requestId)
  } catch (e) {
    if (requestId !== loadRequestId) return
    console.error('[pdf] failed to load document:', e)
    error.value = e?.message || String(e)
    loading.value = false
    await cleanupPdfSession()
  }
}

function selectSidebarMode(mode) {
  if (mode === 'outline' && !pdfUi.outlineSupported && !outlineLoading.value) return
  if (mode === 'pages' && !pdfUi.pagesSupported) return
  pdfUi.sidebarMode = mode
}

function toggleSidebar() {
  if (!sidebarAvailable.value) return
  pdfUi.sidebarOpen = !pdfUi.sidebarOpen
}

async function activateOutlineItem(item) {
  if (!item) return

  if (item.url) {
    const { open } = await import('@tauri-apps/plugin-shell')
    open(item.url).catch(() => {})
    return
  }

  if (item.dest == null) return

  const linkService = getPdfLinkService()
  if (!linkService?.goToDestination) return

  await linkService.goToDestination(item.dest)
  syncPdfUi()
}

function activatePageThumbnail(pageNumber) {
  scrollToPage(pageNumber)
  scrollCurrentThumbnailIntoView()
}

function goPreviousPage() {
  const viewer = getPdfViewer()
  if (!viewer || !pdfUi.canGoPrevious) return
  viewer.currentPageNumber = Math.max(1, pdfUi.pageNumber - 1)
  syncPdfUi()
}

function goNextPage() {
  const viewer = getPdfViewer()
  if (!viewer || !pdfUi.canGoNext) return
  viewer.currentPageNumber = Math.min(pdfUi.pagesCount, pdfUi.pageNumber + 1)
  syncPdfUi()
}

function commitPageNumber() {
  const viewer = getPdfViewer()
  const nextPage = Number(pageInput.value)
  if (!viewer || !Number.isInteger(nextPage) || nextPage < 1 || nextPage > pdfUi.pagesCount) {
    pageInput.value = String(pdfUi.pageNumber || 1)
    return
  }
  viewer.currentPageNumber = nextPage
  syncPdfUi()
}

function zoomOut() {
  const viewer = getPdfViewer()
  if (!viewer) return
  viewer.currentScale = Math.max(MIN_SCALE, Number(viewer.currentScale || 1) / 1.1)
  syncPdfUi()
}

function zoomIn() {
  const viewer = getPdfViewer()
  if (!viewer) return
  viewer.currentScale = Math.min(MAX_SCALE, Number(viewer.currentScale || 1) * 1.1)
  syncPdfUi()
}

function applyScale() {
  const viewer = getPdfViewer()
  if (!viewer) return
  viewer.currentScaleValue = pdfUi.scaleValue
  syncPdfUi()
}

async function translatePdf() {
  if (!props.filePath || translateTask.value?.status === 'running') return

  try {
    await pdfTranslateStore.startTranslation(props.filePath)
    const name = props.filePath.split('/').pop()
    toastStore.show(t('Started translating {name}', { name }), {
      type: 'success',
      duration: 2500,
    })
  } catch (translateError) {
    const message = translateError?.message || String(translateError)
    toastStore.show(message, { type: 'error', duration: 5000 })
    workspace.openSettings('pdf-translate')
  }
}

function handleViewerDoubleClick(event) {
  const pageElement = event.target?.closest?.('.page[data-page-number]')
  if (!pageElement) return

  const rect = pageElement.getBoundingClientRect()
  emit('dblclick-page', {
    page: Number(pageElement.dataset.pageNumber || 0),
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  })
}

function scrollToPage(pageNumber) {
  const targetPage = Number(pageNumber)
  if (!Number.isInteger(targetPage) || targetPage < 1) return
  const linkService = getPdfLinkService()
  if (linkService?.goToPage) {
    linkService.goToPage(targetPage)
    syncPdfUi()
  }
}

function scrollToLocation(pageNumber, x, y) {
  const targetPage = Number(pageNumber)
  if (!Number.isInteger(targetPage) || targetPage < 1) return

  const viewer = getPdfViewer()
  if (!viewer?.scrollPageIntoView) {
    scrollToPage(targetPage)
    return
  }

  const xCoord = Number(x)
  const yCoord = Number(y)
  const destArray = [
    null,
    { name: 'XYZ' },
    Number.isFinite(xCoord) ? xCoord : null,
    Number.isFinite(yCoord) ? yCoord : null,
    null,
  ]
  viewer.scrollPageIntoView({
    pageNumber: targetPage,
    destArray,
    allowNegativeOffset: true,
    ignoreDestinationZoom: true,
  })
  syncPdfUi()
}

function handlePdfUpdated(event) {
  if (event.detail?.path === props.filePath) {
    loadPdf()
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    const viewer = getPdfViewer()
    const scaleValue = String(pdfUi.scaleValue || viewer?.currentScaleValue || '').trim()
    if (!viewer || !scaleValue) return
    if (scaleValue !== 'auto' && scaleValue !== 'page-width' && scaleValue !== 'page-fit') return
    window.requestAnimationFrame(() => {
      const latestViewer = getPdfViewer()
      if (!latestViewer) return
      latestViewer.currentScaleValue = scaleValue
      syncPdfUi()
    })
  })
  if (viewerContainerRef.value) {
    resizeObserver.observe(viewerContainerRef.value)
  }
  window.addEventListener('pdf-updated', handlePdfUpdated)
  loadPdf()
})

onUnmounted(async () => {
  loadRequestId += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  disconnectThumbnailObserver()
  window.removeEventListener('pdf-updated', handlePdfUpdated)
  await cleanupPdfSession()
})

watch(() => props.filePath, () => {
  loadPdf()
})

watch(
  () => [pdfUi.sidebarOpen, pdfUi.sidebarMode, pageThumbnails.value.length],
  async ([sidebarOpen, sidebarMode, thumbnailsCount]) => {
    if (!sidebarOpen || sidebarMode !== 'pages' || thumbnailsCount === 0) {
      disconnectThumbnailObserver()
      return
    }
    await nextTick()
    connectThumbnailObserver()
    scrollCurrentThumbnailIntoView()
  },
)

watch(() => pdfUi.pageNumber, (pageNumber) => {
  if (!pdfUi.sidebarOpen || pdfUi.sidebarMode !== 'pages') return
  queueThumbnailWindow(pageNumber)
  nextTick(() => {
    scrollCurrentThumbnailIntoView()
  })
})

defineExpose({
  scrollToPage,
  scrollToLocation,
})
</script>

<style scoped>
.pdf-toolbar-wrap {
  flex: none;
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  overflow: visible;
}

.pdf-toolbar-wrap-embedded {
  border-bottom: 0;
  border-top: 0;
  position: relative;
  z-index: 4;
}

.pdf-toolbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--document-header-row-height, 24px);
  box-sizing: border-box;
  padding: 0 6px;
  overflow-x: auto;
  overflow-y: visible;
  scrollbar-width: none;
}

.pdf-toolbar::-webkit-scrollbar {
  display: none;
}

.pdf-toolbar-left,
.pdf-toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 0;
}

.pdf-toolbar-right {
  justify-content: flex-end;
}

.pdf-toolbar-center {
  position: absolute;
  inset: 0 auto 0 50%;
  display: flex;
  align-items: center;
  transform: translateX(-50%);
  pointer-events: none;
}

.pdf-toolbar-center > * {
  pointer-events: auto;
}

.pdf-toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.pdf-toolbar-separator {
  width: 1px;
  height: 12px;
  flex: none;
  background: color-mix(in srgb, var(--border) 85%, transparent);
}

.pdf-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  padding: 0;
  transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}

.pdf-toolbar-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.pdf-toolbar-btn-active {
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}

.pdf-toolbar-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.pdf-toolbar-input,
.pdf-toolbar-select {
  height: 20px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--bg-secondary));
  color: var(--fg-primary);
  font-size: var(--ui-font-caption);
  line-height: 1;
  appearance: none;
}

.pdf-toolbar-input {
  padding: 0 8px;
}

.pdf-toolbar-select {
  min-width: 120px;
  padding: 0 24px 0 8px;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 11px) calc(50% - 1px), calc(100% - 7px) calc(50% - 1px);
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
}

.pdf-page-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pdf-page-input {
  width: 36px;
  text-align: center;
  font-size: var(--ui-font-caption);
  font-weight: 600;
}

.pdf-toolbar-label {
  color: var(--fg-primary);
  font-size: var(--ui-font-caption);
  white-space: nowrap;
}

.pdf-toolbar-group-translate {
  gap: 8px;
}

.pdf-toolbar-group-scale {
  gap: 6px;
}

.pdf-reader-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.pdf-sidebar-shell {
  display: flex;
  flex-direction: column;
  position: absolute;
  inset: 0 auto 0 0;
  width: 220px;
  min-width: 180px;
  max-width: 280px;
  border-right: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 94%, var(--bg-primary));
  box-shadow: 10px 0 28px rgba(0, 0, 0, 0.22);
  z-index: 8;
  backdrop-filter: blur(10px);
}

.pdf-sidebar-header {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  padding: 8px 10px 6px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
}

.pdf-sidebar-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--ui-font-caption);
  font-weight: 600;
  transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}

.pdf-sidebar-tab:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.pdf-sidebar-tab:disabled {
  opacity: 0.45;
  cursor: default;
}

.pdf-sidebar-tab-active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.pdf-outline-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 6px 0;
}

.pdf-outline-empty {
  padding: 12px;
  color: var(--fg-muted);
  font-size: var(--ui-font-caption);
}

.pdf-outline-item {
  display: block;
  width: 100%;
  padding-top: 5px;
  padding-bottom: 5px;
  padding-right: 12px;
  border: 0;
  background: transparent;
  color: var(--fg-primary);
  font-size: var(--ui-font-caption);
  line-height: 1.35;
  text-align: left;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.pdf-outline-item:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.pdf-outline-item-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pdf-page-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 10px 10px 12px;
}

.pdf-page-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 8px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--fg-primary);
  text-align: center;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
}

.pdf-page-item + .pdf-page-item {
  margin-top: 10px;
}

.pdf-page-item:hover {
  background: color-mix(in srgb, var(--bg-hover) 84%, transparent);
}

.pdf-page-item-active {
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.pdf-page-thumb {
  width: 100%;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background: #fff;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.12);
}

.pdf-page-thumb-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pdf-page-thumb-skeleton {
  width: 100%;
  height: 100%;
  min-height: 150px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.26) 50%, rgba(255, 255, 255, 0) 100%),
    color-mix(in srgb, var(--bg-tertiary, #d6d8df) 78%, white);
  background-size: 180px 100%, 100% 100%;
  background-repeat: no-repeat;
  animation: pdf-page-thumb-shimmer 1.2s linear infinite;
}

.pdf-page-thumb-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 150px;
  padding: 12px;
  color: var(--fg-muted);
  font-size: 11px;
  line-height: 1.35;
  background: color-mix(in srgb, var(--bg-secondary) 85%, white);
}

.pdf-page-label {
  color: var(--fg-muted);
  font-size: 11px;
  font-weight: 600;
}

.pdf-stage-shell {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.pdf-translate-status {
  color: var(--fg-muted);
  font-size: var(--ui-font-caption);
  white-space: nowrap;
}

.pdf-translate-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 20px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  font-size: var(--ui-font-caption);
  color: var(--accent);
}

.pdf-translate-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.pdf-translate-btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.pdf-stage {
  position: absolute;
  inset: 0;
  overflow: auto;
  background: var(--bg-primary);
}

.pdf-stage :deep(.pdfViewer) {
  position: relative;
  min-height: 100%;
}

.pdf-stage :deep(.pdfViewer.removePageBorders .page) {
  margin: 12px auto;
}

.pdf-stage :deep(.page) {
  box-shadow: none;
}

@keyframes pdf-page-thumb-shimmer {
  0% {
    background-position: -180px 0, 0 0;
  }
  100% {
    background-position: 180px 0, 0 0;
  }
}

.pdf-sidebar-overlay-enter-active,
.pdf-sidebar-overlay-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.pdf-sidebar-overlay-enter-from,
.pdf-sidebar-overlay-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
