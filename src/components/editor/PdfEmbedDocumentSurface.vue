<template>
  <div
    class="pdf-artifact-preview__surface"
    tabindex="0"
    data-surface-context-guard="true"
    @contextmenu.prevent="handleShellContextMenu"
    @keydown.capture="handleKeydown"
    @dblclick.capture="handleDoubleClick"
  >
    <div
      v-if="searchUiVisible"
      class="pdf-artifact-preview__toolbar"
      data-no-embedpdf-interaction="true"
    >
      <UiInput
        ref="searchInputRef"
        v-model="searchQuery"
        size="sm"
        shell-class="pdf-artifact-preview__search-input"
        :placeholder="t('Search in PDF')"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        spellcheck="false"
        @keydown.enter.prevent="handleSearchEnter"
        @keydown.escape.prevent="handleSearchEscape"
      >
        <template #prefix>
          <IconSearch :size="14" :stroke-width="1.8" />
        </template>
      </UiInput>

      <div class="pdf-artifact-preview__search-summary">
        {{ searchSummary }}
      </div>

      <div class="pdf-artifact-preview__toolbar-actions">
        <UiButton
          variant="ghost"
          size="sm"
          icon-only
          :disabled="!hasSearchResults"
          :title="t('Previous result')"
          :aria-label="t('Previous result')"
          @click="navigateSearch(-1)"
        >
          <IconChevronUp :size="14" :stroke-width="1.8" />
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          icon-only
          :disabled="!hasSearchResults"
          :title="t('Next result')"
          :aria-label="t('Next result')"
          @click="navigateSearch(1)"
        >
          <IconChevronDown :size="14" :stroke-width="1.8" />
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          :active="isMatchCaseEnabled"
          :title="t('Match case')"
          @click="toggleSearchFlag(MatchFlag.MatchCase)"
        >
          Aa
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          :active="isWholeWordEnabled"
          :title="t('Whole words')"
          @click="toggleSearchFlag(MatchFlag.MatchWholeWord)"
        >
          {{ t('Word') }}
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          :active="search.state.value.showAllResults"
          :disabled="!hasSearchResults"
          :title="t('Highlight all')"
          @click="toggleShowAllResults"
        >
          {{ t('All') }}
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          icon-only
          :title="t('Close search')"
          :aria-label="t('Close search')"
          @click="closeSearchUi"
        >
          <IconX :size="14" :stroke-width="1.8" />
        </UiButton>
      </div>
    </div>

    <Viewport :document-id="documentId" class="pdf-artifact-preview__viewport">
      <Scroller :document-id="documentId" v-slot="{ page }">
        <div
          :ref="(element) => setPageElement(page, element)"
          class="pdf-artifact-preview__page-shell"
          :data-page-number="page.pageNumber"
          :style="{ width: `${page.width}px`, height: `${page.height}px` }"
        >
          <PagePointerProvider
            :document-id="documentId"
            :page-index="page.pageIndex"
            class="pdf-artifact-preview__page"
          >
            <RenderLayer :document-id="documentId" :page-index="page.pageIndex" />
            <SearchLayer :document-id="documentId" :page-index="page.pageIndex" />
            <SelectionLayer
              :document-id="documentId"
              :page-index="page.pageIndex"
              :text-style="{ background: 'rgba(80, 132, 255, 0.28)' }"
              :marquee-style="{
                background: 'rgba(80, 132, 255, 0.16)',
                borderColor: 'rgba(80, 132, 255, 0.72)',
                borderStyle: 'solid',
              }"
            >
              <template #selection-menu="{ menuWrapperProps }">
                <div
                  v-bind="menuWrapperProps"
                  class="pdf-artifact-preview__selection-menu"
                  data-no-embedpdf-interaction="true"
                >
                  <UiButton variant="secondary" size="sm" @click.stop="copySelectedText">
                    {{ t('Copy') }}
                  </UiButton>
                </div>
              </template>
            </SelectionLayer>
          </PagePointerProvider>
        </div>
      </Scroller>
    </Viewport>

    <SurfaceContextMenu
      :visible="menuVisible"
      :x="menuX"
      :y="menuY"
      :groups="menuGroups"
      @close="closeSurfaceContextMenu"
      @select="handleSurfaceContextMenuSelect"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import { MatchFlag } from '@embedpdf/models'
import { writeText as writeClipboardText } from '@tauri-apps/plugin-clipboard-manager'
import { IconChevronDown, IconChevronUp, IconSearch, IconX } from '@tabler/icons-vue'
import { useExport } from '@embedpdf/plugin-export/vue'
import { PagePointerProvider } from '@embedpdf/plugin-interaction-manager/vue'
import { RenderLayer } from '@embedpdf/plugin-render/vue'
import { SearchLayer, useSearch } from '@embedpdf/plugin-search/vue'
import { Scroller, useScroll, useScrollCapability } from '@embedpdf/plugin-scroll/vue'
import { SelectionLayer, useSelectionCapability } from '@embedpdf/plugin-selection/vue'
import { SpreadMode, useSpread } from '@embedpdf/plugin-spread/vue'
import { Viewport, useViewportCapability } from '@embedpdf/plugin-viewport/vue'
import { ZoomMode, useZoom } from '@embedpdf/plugin-zoom/vue'

import { useI18n } from '../../i18n'
import { useSurfaceContextMenu } from '../../composables/useSurfaceContextMenu.js'
import { encodePdfArrayBufferToBase64 } from '../../services/pdf/embedPdfAdapter.js'
import { writePdfArtifactBase64 } from '../../services/pdf/artifactPreview.js'
import {
  normalizeWorkspacePdfViewerLastScale,
  normalizeWorkspacePdfViewerSpreadMode,
  normalizeWorkspacePdfViewerZoomMode,
} from '../../services/workspacePreferences.js'
import { useToastStore } from '../../stores/toast.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { basenamePath } from '../../utils/path.js'
import SurfaceContextMenu from '../shared/SurfaceContextMenu.vue'
import UiButton from '../shared/ui/UiButton.vue'
import UiInput from '../shared/ui/UiInput.vue'

const props = defineProps({
  documentId: { type: String, required: true },
  artifactPath: { type: String, required: true },
  kind: { type: String, default: 'pdf' },
  pdfViewerZoomMode: { type: String, default: 'page-width' },
  pdfViewerSpreadMode: { type: String, default: 'single' },
  pdfViewerLastScale: { type: String, default: '' },
  forwardSyncPoint: { type: Object, default: null },
  restoreState: { type: Object, default: null },
})

const emit = defineEmits([
  'open-external',
  'reverse-sync-request',
  'forward-sync-point-consumed',
  'reload-requested',
  'view-state-change',
  'restore-state-consumed',
])

const SEARCH_DEBOUNCE_MS = 140

const { t } = useI18n()
const workspace = useWorkspaceStore()
const toastStore = useToastStore()
const zoom = useZoom(() => props.documentId)
const spread = useSpread(() => props.documentId)
const scroll = useScroll(() => props.documentId)
const search = useSearch(() => props.documentId)
const exportScope = useExport(() => props.documentId)
const { provides: selectionCapability } = useSelectionCapability()
const { provides: scrollCapability } = useScrollCapability()
const { provides: viewportCapability } = useViewportCapability()
const {
  menuVisible,
  menuX,
  menuY,
  menuGroups,
  closeSurfaceContextMenu,
  openSurfaceContextMenu,
  handleSurfaceContextMenuSelect,
} = useSurfaceContextMenu()

const pageBindings = new Map()
const pendingRestoreState = ref(null)
const pendingForwardSyncPoint = ref(null)
const initialLayoutHandled = ref(false)
const saveInProgress = ref(false)
const selectedText = ref('')
const selectionActive = ref(false)
const searchUiVisible = ref(false)
const searchQuery = ref('')
const searchInputRef = ref(null)
const currentContextMenuReverseSyncDetail = ref(null)

let scheduledViewStateFrame = 0
let restoreRevision = 0
let searchDebounceTimer = 0
let suppressSearchWatch = false

const hasSearchResults = computed(() => Number(search.state.value?.total || 0) > 0)
const isMatchCaseEnabled = computed(() =>
  Array.isArray(search.state.value?.flags)
    && search.state.value.flags.includes(MatchFlag.MatchCase)
)
const isWholeWordEnabled = computed(() =>
  Array.isArray(search.state.value?.flags)
    && search.state.value.flags.includes(MatchFlag.MatchWholeWord)
)
const searchSummary = computed(() => {
  if (search.state.value?.loading) return t('Searching...')
  const total = Number(search.state.value?.total || 0)
  if (total < 1) return t('No results')
  const activeIndex = Number(search.state.value?.activeResultIndex ?? -1)
  return `${activeIndex + 1} / ${total}`
})

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function normalizeSelectedText(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || ''))
      .join('\n')
      .trim()
  }

  return String(value || '').trim()
}

function setPageElement(page, element) {
  const numericPageNumber = Number(page?.pageNumber || 0)
  if (!Number.isInteger(numericPageNumber) || numericPageNumber < 1) return
  if (element) {
    pageBindings.set(numericPageNumber, { element, page })
    return
  }
  pageBindings.delete(numericPageNumber)
}

function resolvePageBinding(pageNumber) {
  const numericPageNumber = Number(pageNumber || 0)
  if (!Number.isInteger(numericPageNumber) || numericPageNumber < 1) return null
  return pageBindings.get(numericPageNumber) || null
}

function resolveMouseClientPoint(event) {
  const clientX = Number(event?.clientX)
  const clientY = Number(event?.clientY)
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    return { clientX, clientY }
  }

  const pageX = Number(event?.pageX)
  const pageY = Number(event?.pageY)
  if (Number.isFinite(pageX) && Number.isFinite(pageY)) {
    return { clientX: pageX, clientY: pageY }
  }

  return null
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
  const pageElement = resolvePageBinding(pageNumber)?.element
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

function focusSearchInput(selectAll = false) {
  void nextTick(() => {
    if (selectAll) {
      searchInputRef.value?.select?.()
      return
    }
    searchInputRef.value?.focus?.()
  })
}

function openSearchUi(options = {}) {
  searchUiVisible.value = true
  focusSearchInput(options.selectAll === true)
}

function clearSearchDebounceTimer() {
  if (!searchDebounceTimer || typeof window === 'undefined') return
  window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = 0
}

function closeSearchUi() {
  clearSearchDebounceTimer()
  searchUiVisible.value = false
  suppressSearchWatch = true
  searchQuery.value = ''
  search.provides.value?.stopSearch?.()
}

function scheduleSearchExecution(query = searchQuery.value) {
  clearSearchDebounceTimer()

  if (typeof window === 'undefined') {
    void executeSearch(query)
    return
  }

  searchDebounceTimer = window.setTimeout(() => {
    searchDebounceTimer = 0
    void executeSearch(query)
  }, SEARCH_DEBOUNCE_MS)
}

async function executeSearch(query = searchQuery.value) {
  const searchScope = search.provides.value
  if (!searchScope) return

  try {
    await searchScope.searchAllPages(String(query || '')).toPromise()
  } catch (error) {
    if (String(error?.reason?.code || error?.code || '').trim().toLowerCase() === 'cancelled') {
      return
    }

    toastStore.showOnce(
      `embedpdf-search:${props.documentId}`,
      error?.message || t('Preview failed'),
      { type: 'error', duration: 3200 }
    )
  }
}

function toggleSearchFlag(flag) {
  const searchScope = search.provides.value
  if (!searchScope) return

  const nextFlags = new Set(search.state.value?.flags || [])
  if (nextFlags.has(flag)) {
    nextFlags.delete(flag)
  } else {
    nextFlags.add(flag)
  }

  searchScope.setFlags(Array.from(nextFlags))
}

function toggleShowAllResults() {
  const searchScope = search.provides.value
  if (!searchScope) return
  searchScope.setShowAllResults(!search.state.value?.showAllResults)
}

function navigateSearch(direction = 1) {
  const searchScope = search.provides.value
  if (!searchScope) return

  if (!hasSearchResults.value) {
    if (String(searchQuery.value || '').trim()) {
      void executeSearch(searchQuery.value)
    }
    return
  }

  if (direction < 0) {
    searchScope.previousResult()
    return
  }

  searchScope.nextResult()
}

function handleSearchEnter(event) {
  navigateSearch(event?.shiftKey ? -1 : 1)
}

function handleSearchEscape() {
  if (String(searchQuery.value || '').trim()) {
    suppressSearchWatch = true
    searchQuery.value = ''
    search.provides.value?.stopSearch?.()
    focusSearchInput(false)
    return
  }

  closeSearchUi()
}

async function copyTextToClipboard(text = '') {
  if (!text) return

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  try {
    await writeClipboardText(text)
    return
  } catch {
    // Fall through to execCommand fallback.
  }

  if (typeof document === 'undefined') {
    throw new Error(t('Clipboard is unavailable'))
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

async function readSelectedText() {
  const selectionScope = selectionCapability.value?.forDocument(props.documentId)
  if (!selectionScope) return ''

  try {
    const lines = await selectionScope.getSelectedText().toPromise()
    return normalizeSelectedText(lines)
  } catch {
    return ''
  }
}

async function refreshSelectedText() {
  const selectionScope = selectionCapability.value?.forDocument(props.documentId)
  if (!selectionScope) {
    selectedText.value = ''
    selectionActive.value = false
    return
  }

  const state = selectionScope.getState()
  selectionActive.value = Boolean(state?.active)
  if (!state?.active) {
    selectedText.value = ''
    return
  }

  selectedText.value = await readSelectedText()
}

async function copySelectedText() {
  const nextText = (await readSelectedText()) || selectedText.value
  if (!nextText) return

  try {
    await copyTextToClipboard(nextText)
    selectedText.value = nextText
  } catch (error) {
    toastStore.showOnce(
      `embedpdf-copy:${props.documentId}`,
      error?.message || t('Clipboard is unavailable'),
      { type: 'error', duration: 3200 }
    )
  }
}

function buildSurfaceMenuGroups() {
  const revealDetail = currentContextMenuReverseSyncDetail.value

  return [
    {
      key: 'embedpdf-surface-actions',
      items: [
        {
          key: 'copy',
          label: t('Copy'),
          disabled: !selectedText.value,
          action: () => {
            void copySelectedText()
          },
        },
        {
          key: 'save-pdf',
          label: t('Save'),
          disabled: saveInProgress.value || !exportScope.provides.value,
          action: () => {
            void savePdfToDisk()
          },
        },
        {
          key: 'reload-pdf',
          label: t('Reload PDF'),
          action: () => {
            emit('reload-requested')
          },
        },
        {
          key: 'open-pdf',
          label: t('Open PDF'),
          action: () => {
            emit('open-external')
          },
        },
        ...(revealDetail
          ? [
              {
                key: 'reveal-source',
                label: t('Reveal Source'),
                action: () => {
                  emit('reverse-sync-request', revealDetail)
                },
              },
            ]
          : []),
      ],
    },
  ]
}

function handleShellContextMenu(event) {
  currentContextMenuReverseSyncDetail.value = resolveReverseSyncDetail(event)
  void refreshSelectedText()
  openSurfaceContextMenu({
    x: event.clientX,
    y: event.clientY,
    groups: buildSurfaceMenuGroups(),
  })
}

function handleKeydown(event) {
  const key = String(event.key || '').toLowerCase()

  if ((event.metaKey || event.ctrlKey) && key === 's') {
    event.preventDefault()
    event.stopPropagation()
    void savePdfToDisk()
    return
  }

  if ((event.metaKey || event.ctrlKey) && key === 'f') {
    event.preventDefault()
    event.stopPropagation()
    openSearchUi({ selectAll: true })
    return
  }

  if ((event.metaKey || event.ctrlKey) && key === 'c' && selectedText.value) {
    event.preventDefault()
    event.stopPropagation()
    void copySelectedText()
    return
  }

  if (event.key === 'Escape') {
    if (menuVisible.value) {
      closeSurfaceContextMenu()
      return
    }

    if (searchUiVisible.value) {
      event.preventDefault()
      event.stopPropagation()
      handleSearchEscape()
      return
    }

    if (selectionActive.value) {
      selectionCapability.value?.clear(props.documentId)
    }
  }
}

function scrollToPdfPoint(point = {}) {
  const scrollScope = scroll.provides.value
  if (!scrollScope) return false

  const pageNumber = Number(point.page || 0)
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return false

  const pageBinding = resolvePageBinding(pageNumber)
  const pageHeight = Number(pageBinding?.page?.height || 0)
  const x = Number(point.x)
  const y = Number(point.y)

  if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(pageHeight) && pageHeight > 0) {
    scrollScope.scrollToPage({
      pageNumber,
      pageCoordinates: {
        x: Math.max(0, x),
        y: Math.max(0, pageHeight - y),
      },
      behavior: 'instant',
      alignY: 35,
    })
    scheduleViewStateEmission()
    return true
  }

  scrollScope.scrollToPage({
    pageNumber,
    behavior: 'instant',
    alignY: 35,
  })
  scheduleViewStateEmission()
  return true
}

function scrollToSearchResult(index) {
  const result = search.state.value?.results?.[index]
  const scrollScope = scroll.provides.value
  if (!result || !scrollScope) return false

  const pageNumber = Number(result.pageIndex ?? -1) + 1
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return false

  const firstRect = Array.isArray(result.rects) ? result.rects[0] : null
  if (firstRect) {
    scrollScope.scrollToPage({
      pageNumber,
      pageCoordinates: {
        x: Math.max(0, Number(firstRect.origin?.x || 0)),
        y: Math.max(0, Number(firstRect.origin?.y || 0)),
      },
      behavior: 'smooth',
      alignY: 22,
    })
  } else {
    scrollScope.scrollToPage({
      pageNumber,
      behavior: 'smooth',
      alignY: 22,
    })
  }

  scheduleViewStateEmission()
  return true
}

async function savePdfToDisk() {
  if (saveInProgress.value) return
  const task = exportScope.provides.value?.saveAsCopy()
  if (!task) return

  saveInProgress.value = true
  try {
    const arrayBuffer = await task.toPromise()
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error(t('Preview failed'))
    }

    await writePdfArtifactBase64(
      props.artifactPath,
      encodePdfArrayBufferToBase64(arrayBuffer)
    )

    toastStore.show(`"${basenamePath(props.artifactPath) || 'PDF'}" ${t('Saved')}`, {
      type: 'success',
      duration: 2200,
    })
  } catch (error) {
    toastStore.showOnce(
      `embedpdf-save:${props.artifactPath}`,
      error?.message || t('Preview failed'),
      { type: 'error', duration: 3200 }
    )
  } finally {
    saveInProgress.value = false
  }
}

function resolveReverseSyncDetail(event) {
  if (props.kind !== 'latex') return null

  const pageElement = event?.target?.closest?.('.pdf-artifact-preview__page-shell')
  const pageNumber = Number(pageElement?.dataset?.pageNumber || 0)
  const pointer = resolveMouseClientPoint(event)
  const pageBinding = resolvePageBinding(pageNumber)
  const pageRect = pageBinding?.element?.getBoundingClientRect?.()
  const pageWidth = Number(pageBinding?.page?.width || 0)
  const pageHeight = Number(pageBinding?.page?.height || 0)

  if (
    !pageElement
    || !Number.isInteger(pageNumber)
    || pageNumber < 1
    || !pointer
    || !pageRect
    || !Number.isFinite(pageRect.width)
    || !Number.isFinite(pageRect.height)
    || pageRect.width <= 0
    || pageRect.height <= 0
    || !Number.isFinite(pageWidth)
    || !Number.isFinite(pageHeight)
    || pageWidth <= 0
    || pageHeight <= 0
  ) {
    return null
  }

  const localX = clamp(pointer.clientX - pageRect.left, 0, pageRect.width)
  const localY = clamp(pointer.clientY - pageRect.top, 0, pageRect.height)
  const pdfX = (localX / pageRect.width) * pageWidth
  const pdfY = pageHeight - (localY / pageRect.height) * pageHeight

  return {
    page: pageNumber,
    pos: [pdfX, pdfY],
    textBeforeSelection: '',
    textAfterSelection: '',
  }
}

async function handleDoubleClick(event) {
  if (props.kind !== 'latex') return

  await nextTick()
  if (typeof window !== 'undefined') {
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  }

  if (!event?.altKey && selectionActive.value) return

  const detail = resolveReverseSyncDetail(event)
  if (!detail) return
  emit('reverse-sync-request', detail)
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
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
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
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  }

  if (currentRevision !== restoreRevision) return false

  const pageElement = resolvePageBinding(pageNumber)?.element
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
  () => props.forwardSyncPoint,
  (nextPoint) => {
    pendingForwardSyncPoint.value = nextPoint ? { ...nextPoint } : null
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
    pageBindings.clear()
    pendingForwardSyncPoint.value = null
    currentContextMenuReverseSyncDetail.value = null
    initialLayoutHandled.value = false
    selectionActive.value = false
    selectedText.value = ''
    suppressSearchWatch = true
    searchQuery.value = ''
    searchUiVisible.value = false
    scheduleViewStateEmission()
  }
)

watch(
  () => search.state.value?.query,
  (nextQuery) => {
    const normalizedQuery = String(nextQuery || '')
    if (normalizedQuery === searchQuery.value) return
    suppressSearchWatch = true
    searchQuery.value = normalizedQuery
  },
  { immediate: true }
)

watch(
  () => searchQuery.value,
  (nextQuery) => {
    if (suppressSearchWatch) {
      suppressSearchWatch = false
      return
    }

    if (!searchUiVisible.value && !String(nextQuery || '').trim()) return
    scheduleSearchExecution(nextQuery)
  }
)

watch(
  () => search.state.value?.activeResultIndex,
  (nextIndex) => {
    if (!Number.isInteger(nextIndex) || nextIndex < 0) return
    void nextTick(() => {
      scrollToSearchResult(nextIndex)
    })
  }
)

watch(
  [selectionCapability, () => props.documentId],
  ([capability, documentId], _, onCleanup) => {
    if (!capability || !documentId) {
      selectionActive.value = false
      selectedText.value = ''
      return
    }

    const selectionScope = capability.forDocument(documentId)
    selectionActive.value = Boolean(selectionScope.getState()?.active)

    const syncSelection = () => {
      void refreshSelectedText()
    }

    syncSelection()

    const unsubscribeSelection = selectionScope.onSelectionChange(() => {
      syncSelection()
    })
    const unsubscribeText = selectionScope.onTextRetrieved((text) => {
      selectedText.value = normalizeSelectedText(text)
      selectionActive.value = Boolean(selectedText.value)
    })

    onCleanup(() => {
      unsubscribeSelection?.()
      unsubscribeText?.()
    })
  },
  { immediate: true }
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

      if (pendingForwardSyncPoint.value && scrollToPdfPoint(pendingForwardSyncPoint.value)) {
        pendingForwardSyncPoint.value = null
        emit('forward-sync-point-consumed')
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

watch(
  () => pendingForwardSyncPoint.value,
  (nextPoint) => {
    if (!nextPoint || !initialLayoutHandled.value) return
    if (scrollToPdfPoint(nextPoint)) {
      pendingForwardSyncPoint.value = null
      emit('forward-sync-point-consumed')
    }
  }
)

onUnmounted(() => {
  pageBindings.clear()
  clearSearchDebounceTimer()

  if (scheduledViewStateFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(scheduledViewStateFrame)
    scheduledViewStateFrame = 0
  }
})
</script>

<style scoped>
.pdf-artifact-preview__surface {
  position: relative;
  width: 100%;
  height: 100%;
  outline: none;
}

.pdf-artifact-preview__toolbar {
  position: absolute;
  top: 14px;
  left: 50%;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: min(720px, calc(100% - 32px));
  max-width: calc(100% - 32px);
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--border-subtle) 86%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-base) 94%, transparent);
  box-shadow: 0 14px 34px rgb(0 0 0 / 0.14);
  backdrop-filter: blur(16px);
  transform: translateX(-50%);
}

.pdf-artifact-preview__search-input {
  flex: 1 1 220px;
  min-width: 180px;
}

.pdf-artifact-preview__search-summary {
  min-width: 72px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
}

.pdf-artifact-preview__toolbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pdf-artifact-preview__viewport {
  width: 100%;
  height: 100%;
  background: var(--embedpdf-surface);
}

.pdf-artifact-preview__page-shell {
  position: relative;
  margin: 12px auto;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.16);
  background: var(--embedpdf-page);
}

.pdf-artifact-preview__page {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--embedpdf-page);
  user-select: none;
}

.pdf-artifact-preview__selection-menu {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--border-subtle) 88%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-base) 96%, transparent);
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.18);
}

@media (max-width: 720px) {
  .pdf-artifact-preview__toolbar {
    left: 12px;
    right: 12px;
    min-width: 0;
    max-width: none;
    transform: none;
  }

  .pdf-artifact-preview__search-summary {
    display: none;
  }
}
</style>
