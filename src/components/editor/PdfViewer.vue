<template>
  <div class="pdf-viewer-root" @mousedown="markPaneActive">
    <Teleport v-if="usingExternalToolbar" :to="toolbarTargetSelector">
      <div class="pdf-toolbar-shell pdf-toolbar-shell-embedded" @mousedown="markPaneActive">
        <PdfToolbar />
      </div>
    </Teleport>

    <div v-else class="pdf-toolbar-shell" @mousedown="markPaneActive">
      <PdfToolbar />
    </div>

    <div class="pdf-viewer-shell">
      <aside v-if="pdfUi.sidebarOpen && sidebarAvailable" class="pdf-sidebar">
        <div class="pdf-sidebar-tabs">
          <UiButton
            class="pdf-sidebar-tab"
            variant="ghost"
            size="sm"
            :active="pdfUi.sidebarMode === 'outline'"
            :disabled="!pdfUi.outlineSupported && !outlineLoading"
            @click="selectSidebarMode('outline')"
          >
            {{ t('Outline') }}
          </UiButton>
          <UiButton
            class="pdf-sidebar-tab"
            variant="ghost"
            size="sm"
            :active="pdfUi.sidebarMode === 'pages'"
            :disabled="!pdfUi.pagesSupported"
            @click="selectSidebarMode('pages')"
          >
            {{ t('Pages') }}
          </UiButton>
        </div>

        <div ref="sidebarScrollRef" class="pdf-sidebar-scroll">
          <template v-if="pdfUi.sidebarMode === 'outline'">
            <div v-if="outlineLoading" class="pdf-sidebar-state">
              {{ t('Loading outline…') }}
            </div>
            <div v-else-if="flatOutlineItems.length === 0" class="pdf-sidebar-state">
              {{ t('No outline available') }}
            </div>
            <button
              v-for="entry in flatOutlineItems"
              :key="entry.id"
              type="button"
              class="pdf-outline-item"
              :style="{ '--outline-depth': entry.depth }"
              @click="activateOutlineItem(entry.item)"
            >
              <span
                class="pdf-outline-label"
                :class="{
                  'is-bold': entry.item.bold,
                  'is-italic': entry.item.italic,
                }"
              >
                {{ entry.item.title }}
              </span>
            </button>
          </template>

          <template v-else>
            <div v-if="pageThumbnails.length === 0" class="pdf-sidebar-state">
              {{ t('Preparing page previews…') }}
            </div>
            <button
              v-for="thumbnail in pageThumbnails"
              :key="thumbnail.pageNumber"
              :ref="(element) => setThumbnailItemRef(thumbnail.pageNumber, element)"
              type="button"
              class="pdf-page-thumb"
              :class="{ 'is-active': thumbnail.pageNumber === pdfUi.pageNumber }"
              @click="activatePageThumbnail(thumbnail.pageNumber)"
            >
              <div class="pdf-page-thumb-preview" :style="thumbnailPreviewStyle(thumbnail)">
                <img
                  v-if="thumbnail.imageSrc"
                  :src="thumbnail.imageSrc"
                  :alt="t('Page {page}', { page: thumbnail.pageNumber })"
                />
                <span v-else class="pdf-page-thumb-placeholder">
                  {{
                    thumbnail.status === 'error'
                      ? t('Failed')
                      : thumbnail.status === 'loading'
                        ? t('Loading...')
                        : t('Page')
                  }}
                </span>
              </div>
              <span class="pdf-page-thumb-label">
                {{ t('Page {page}', { page: thumbnail.pageNumber }) }}
              </span>
            </button>
          </template>
        </div>
      </aside>

      <div class="pdf-main">
        <div ref="findBarRef" class="pdf-findbar hidden">
          <div class="pdf-findbar-row">
            <input
              ref="findInputRef"
              class="pdf-find-input"
              type="text"
              :placeholder="t('Search in PDF')"
            />
            <div class="pdf-find-actions">
              <button
                ref="findPreviousButtonRef"
                type="button"
                class="pdf-find-nav-btn"
                :title="t('Previous match')"
                :aria-label="t('Previous match')"
                :disabled="!pdfFind.query.trim()"
              >
                <IconChevronLeft :size="13" :stroke-width="1.8" />
              </button>
              <button
                ref="findNextButtonRef"
                type="button"
                class="pdf-find-nav-btn"
                :title="t('Next match')"
                :aria-label="t('Next match')"
                :disabled="!pdfFind.query.trim()"
              >
                <IconChevronRight :size="13" :stroke-width="1.8" />
              </button>
              <span ref="findResultsCountRef" class="pdf-find-results"></span>
            </div>
          </div>

          <div class="pdf-findbar-options">
            <label class="pdf-find-toggle">
              <input ref="findHighlightAllRef" type="checkbox" :checked="pdfFind.highlightAll" />
              <span>{{ t('Highlight all') }}</span>
            </label>
            <label class="pdf-find-toggle">
              <input ref="findMatchCaseRef" type="checkbox" :checked="pdfFind.matchCase" />
              <span>{{ t('Match case') }}</span>
            </label>
            <label class="pdf-find-toggle">
              <input ref="findEntireWordRef" type="checkbox" :checked="pdfFind.entireWord" />
              <span>{{ t('Whole words') }}</span>
            </label>
            <label class="pdf-find-toggle">
              <input
                ref="findMatchDiacriticsRef"
                type="checkbox"
                :checked="pdfFind.matchDiacritics"
              />
              <span>{{ t('Match diacritics') }}</span>
            </label>
            <span ref="findMessageRef" class="pdf-find-message"></span>
          </div>
        </div>

        <div ref="viewerContainerRef" class="pdf-canvas-shell" @dblclick="handleViewerDoubleClick">
          <div ref="viewerRef" class="pdfViewer"></div>

          <div v-if="loading" class="pdf-viewer-state">
            {{ t('Loading PDF…') }}
          </div>

          <div v-else-if="error" class="pdf-viewer-state pdf-viewer-state-error">
            <div>{{ t('Could not load PDF') }}</div>
            <div class="pdf-viewer-error-text">{{ error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import 'pdfjs-dist/legacy/web/pdf_viewer.css'

import { computed, defineComponent, h, nextTick, ref, toRef, watch } from 'vue'
import {
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconPlus,
  IconSearch,
} from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { usePdfViewerSession } from '../../composables/usePdfViewerSession'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import UiButton from '../shared/ui/UiButton.vue'

const emit = defineEmits(['dblclick-page'])

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
  toolbarTargetSelector: { type: String, default: '' },
  referenceKey: { type: String, default: '' },
})

const { t } = useI18n()
const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const filePathRef = toRef(props, 'filePath')

const viewerContainerRef = ref(null)
const viewerRef = ref(null)
const sidebarScrollRef = ref(null)
const pageInputRef = ref(null)
const findBarRef = ref(null)
const findInputRef = ref(null)
const findHighlightAllRef = ref(null)
const findMatchCaseRef = ref(null)
const findMatchDiacriticsRef = ref(null)
const findEntireWordRef = ref(null)
const findMessageRef = ref(null)
const findResultsCountRef = ref(null)
const findPreviousButtonRef = ref(null)
const findNextButtonRef = ref(null)

const usingExternalToolbar = computed(() => !!props.toolbarTargetSelector)

const {
  pageInput,
  loading,
  error,
  outlineItems,
  outlineLoading,
  pageThumbnails,
  pdfUi,
  pdfFind,
  sidebarIcon,
  sidebarAvailable,
  scaleOptions,
  selectSidebarMode,
  toggleSidebar,
  activateOutlineItem,
  activatePageThumbnail,
  goPreviousPage,
  goNextPage,
  commitPageNumber,
  zoomOut,
  zoomIn,
  applyScale,
  setThumbnailItemRef,
  thumbnailPreviewStyle,
  scrollToPage,
  scrollToLocation: scrollToSyncLocation,
  convertPageOffsetToSyncTexPoint,
  toggleFind,
} = usePdfViewerSession({
  filePathRef,
  viewerContainerRef,
  viewerRef,
  sidebarScrollRef,
  pageInputRef,
  findBarRef,
  findInputRef,
  findHighlightAllRef,
  findMatchCaseRef,
  findMatchDiacriticsRef,
  findEntireWordRef,
  findMessageRef,
  findResultsCountRef,
  findPreviousButtonRef,
  findNextButtonRef,
  workspace,
  t,
})

const flatOutlineItems = computed(() => flattenOutlineItems(outlineItems.value))

const PdfToolbar = defineComponent({
  name: 'PdfToolbar',
  setup() {
    return () =>
      h('div', { class: 'pdf-toolbar' }, [
        h('div', { class: 'pdf-toolbar-group' }, [
          h(
            UiButton,
            {
              variant: 'ghost',
              size: 'icon-sm',
              iconOnly: true,
              title: pdfUi.sidebarOpen ? t('Hide sidebar') : t('Show sidebar'),
              disabled: !sidebarAvailable.value,
              active: pdfUi.sidebarOpen,
              onClick: toggleSidebar,
            },
            {
              default: () => h(sidebarIcon.value, { size: 13, 'stroke-width': 1.8 }),
            }
          ),
          h(
            UiButton,
            {
              variant: 'ghost',
              size: 'icon-sm',
              iconOnly: true,
              title: t('Search'),
              disabled: !pdfUi.ready,
              active: pdfFind.open,
              onClick: toggleFind,
            },
            {
              default: () => h(IconSearch, { size: 13, 'stroke-width': 1.8 }),
            }
          ),
          h(
            UiButton,
            {
              variant: 'ghost',
              size: 'icon-sm',
              iconOnly: true,
              title: t('Previous page'),
              disabled: !pdfUi.canGoPrevious,
              onClick: goPreviousPage,
            },
            {
              default: () => h(IconChevronLeft, { size: 13, 'stroke-width': 1.8 }),
            }
          ),
          h(
            UiButton,
            {
              variant: 'ghost',
              size: 'icon-sm',
              iconOnly: true,
              title: t('Next page'),
              disabled: !pdfUi.canGoNext,
              onClick: goNextPage,
            },
            {
              default: () => h(IconChevronRight, { size: 13, 'stroke-width': 1.8 }),
            }
          ),
        ]),
        h('div', { class: 'pdf-toolbar-group pdf-toolbar-group-page' }, [
          h('input', {
            ref: pageInputRef,
            value: pageInput.value,
            type: 'text',
            inputmode: 'numeric',
            class: 'pdf-toolbar-page-input',
            disabled: !pdfUi.ready,
            onInput: (event) => {
              pageInput.value = event.target.value
            },
            onFocus: markPaneActive,
            onBlur: commitPageNumber,
            onKeydown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitPageNumber()
              }
            },
          }),
          h(
            'span',
            { class: 'pdf-toolbar-page-label' },
            t('of {count}', { count: pdfUi.pagesCount || 0 })
          ),
        ]),
        h('div', { class: 'pdf-toolbar-group pdf-toolbar-group-scale' }, [
          h(
            UiButton,
            {
              variant: 'ghost',
              size: 'icon-sm',
              iconOnly: true,
              title: t('Zoom out'),
              disabled: !pdfUi.canZoomOut,
              onClick: zoomOut,
            },
            {
              default: () => h(IconMinus, { size: 13, 'stroke-width': 1.8 }),
            }
          ),
          h(
            'select',
            {
              class: 'pdf-toolbar-scale-select',
              value: pdfUi.scaleValue,
              disabled: !pdfUi.ready || scaleOptions.value.length === 0,
              onFocus: markPaneActive,
              onChange: (event) => {
                pdfUi.scaleValue = event.target.value
                applyScale()
              },
            },
            scaleOptions.value.map((option) =>
              h('option', { key: option.value, value: option.value }, option.label)
            )
          ),
          h(
            UiButton,
            {
              variant: 'ghost',
              size: 'icon-sm',
              iconOnly: true,
              title: t('Zoom in'),
              disabled: !pdfUi.canZoomIn,
              onClick: zoomIn,
            },
            {
              default: () => h(IconPlus, { size: 13, 'stroke-width': 1.8 }),
            }
          ),
        ]),
      ])
  },
})

watch(
  () => pdfFind.open,
  async (open) => {
    if (!open) return
    await nextTick()
    findInputRef.value?.focus?.()
    findInputRef.value?.select?.()
  }
)

function flattenOutlineItems(items = [], depth = 0, result = []) {
  for (const item of items) {
    result.push({
      id: item.id,
      depth,
      item,
    })
    if (Array.isArray(item.items) && item.items.length > 0) {
      flattenOutlineItems(item.items, depth + 1, result)
    }
  }
  return result
}

function markPaneActive() {
  editorStore.setActivePane(props.paneId)
}

function getPageElement(pageNumber) {
  return viewerRef.value?.querySelector?.(`.page[data-page-number="${pageNumber}"]`) || null
}

function scrollToPagePoint(pageNumber, x, y, attempt = 0) {
  const targetPage = Number(pageNumber)
  if (!Number.isInteger(targetPage) || targetPage < 1) return

  const container = viewerContainerRef.value
  const pageElement = getPageElement(targetPage)
  if (!container || !pageElement) {
    scrollToPage(targetPage)
    if (attempt < 6) {
      window.setTimeout(() => {
        scrollToPagePoint(targetPage, x, y, attempt + 1)
      }, 90)
    }
    return
  }

  const localX = Number(x)
  const localY = Number(y)
  const targetTop =
    pageElement.offsetTop + (Number.isFinite(localY) ? localY : 0) - container.clientHeight / 2
  const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight)
  const clampedTop = Math.min(Math.max(0, targetTop), maxScrollTop)

  container.scrollTo({
    top: clampedTop,
    behavior: 'auto',
  })

  if (Number.isFinite(localX)) {
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
    const targetLeft = pageElement.offsetLeft + localX - container.clientWidth / 2
    container.scrollLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft)
  }
}

function handleViewerDoubleClick(event) {
  const pageElement = event.target?.closest?.('.page[data-page-number]')
  if (!pageElement) return

  const page = Number(pageElement.dataset.pageNumber || 0)
  if (!Number.isInteger(page) || page < 1) return

  const rect = pageElement.getBoundingClientRect()
  const pageX = event.clientX - rect.left
  const pageY = event.clientY - rect.top
  const syncPoint = convertPageOffsetToSyncTexPoint(page, pageX, pageY)

  emit('dblclick-page', {
    page,
    x: syncPoint?.x ?? pageX,
    y: syncPoint?.y ?? pageY,
    pageX,
    pageY,
  })
}

function scrollToLocation(pageNumber, x, y, options = {}) {
  if (options.coordinateSpace === 'page') {
    scrollToPagePoint(pageNumber, x, y)
    return
  }
  scrollToSyncLocation(pageNumber, x, y)
}

defineExpose({
  scrollToLocation,
  getCurrentPageNumber: () => Number(pdfUi.pageNumber || 1),
})
</script>

<style scoped>
.pdf-viewer-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(
      circle at top,
      color-mix(in srgb, var(--accent) 10%, transparent),
      transparent 46%
    ),
    var(--bg-primary);
}

.pdf-toolbar-shell {
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-base) 92%, transparent);
}

.pdf-toolbar-shell-embedded {
  border-bottom: none;
  background: transparent;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 10px 14px;
}

.pdf-toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.pdf-toolbar-group-page {
  flex: 1;
  justify-content: center;
}

.pdf-toolbar-group-scale {
  justify-content: flex-end;
}

.pdf-toolbar-page-input,
.pdf-toolbar-scale-select,
.pdf-find-input {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-base);
  color: var(--text-primary);
  font: inherit;
  outline: none;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    background-color 140ms ease;
}

.pdf-toolbar-page-input:focus,
.pdf-toolbar-scale-select:focus,
.pdf-find-input:focus {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border));
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.pdf-toolbar-page-input {
  width: 72px;
  min-height: 30px;
  padding: 0 10px;
  text-align: center;
}

.pdf-toolbar-page-label {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
  white-space: nowrap;
}

.pdf-toolbar-scale-select {
  min-width: 124px;
  min-height: 30px;
  padding: 0 32px 0 10px;
}

.pdf-viewer-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.pdf-sidebar {
  width: min(280px, 32vw);
  min-width: 220px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-panel) 92%, transparent);
  backdrop-filter: blur(12px);
}

.pdf-sidebar-tabs {
  display: flex;
  gap: 6px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.pdf-sidebar-tab {
  flex: 1;
}

.pdf-sidebar-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px 10px 14px;
}

.pdf-sidebar-state {
  padding: 18px 10px;
  color: var(--text-muted);
  font-size: var(--ui-font-caption);
  text-align: center;
}

.pdf-outline-item {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 8px 10px 8px calc(10px + var(--outline-depth) * 16px);
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.pdf-outline-item:hover {
  background: color-mix(in srgb, var(--surface-hover) 72%, transparent);
  color: var(--text-primary);
}

.pdf-outline-label {
  font-size: var(--ui-font-caption);
  line-height: 1.45;
}

.pdf-outline-label.is-bold {
  font-weight: 600;
}

.pdf-outline-label.is-italic {
  font-style: italic;
}

.pdf-page-thumb {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: calc(var(--radius-md) + 2px);
  background: color-mix(in srgb, var(--surface-base) 94%, transparent);
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    transform 140ms ease;
}

.pdf-page-thumb:hover {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
  background: color-mix(in srgb, var(--surface-hover) 88%, transparent);
  transform: translateY(-1px);
}

.pdf-page-thumb.is-active {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-base));
}

.pdf-page-thumb-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-md);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-muted) 82%, transparent),
    var(--surface-base)
  );
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border-subtle) 76%, transparent);
}

.pdf-page-thumb-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.pdf-page-thumb-placeholder,
.pdf-page-thumb-label {
  font-size: var(--ui-font-micro);
  color: var(--text-muted);
}

.pdf-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.pdf-findbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-panel) 90%, transparent);
}

.pdf-findbar-row,
.pdf-findbar-options {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pdf-find-input {
  flex: 1;
  min-width: 220px;
  min-height: 32px;
  padding: 0 12px;
}

.pdf-find-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pdf-find-nav-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    opacity 140ms ease;
}

.pdf-find-nav-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface-hover) 72%, transparent);
  color: var(--text-primary);
}

.pdf-find-nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.pdf-find-results,
.pdf-find-message {
  font-size: var(--ui-font-micro);
  color: var(--text-muted);
}

.pdf-find-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--ui-font-micro);
  color: var(--text-secondary);
}

.pdf-find-toggle input {
  margin: 0;
}

.pdf-canvas-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background:
    radial-gradient(
      circle at top,
      color-mix(in srgb, var(--accent) 8%, transparent),
      transparent 34%
    ),
    color-mix(in srgb, var(--surface-muted) 42%, var(--bg-primary));
}

.pdf-viewer-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: color-mix(in srgb, var(--bg-primary) 76%, transparent);
  color: var(--text-muted);
  text-align: center;
  z-index: 1;
}

.pdf-viewer-state-error {
  flex-direction: column;
  gap: 8px;
}

.pdf-viewer-error-text {
  max-width: min(72ch, 90%);
  font-size: var(--ui-font-micro);
  color: var(--text-secondary);
  word-break: break-word;
}

.hidden {
  display: none !important;
}

:deep(.pdfViewer) {
  padding: 20px 0 36px;
}

:deep(.pdfViewer .page) {
  margin-bottom: 16px;
  border-radius: 10px;
  box-shadow:
    0 22px 50px rgba(15, 23, 42, 0.08),
    0 6px 18px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

:deep(.altals-pdf-sync-highlight) {
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  background:
    radial-gradient(
      circle at var(--sync-highlight-anchor-x) 50%,
      color-mix(in srgb, var(--accent) 22%, transparent),
      transparent 55%
    ),
    color-mix(in srgb, var(--accent) 12%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent);
  animation: pdf-sync-highlight-fade 1.4s ease forwards;
}

@keyframes pdf-sync-highlight-fade {
  0% {
    opacity: 0;
    transform: scaleX(0.98);
  }

  18% {
    opacity: 1;
    transform: scaleX(1);
  }

  100% {
    opacity: 0;
    transform: scaleX(1.01);
  }
}

@media (max-width: 900px) {
  .pdf-sidebar {
    width: 220px;
    min-width: 200px;
  }

  .pdf-toolbar {
    flex-wrap: wrap;
  }

  .pdf-toolbar-group-page {
    order: 3;
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .pdf-viewer-shell {
    flex-direction: column;
  }

  .pdf-sidebar {
    width: 100%;
    min-width: 0;
    max-height: 240px;
    border-right: none;
    border-bottom: 1px solid var(--border-subtle);
  }

  .pdf-find-input {
    min-width: 0;
    width: 100%;
  }
}
</style>
