<template>
  <div
    ref="workbenchEl"
    class="library-workbench h-full min-h-0"
    :class="{
      'is-compact-pane': isCompactPane,
      'is-sidebar-drawer-open': isCompactPane && compactSidebarOpen,
      'is-detail-drawer-open': isCompactPane && compactDetailOpen && !!activeRef,
    }"
  >
    <button
      v-if="showCompactBackdrop"
      type="button"
      class="library-compact-backdrop"
      :aria-label="t('Close')"
      @click="closeCompactPanels"
    ></button>

    <div class="library-shell h-full min-h-0" :class="{ 'is-editing': isEditing }">
      <aside class="library-sidebar">
        <div v-if="isCompactPane" class="library-sidebar-header is-compact">
          <div class="library-sidebar-head">
            <div class="library-section-label">{{ t('Filters') }}</div>
            <button
              type="button"
              class="library-icon-button"
              :aria-label="t('Close')"
              @click="compactSidebarOpen = false"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        </div>

        <section class="library-sidebar-section">
          <div class="library-nav-list is-views">
            <button
              v-for="view in sidebarViewOptions"
              :key="view.id"
              type="button"
              class="library-nav-item"
              :class="{ 'is-active': activeView === view.id }"
              @click="activateView(view.id)"
            >
              <span class="truncate">{{ view.label }}</span>
              <span class="library-nav-count">{{ view.count }}</span>
            </button>
          </div>
        </section>

        <section class="library-sidebar-section grow">
          <div class="library-sidebar-row">
            <div class="library-section-label">{{ t('Tags') }}</div>
            <button
              v-if="selectedTags.length > 0"
              type="button"
              class="library-link-button"
              @click="selectedTags = []"
            >
              {{ t('Clear') }}
            </button>
          </div>

          <div v-if="tagFacets.length > 0" class="library-tag-list">
            <button
              v-for="tag in tagFacets"
              :key="tag.tag"
              type="button"
              class="library-tag-row"
              :class="{ 'is-active': selectedTags.includes(tag.tag) }"
              @click="toggleTag(tag.tag)"
            >
              <span class="truncate">{{ tag.tag }}</span>
              <span class="library-nav-count">{{ tag.count }}</span>
            </button>
          </div>
          <div v-else class="library-inline-empty">
            {{ t('No tags in this view') }}
          </div>
        </section>
      </aside>

      <template v-if="isEditing && activeRef">
        <section class="library-editor-stage">
          <div class="library-editor-toolbar">
            <div class="library-editor-meta">
              <div class="library-section-label">{{ t('Edit reference metadata') }}</div>
            </div>

            <div class="library-editor-actions">
              <button type="button" class="library-inline-button" @click="exitEditMode">
                {{ t('Back to overview') }}
              </button>
            </div>
          </div>

          <div class="library-editor-surface">
            <LibraryReferenceEditor :refKey="activeRef._key" />
          </div>
        </section>
      </template>

      <template v-else>
        <main class="library-main">
          <div class="library-toolbar">
            <div v-if="isCompactPane" class="library-compact-toolbar">
              <button
                type="button"
                class="library-quiet-button"
                :class="{ 'is-active': compactSidebarOpen }"
                @click="toggleCompactSidebar"
              >
                {{ t('Filters') }}
              </button>
              <button
                type="button"
                class="library-quiet-button"
                :class="{ 'is-active': compactDetailOpen }"
                :disabled="!activeRef"
                @click="toggleCompactDetail"
              >
                {{ t('Details') }}
              </button>
            </div>

            <div class="library-toolbar-row">
              <div class="library-search-shell">
                <input
                  v-model="searchQuery"
                  class="library-search-input"
                  :placeholder="t('Search title, author, DOI, tags, abstract...')"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </div>

              <select v-model="sortKey" class="library-select">
                <option value="added-desc">{{ t('Date added (newest)') }}</option>
                <option value="year-desc">{{ t('Year (newest)') }}</option>
                <option value="year-asc">{{ t('Year (oldest)') }}</option>
                <option value="title-asc">{{ t('Title A → Z') }}</option>
                <option value="author-asc">{{ t('Author A → Z') }}</option>
              </select>

              <button type="button" class="library-inline-button is-primary" @click="showImportDialog = true">
                {{ t('Import references') }}
              </button>
            </div>

            <div v-if="selectedTags.length > 0" class="library-filter-row">
              <div class="library-section-label">{{ t('Tags') }}</div>
              <div class="library-filter-chip-row">
                <button
                  v-for="tag in selectedTags"
                  :key="tag"
                  type="button"
                  class="library-filter-chip"
                  @click="toggleTag(tag)"
                >
                  {{ tag }}
                </button>
              </div>
            </div>

            <div v-if="hasBatchSelection" class="library-batch-row">
              <div class="library-batch-head">
                <div class="library-batch-label">
                  {{ t('Selected ({count})', { count: selectedKeys.length }) }}
                </div>
                <div class="library-batch-actions">
                  <div class="library-batch-group">
                    <button type="button" class="library-inline-button" @click="addSelectionToWorkspace">
                      {{ t('Add to project') }}
                    </button>
                    <button type="button" class="library-inline-button" @click="removeSelectionFromWorkspace">
                      {{ t('Remove from this project') }}
                    </button>
                  </div>

                  <div class="library-batch-group is-fluid">
                    <select v-model="batchTagAction" class="library-select library-batch-select">
                      <option value="add">{{ t('Add tags') }}</option>
                      <option value="replace">{{ t('Replace tags') }}</option>
                      <option value="remove">{{ t('Remove tags') }}</option>
                    </select>
                    <input
                      v-model="tagActionInput"
                      class="library-batch-input"
                      :placeholder="t('comma-separated')"
                      autocomplete="off"
                      autocorrect="off"
                      autocapitalize="off"
                      spellcheck="false"
                    />
                    <button type="button" class="library-inline-button" @click="applyTagAction(batchTagAction)">
                      {{ t('Apply') }}
                    </button>
                  </div>
                </div>
                <button type="button" class="library-link-button" @click="clearSelection">
                  {{ t('Clear') }}
                </button>
              </div>
            </div>
          </div>

          <div class="library-table">
            <div class="library-table-header">
              <div></div>
              <div>{{ t('Reference') }}</div>
              <div>{{ t('Tags') }}</div>
              <div>{{ t('Current project') }}</div>
            </div>

            <div class="library-table-body">
              <template v-if="isLibraryLoading">
                <div class="library-empty-state">
                  <div class="library-empty-title">{{ t('Loading references...') }}</div>
                  <div class="library-empty-copy">{{ t('Global library is loading for this project context.') }}</div>
                </div>
              </template>

              <template v-else-if="filteredRefs.length === 0">
                <div class="library-empty-state">
                  <div class="library-empty-title">{{ t('Nothing in this view yet.') }}</div>
                  <div class="library-empty-copy">{{ t('Switch library views, clear tag filters, or import references into the global library.') }}</div>
                </div>
              </template>

              <template v-else>
                <div
                  v-for="refItem in filteredRefs"
                  :key="refItem._key"
                  class="library-table-row"
                  :class="{ 'is-focused': activeKey === refItem._key }"
                  @click="focusReference(refItem._key)"
                  @dblclick="enterEditMode(refItem._key)"
                >
                  <label class="library-checkbox-cell" @click.stop>
                    <input
                      :checked="selectedKeySet.has(refItem._key)"
                      type="checkbox"
                      @change="toggleSelection(refItem._key)"
                    />
                  </label>

                  <div class="library-ref-cell">
                    <div class="library-ref-title-row">
                      <span class="library-ref-title">{{ refItem.title || `@${refItem._key}` }}</span>
                      <span v-if="refItem._needsReview" class="library-state-pill warning">{{ t('Needs review') }}</span>
                      <span v-if="refItem._pdfFile" class="library-state-pill">{{ t('PDF') }}</span>
                    </div>
                    <div class="library-ref-meta">
                      <span>{{ formatAuthors(refItem) || t('Unknown author') }}</span>
                      <span v-if="extractYear(refItem)"> · {{ extractYear(refItem) }}</span>
                      <span v-if="containerLabel(refItem)"> · {{ containerLabel(refItem) }}</span>
                      <span class="library-ref-key">@{{ refItem._key }}</span>
                    </div>
                  </div>

                  <div class="library-tags-cell">
                    <template v-if="(refItem._tags || []).length > 0">
                      <span
                        v-for="tag in visibleTags(refItem)"
                        :key="`${refItem._key}-${tag}`"
                        class="library-tag-chip"
                      >
                        {{ tag }}
                      </span>
                      <span v-if="hiddenTagCount(refItem) > 0" class="library-tag-chip muted">
                        +{{ hiddenTagCount(refItem) }}
                      </span>
                    </template>
                    <span v-else class="library-muted-copy">
                      {{ t('Untagged') }}
                    </span>
                  </div>

                  <div class="library-project-cell">
                    <span class="library-state-pill" :class="{ active: isInCurrentProject(refItem._key) }">
                      {{ isInCurrentProject(refItem._key) ? t('In project') : t('Library only') }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </main>

        <aside class="library-detail">
          <div v-if="isCompactPane" class="library-detail-compact-head">
            <div class="library-section-label">{{ t('Details') }}</div>
            <button
              type="button"
              class="library-icon-button"
              :aria-label="t('Close')"
              @click="compactDetailOpen = false"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div v-if="activeRef" class="library-detail-inner">
            <div class="library-detail-primary">
              <div class="library-detail-title">{{ activeRef.title || `@${activeRef._key}` }}</div>
              <div class="library-detail-subtitle">
                {{ formatAuthors(activeRef) || t('Unknown author') }}
                <span v-if="extractYear(activeRef)"> · {{ extractYear(activeRef) }}</span>
                <span v-if="containerLabel(activeRef)"> · {{ containerLabel(activeRef) }}</span>
              </div>
              <div class="library-detail-pill-row">
                <span class="library-state-pill" :class="{ active: isInCurrentProject(activeRef._key) }">
                  {{ isInCurrentProject(activeRef._key) ? t('In current project') : t('Global only') }}
                </span>
                <span v-if="activeRef._needsReview" class="library-state-pill warning">{{ t('Needs review') }}</span>
                <span v-if="activeRef._pdfFile" class="library-state-pill">{{ t('PDF') }}</span>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-detail-grid">
                <template v-for="row in activeDetailRows" :key="row.label">
                  <div class="library-detail-label">{{ row.label }}</div>
                  <div class="library-detail-value">{{ row.value }}</div>
                </template>
              </div>

              <div class="library-detail-actions">
                <button type="button" class="library-inline-button" @click="toggleProjectMembership(activeRef._key)">
                  {{ isInCurrentProject(activeRef._key) ? t('Remove from this project') : t('Add to project') }}
                </button>
                <button
                  v-if="activePdfPath"
                  type="button"
                  class="library-quiet-button"
                  @click="openReferencePdf(activeRef._key)"
                >
                  {{ t('Open PDF') }}
                </button>
                <button type="button" class="library-quiet-button" @click="enterEditMode(activeRef._key)">
                  {{ t('Edit metadata') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-sidebar-row">
                <div class="library-section-label">{{ t('Tags') }}</div>
              </div>
              <div class="library-tags-cell detail">
                <span
                  v-for="tag in activeRef._tags || []"
                  :key="tag"
                  class="library-tag-chip"
                >
                  {{ tag }}
                </span>
                <span v-if="!activeRef._tags || activeRef._tags.length === 0" class="library-muted-copy">
                  {{ t('Untagged') }}
                </span>
              </div>
            </div>

            <div class="library-detail-section">
              <div class="library-section-label">
                {{ activeRef._summary ? t('Summary') : t('Abstract') }}
              </div>
              <div class="library-detail-copy">
                {{ activeSummaryText || t('No abstract available.') }}
              </div>
            </div>
          </div>

          <div v-else-if="isLibraryLoading" class="library-empty-state detail">
            <div class="library-empty-title">{{ t('Loading references...') }}</div>
            <div class="library-empty-copy">{{ t('Global library is loading for this project context.') }}</div>
          </div>

          <div v-else class="library-empty-state detail">
            <div class="library-empty-title">{{ t('No reference selected') }}</div>
            <div class="library-empty-copy">{{ t('Select a reference to inspect and manage it for the current project.') }}</div>
          </div>
        </aside>
      </template>
    </div>

    <AddReferenceDialog
      v-if="showImportDialog"
      @close="showImportDialog = false"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useI18n } from '../../i18n'
import AddReferenceDialog from '../sidebar/AddReferenceDialog.vue'

const LibraryReferenceEditor = defineAsyncComponent(() => import('./LibraryReferenceEditor.vue'))

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const { t } = useI18n()

const workbenchEl = ref(null)
const activeView = ref('all')
const searchQuery = ref('')
const sortKey = ref('added-desc')
const selectedTags = ref([])
const selectedKeys = ref([])
const tagActionInput = ref('')
const batchTagAction = ref('add')
const showImportDialog = ref(false)
const paneWidth = ref(0)
const compactSidebarOpen = ref(false)
const compactDetailOpen = ref(false)

const allRefs = computed(() => referencesStore.globalLibrary || [])
const selectedKeySet = computed(() => new Set(selectedKeys.value))
const projectKeySet = computed(() => new Set(referencesStore.workspaceKeys || []))
const activeKey = computed(() => referencesStore.activeKey || '')
const isEditing = computed(() => referencesStore.libraryDetailMode === 'edit' && !!activeRef.value)
const hasBatchSelection = computed(() => selectedKeys.value.length > 1)
const isLibraryLoading = computed(() => referencesStore.loading && allRefs.value.length === 0)
const isCompactPane = computed(() => paneWidth.value > 0 && paneWidth.value <= 1080)
const showCompactBackdrop = computed(() => isCompactPane.value && (compactSidebarOpen.value || compactDetailOpen.value))

const primaryViewOptions = computed(() => ([
  { id: 'all', label: t('All references'), count: allRefs.value.length },
  { id: 'project', label: t('Current project'), count: referencesStore.workspaceKeys.length },
]))

const smartViewOptions = computed(() => ([
  { id: 'with-pdf', label: t('With PDF'), count: allRefs.value.filter((refItem) => !!refItem._pdfFile).length },
  { id: 'needs-review', label: t('Needs review'), count: allRefs.value.filter((refItem) => !!refItem._needsReview).length },
]))

const sidebarViewOptions = computed(() => [
  ...primaryViewOptions.value,
  ...smartViewOptions.value,
])

const scopeFilteredRefs = computed(() => {
  const viewId = activeView.value
  switch (viewId) {
    case 'project':
      return allRefs.value.filter((refItem) => projectKeySet.value.has(refItem._key))
    case 'with-pdf':
      return allRefs.value.filter((refItem) => !!refItem._pdfFile)
    case 'needs-review':
      return allRefs.value.filter((refItem) => !!refItem._needsReview)
    case 'all':
    default:
      return allRefs.value
  }
})

const textFilteredRefs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return scopeFilteredRefs.value
  const tokens = query.split(/\s+/).filter(Boolean)
  return scopeFilteredRefs.value.filter((refItem) => {
    const haystack = [
      refItem.title || '',
      refItem._key || '',
      refItem.DOI || '',
      containerLabel(refItem),
      formatAuthors(refItem),
      extractYear(refItem),
      refItem.abstract || '',
      refItem._summary || '',
      refItem._readingNote || '',
      ...(refItem._tags || []),
    ].join(' ').toLowerCase()
    return tokens.every((token) => haystack.includes(token))
  })
})

const tagFacets = computed(() => {
  const counts = new Map()
  for (const refItem of textFilteredRefs.value) {
    for (const tag of refItem._tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
})

const filteredRefs = computed(() => {
  let list = textFilteredRefs.value
  if (selectedTags.value.length > 0) {
    list = list.filter((refItem) => {
      const tags = new Set(refItem._tags || [])
      return selectedTags.value.every((tag) => tags.has(tag))
    })
  }

  const copy = [...list]
  switch (sortKey.value) {
    case 'author-asc':
      return copy.sort((a, b) => formatAuthors(a).localeCompare(formatAuthors(b)))
    case 'title-asc':
      return copy.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    case 'year-asc':
      return copy.sort((a, b) => extractYear(a) - extractYear(b))
    case 'year-desc':
      return copy.sort((a, b) => extractYear(b) - extractYear(a))
    case 'added-desc':
    default:
      return copy.sort((a, b) => String(b._addedAt || '').localeCompare(String(a._addedAt || '')))
  }
})

const activeRef = computed(() => {
  if (referencesStore.activeKey) {
    return referencesStore.getByKey(referencesStore.activeKey)
  }
  if (filteredRefs.value.length > 0) return filteredRefs.value[0]
  return null
})

const activePdfPath = computed(() => {
  if (!activeRef.value?._key) return null
  return referencesStore.pdfPathForKey(activeRef.value._key)
})

const activeSummaryText = computed(() => {
  if (!activeRef.value) return ''
  return String(activeRef.value._summary || activeRef.value.abstract || '').trim()
})

const activeCitedCount = computed(() => {
  if (!activeRef.value?._key) return 0
  return referencesStore.citedIn[activeRef.value._key]?.length || 0
})

const activeDetailRows = computed(() => {
  if (!activeRef.value) return []

  const year = extractYear(activeRef.value)
  const container = containerLabel(activeRef.value)
  const rows = [
    { label: t('Key'), value: `@${activeRef.value._key}` },
    year > 0 ? { label: t('Year'), value: String(year) } : null,
    container ? { label: t('Journal / Conference'), value: container } : null,
    activeRef.value.DOI ? { label: 'DOI', value: activeRef.value.DOI } : null,
    {
      label: t('Cited in'),
      value: activeCitedCount.value > 0
        ? t('Cited in {count} files', { count: activeCitedCount.value })
        : t('Not cited'),
    },
  ]

  return rows.filter(Boolean)
})

function syncPaneWidth() {
  paneWidth.value = Math.round(workbenchEl.value?.clientWidth || 0)
}

let resizeObserver = null

onMounted(() => {
  syncPaneWidth()

  if (typeof ResizeObserver !== 'undefined' && workbenchEl.value) {
    resizeObserver = new ResizeObserver(() => {
      syncPaneWidth()
    })
    resizeObserver.observe(workbenchEl.value)
  }

  window.addEventListener('resize', syncPaneWidth)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect?.()
  resizeObserver = null
  window.removeEventListener('resize', syncPaneWidth)
})

watch(filteredRefs, (refs) => {
  const visibleKeys = new Set(refs.map((item) => item._key))
  selectedKeys.value = selectedKeys.value.filter((key) => visibleKeys.has(key))

  if (referencesStore.activeKey && referencesStore.getByKey(referencesStore.activeKey)) {
    if (isEditing.value) return
    if (visibleKeys.has(referencesStore.activeKey)) return
  }

  referencesStore.activeKey = refs[0]?._key || null
}, { immediate: true })

watch(allRefs, (refs) => {
  const availableKeys = new Set(refs.map((item) => item._key))
  selectedKeys.value = selectedKeys.value.filter((key) => availableKeys.has(key))
  if (referencesStore.activeKey && !availableKeys.has(referencesStore.activeKey)) {
    referencesStore.activeKey = null
    referencesStore.closeLibraryDetailMode()
  }
}, { deep: true })

watch(isCompactPane, (compact) => {
  if (!compact) {
    compactSidebarOpen.value = false
    compactDetailOpen.value = false
  }
})

watch(isEditing, (editing) => {
  if (editing) closeCompactPanels()
})

function formatAuthors(refItem = {}) {
  const authors = Array.isArray(refItem.author) ? refItem.author : []
  return authors
    .map((author) => author?.family || author?.given || '')
    .filter(Boolean)
    .join(', ')
}

function extractYear(refItem = {}) {
  return Number(refItem?.issued?.['date-parts']?.[0]?.[0] || 0)
}

function containerLabel(refItem = {}) {
  return refItem['container-title'] || refItem.publisher || ''
}

function parseTags(value = '') {
  return Array.from(new Set(
    String(value || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  ))
}

function visibleTags(refItem = {}) {
  return (refItem._tags || []).slice(0, 2)
}

function hiddenTagCount(refItem = {}) {
  return Math.max(0, (refItem._tags || []).length - 2)
}

function activateView(viewId) {
  activeView.value = viewId
  if (isCompactPane.value) compactSidebarOpen.value = false
}

function toggleTag(tag) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter((item) => item !== tag)
    if (isCompactPane.value) compactSidebarOpen.value = false
    return
  }
  selectedTags.value = [...selectedTags.value, tag]
  if (isCompactPane.value) compactSidebarOpen.value = false
}

function focusReference(key) {
  if (isCompactPane.value) compactSidebarOpen.value = false
  referencesStore.focusReferenceInLibrary(key, { mode: 'browse' })
}

function enterEditMode(key) {
  closeCompactPanels()
  referencesStore.focusReferenceInLibrary(key, { mode: 'edit' })
}

function exitEditMode() {
  referencesStore.closeLibraryDetailMode()
}

function toggleSelection(key) {
  if (selectedKeySet.value.has(key)) {
    selectedKeys.value = selectedKeys.value.filter((item) => item !== key)
    if (referencesStore.activeKey === key && selectedKeys.value.length > 0) {
      referencesStore.activeKey = selectedKeys.value[0]
    }
    return
  }
  selectedKeys.value = [...selectedKeys.value, key]
  referencesStore.activeKey = key
}

function clearSelection() {
  selectedKeys.value = []
}

function isInCurrentProject(key) {
  return projectKeySet.value.has(key)
}

function addSelectionToWorkspace() {
  for (const key of selectedKeys.value) {
    referencesStore.addKeyToWorkspace(key)
  }
}

function removeSelectionFromWorkspace() {
  if (selectedKeys.value.length === 0) return
  referencesStore.removeReferences(selectedKeys.value)
}

function toggleProjectMembership(key) {
  if (isInCurrentProject(key)) {
    referencesStore.removeReference(key)
    return
  }
  referencesStore.addKeyToWorkspace(key)
}

function openReferencePdf(key) {
  if (!key) return
  const pdfPath = referencesStore.pdfPathForKey(key)
  if (!pdfPath) return
  editorStore.openFile(pdfPath)
}

function applyTagAction(action) {
  const keys = selectedKeys.value
  const tags = parseTags(tagActionInput.value)
  if (keys.length === 0) return
  if (action === 'replace') {
    referencesStore.replaceTagsForReferences(keys, tags)
  } else if (action === 'remove') {
    referencesStore.removeTagsFromReferences(keys, tags)
  } else {
    referencesStore.addTagsToReferences(keys, tags)
  }
  tagActionInput.value = ''
}

function closeCompactPanels() {
  compactSidebarOpen.value = false
  compactDetailOpen.value = false
}

function toggleCompactSidebar() {
  if (!isCompactPane.value) return
  const next = !compactSidebarOpen.value
  compactDetailOpen.value = false
  compactSidebarOpen.value = next
}

function toggleCompactDetail() {
  if (!isCompactPane.value || !activeRef.value) return
  const next = !compactDetailOpen.value
  compactSidebarOpen.value = false
  compactDetailOpen.value = next
}

</script>

<style scoped>
.library-workbench {
  container-type: inline-size;
  position: relative;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--fg-primary);
  --library-label-size: var(--surface-font-kicker);
  --library-subtle-size: var(--surface-font-meta);
  --library-ui-size: var(--surface-font-body);
  --library-sidebar-title-size: var(--surface-font-card);
  --library-list-title-size: var(--surface-font-title);
  --library-detail-title-size: var(--surface-font-detail);
}

.library-shell {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr) 300px;
  background: var(--bg-secondary);
}

.library-shell.is-editing {
  grid-template-columns: 176px minmax(0, 1fr);
}

.library-sidebar,
.library-main,
.library-detail,
.library-editor-stage {
  min-height: 0;
}

.library-sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
  overflow: auto;
}

.library-sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 12px 10px;
  border-bottom: 1px solid var(--border);
}

.library-sidebar-head,
.library-detail-compact-head,
.library-compact-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.library-sidebar-row,
.library-toolbar-row,
.library-filter-row,
.library-batch-head,
.library-batch-actions,
.library-detail-actions,
.library-editor-actions,
.library-main-meta,
.library-detail-pill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.library-sidebar-row,
.library-filter-row,
.library-toolbar-row,
.library-batch-actions,
.library-detail-actions,
.library-editor-actions,
.library-main-meta,
.library-detail-pill-row {
  flex-wrap: wrap;
}

.library-section-label,
.library-detail-label {
  font-size: var(--library-label-size);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--fg-muted) 92%, var(--fg-primary));
  font-weight: 600;
}

.library-subsection-label {
  margin-top: 4px;
  font-size: var(--library-label-size);
  color: var(--fg-muted);
}

.library-detail-title,
.library-empty-title {
  margin: 0;
  color: var(--fg-primary);
  font-weight: 600;
}

.library-inline-empty,
.library-muted-copy,
.library-empty-copy,
.library-ref-meta,
.library-detail-subtitle,
.library-detail-value {
  font-size: var(--library-subtle-size);
  color: var(--fg-muted);
  line-height: 1.55;
}

.library-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 0 0;
  border-top: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
}

.library-sidebar-section:first-of-type {
  border-top: none;
  padding-top: 6px;
  padding-bottom: 6px;
}

.library-sidebar-section.grow {
  min-height: 0;
  flex: 1;
  padding-top: 12px;
  padding-bottom: 8px;
}

.library-nav-list,
.library-tag-list,
.library-filter-chip-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.library-filter-chip-row {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 6px;
}

.library-nav-list.is-secondary {
  gap: 2px;
}

.library-nav-list.is-secondary .library-nav-item {
  min-height: 23px;
  color: var(--fg-muted);
}

.library-nav-list.is-views {
  gap: 2px;
}

.library-tag-list {
  min-height: 0;
  overflow: auto;
}

.library-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-primary);
}

.library-toolbar,
.library-editor-toolbar {
  border-bottom: 1px solid var(--border);
}

.library-sidebar-header.is-compact {
  padding-top: 10px;
  padding-bottom: 8px;
}

.library-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--bg-hover));
  color: var(--fg-muted);
  font-size: var(--surface-font-title);
  line-height: 1;
  flex-shrink: 0;
}

.library-icon-button:hover {
  color: var(--fg-primary);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
  background: color-mix(in srgb, var(--bg-primary) 70%, var(--bg-hover));
}

.library-inline-label {
  color: var(--fg-muted);
}

.library-toolbar {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 7px 10px 6px;
  background: color-mix(in srgb, var(--bg-secondary) 82%, var(--bg-primary));
}

.library-compact-toolbar {
  display: none;
}

.library-search-shell {
  flex: 1 1 300px;
  min-width: 220px;
}

.library-search-input,
.library-select,
.library-batch-input {
  width: 100%;
  min-width: 0;
  height: 27px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--bg-hover));
  color: var(--fg-primary);
  outline: none;
  font-size: var(--library-ui-size);
}

.library-search-input:focus,
.library-select:focus,
.library-batch-input:focus {
  border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
  background: color-mix(in srgb, var(--bg-primary) 72%, var(--bg-hover));
}

.library-select {
  width: 164px;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 30px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--fg-muted) 50%),
    linear-gradient(135deg, var(--fg-muted) 50%, transparent 50%);
  background-position:
    calc(100% - 15px) calc(50% - 2px),
    calc(100% - 10px) calc(50% - 2px);
  background-size: 5px 5px;
  background-repeat: no-repeat;
}

.library-batch-row {
  display: flex;
  padding-top: 5px;
  border-top: 1px solid var(--border);
}

.library-batch-head {
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px 10px;
}

.library-batch-label {
  font-size: var(--library-ui-size);
  font-weight: 600;
  color: var(--fg-secondary);
}

.library-batch-actions {
  gap: 6px;
  align-items: stretch;
  flex: 1 1 auto;
}

.library-batch-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 29px;
  padding: 2px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 7px;
  background: color-mix(in srgb, var(--bg-primary) 58%, var(--bg-hover));
}

.library-batch-group:focus-within {
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border));
}

.library-batch-group.is-fluid {
  flex: 1 1 320px;
  min-width: 250px;
}

.library-batch-group.is-fluid .library-batch-input {
  flex: 1;
  min-width: 120px;
}

.library-batch-group .library-inline-button,
.library-batch-group .library-quiet-button,
.library-batch-group .library-select,
.library-batch-group .library-batch-input {
  border-color: transparent;
  background: transparent;
}

.library-batch-group .library-inline-button:hover:not(:disabled),
.library-batch-group .library-quiet-button:hover:not(:disabled) {
  background: var(--bg-hover);
}

.library-batch-actions .library-batch-input {
  flex: 1;
  min-width: 160px;
}

.library-batch-select {
  width: 126px;
  flex: 0 0 auto;
}

.library-nav-item,
.library-tag-row,
.library-inline-button,
.library-quiet-button,
.library-filter-chip {
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg-primary) 78%, var(--bg-hover));
  color: var(--fg-primary);
  transition: background-color 120ms, border-color 120ms, color 120ms;
}

.library-nav-item,
.library-tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 0 8px 0 10px;
}

.library-nav-list.is-views .library-nav-item {
  min-height: 24px;
  padding: 0 8px 0 8px;
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.library-tag-row {
  min-height: 22px;
  padding: 0 2px 0 6px;
  border: none;
  border-radius: 0;
  background: transparent;
}

.library-inline-button,
.library-quiet-button,
.library-filter-chip {
  height: 27px;
  padding: 0 8px;
  white-space: nowrap;
  flex-shrink: 0;
  font-size: var(--library-ui-size);
}

.library-nav-item,
.library-tag-row {
  font-size: var(--library-ui-size);
}

.library-tag-row {
  font-size: var(--library-label-size);
}

.library-nav-list.is-secondary .library-nav-item {
  background: color-mix(in srgb, var(--bg-primary) 62%, var(--bg-hover));
}

.library-nav-list.is-views .library-nav-item:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-color: transparent;
}

.library-nav-item:hover,
.library-tag-row:hover,
.library-inline-button:hover:not(:disabled),
.library-quiet-button:hover:not(:disabled),
.library-filter-chip:hover {
  background: color-mix(in srgb, var(--bg-primary) 68%, var(--bg-hover));
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border));
  color: var(--fg-primary);
}

.library-tag-row:hover {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  border-color: transparent;
}

.library-inline-button.is-primary {
  border-color: color-mix(in srgb, var(--accent) 38%, var(--border));
  background: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
  color: var(--accent);
}

.library-inline-button.is-primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 24%, var(--bg-hover));
  color: var(--accent);
}

.library-nav-item.is-active,
.library-tag-row.is-active,
.library-state-pill.active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-hover));
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent);
}

.library-nav-list.is-views .library-nav-item.is-active {
  border-color: transparent;
  box-shadow: none;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.library-tag-row.is-active {
  border-color: transparent;
  box-shadow: none;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.library-nav-count {
  min-width: 20px;
  height: 18px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--library-label-size);
  color: var(--fg-muted);
  border: 1px solid color-mix(in srgb, var(--border) 82%, var(--fg-muted));
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-secondary) 72%, var(--bg-primary));
}

.library-tag-row .library-nav-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: var(--library-label-size);
  border-color: color-mix(in srgb, var(--border) 74%, var(--fg-muted));
  background: transparent;
}

.library-link-button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, var(--fg-muted));
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg-primary) 78%, var(--bg-hover));
  color: var(--fg-secondary);
  font-size: var(--library-subtle-size);
}

.library-link-button:hover {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border));
  background: color-mix(in srgb, var(--bg-primary) 68%, var(--bg-hover));
  color: var(--fg-primary);
}

.library-count-pill,
.library-state-pill,
.library-tag-chip {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  border: 1px solid var(--border);
  border-radius: 999px;
}

.library-count-pill {
  height: 20px;
  padding: 0 7px;
  font-size: var(--library-subtle-size);
  color: var(--fg-muted);
  background: var(--bg-primary);
}

.library-state-pill,
.library-tag-chip {
  padding: 1px 6px;
  font-size: var(--library-label-size);
  color: var(--fg-secondary);
  background: var(--bg-primary);
}

.library-state-pill.warning {
  border-color: color-mix(in srgb, #d97706 45%, var(--border));
  color: #d97706;
  background: color-mix(in srgb, #d97706 10%, var(--bg-primary));
}

.library-tag-chip.muted {
  color: var(--fg-muted);
}

.library-table {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.library-table-header,
.library-table-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1.8fr) minmax(0, 0.8fr) 108px;
  gap: 10px;
}

.library-table-header {
  align-items: center;
  min-height: 28px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  font-size: var(--library-label-size);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-muted);
  position: sticky;
  top: 0;
  z-index: 1;
}

.library-table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.library-table-row {
  align-items: flex-start;
  padding: 7px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
  box-shadow: inset 0 0 0 1px transparent;
  cursor: default;
}

.library-table-row:hover {
  background: color-mix(in srgb, var(--bg-primary) 74%, var(--bg-hover));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, var(--border));
}

.library-table-row.is-focused {
  background: color-mix(in srgb, var(--bg-hover) 82%, var(--bg-primary));
  box-shadow:
    inset 2px 0 0 var(--accent),
    inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, var(--border));
}

.library-checkbox-cell {
  padding-top: 3px;
}

.library-ref-cell,
.library-project-cell {
  min-width: 0;
}

.library-ref-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.library-ref-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: var(--library-list-title-size);
  line-height: 1.32;
  color: var(--fg-primary);
  font-weight: 600;
}

.library-ref-meta {
  margin-top: 3px;
  line-height: 1.35;
}

.library-ref-key {
  margin-left: 6px;
  color: var(--fg-secondary);
}

.library-tags-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-top: 1px;
}

.library-project-cell {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding-top: 1px;
}

.library-detail {
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg-secondary);
  overflow: auto;
}

.library-detail-compact-head {
  display: none;
  min-height: 34px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-secondary) 90%, var(--bg-primary));
  position: sticky;
  top: 0;
  z-index: 2;
}

.library-editor-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 2;
}

.library-detail-inner {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 12px 12px 12px;
}

.library-detail-primary {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.library-detail-title {
  font-size: var(--library-detail-title-size);
  line-height: 1.22;
  font-weight: 600;
}

.library-detail-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.library-detail-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  align-items: stretch;
}

.library-detail-section.grow {
  flex: 1;
}

.library-detail-grid {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 5px 10px;
  align-items: start;
}

.library-detail-value {
  font-size: var(--library-subtle-size);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.library-detail-copy {
  font-size: var(--library-ui-size);
  line-height: 1.6;
  color: var(--fg-secondary);
  white-space: pre-wrap;
}

.library-detail-actions .library-inline-button,
.library-detail-actions .library-quiet-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 6px;
  font-size: var(--library-subtle-size);
  line-height: 1.1;
  letter-spacing: -0.01em;
  border-color: color-mix(in srgb, var(--border) 92%, var(--fg-muted));
  background: color-mix(in srgb, var(--bg-primary) 78%, var(--bg-hover));
  color: var(--fg-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.library-detail-actions .library-inline-button {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
  color: var(--accent);
}

.library-detail-actions .library-inline-button:hover:not(:disabled),
.library-detail-actions .library-quiet-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 76%, var(--bg-primary));
  border-color: color-mix(in srgb, var(--accent) 34%, var(--border));
  color: var(--fg-primary);
}

.library-detail-actions .library-inline-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-hover));
  color: var(--accent);
}

.library-editor-stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  grid-column: 2 / -1;
  background: var(--bg-primary);
}

.library-editor-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 360px;
}

.library-editor-actions {
  flex: 0 0 auto;
  margin-left: auto;
}

.library-editor-surface {
  flex: 1;
  min-height: 0;
}

.library-empty-state {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 38ch;
  padding: 22px 16px;
}

.library-empty-state.detail {
  padding-top: 14px;
}

.library-empty-title {
  font-size: var(--library-sidebar-title-size);
}

.library-inline-button:disabled,
.library-quiet-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.library-compact-backdrop {
  position: absolute;
  inset: 0;
  z-index: 3;
  border: none;
  background: color-mix(in srgb, var(--bg-primary) 30%, transparent);
  backdrop-filter: blur(1.5px);
}

@container (max-width: 1180px) {
  .library-shell {
    grid-template-columns: 168px minmax(0, 1fr) 268px;
  }

  .library-toolbar-row {
    gap: 6px;
  }

  .library-search-shell {
    flex-basis: 100%;
    min-width: 0;
  }

  .library-select {
    width: 148px;
  }

  .library-table-header,
  .library-table-row {
    grid-template-columns: 26px minmax(0, 1.55fr) minmax(0, 0.75fr) 94px;
    gap: 8px;
  }

  .library-detail-grid {
    grid-template-columns: 62px minmax(0, 1fr);
  }
}

@container (max-width: 1080px) {
  .library-shell,
  .library-shell.is-editing {
    grid-template-columns: minmax(0, 1fr);
  }

  .library-sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: min(248px, 74cqw);
    max-width: calc(100% - 28px);
    z-index: 4;
    pointer-events: none;
    transform: translateX(calc(-100% - 10px));
    transition: transform 180ms ease;
    box-shadow: 14px 0 32px color-mix(in srgb, var(--bg-primary) 22%, transparent);
  }

  .library-workbench.is-sidebar-drawer-open .library-sidebar {
    pointer-events: auto;
    transform: translateX(0);
  }

  .library-detail {
    position: absolute;
    inset: 0 0 0 auto;
    width: min(312px, 68cqw);
    max-width: calc(100% - 28px);
    z-index: 4;
    pointer-events: none;
    border-left: 1px solid var(--border);
    border-top: none;
    transform: translateX(calc(100% + 10px));
    transition: transform 180ms ease;
    box-shadow: -14px 0 32px color-mix(in srgb, var(--bg-primary) 22%, transparent);
  }

  .library-workbench.is-detail-drawer-open .library-detail {
    pointer-events: auto;
    transform: translateX(0);
  }

  .library-main,
  .library-editor-stage {
    grid-column: 1;
  }

  .library-compact-toolbar,
  .library-detail-compact-head {
    display: flex;
  }

  .library-toolbar {
    gap: 5px;
    padding: 8px 10px 7px;
  }

  .library-toolbar-row {
    gap: 6px;
  }

  .library-search-shell {
    flex-basis: 100%;
    min-width: 0;
  }

  .library-select,
  .library-inline-button.is-primary {
    flex: 1 1 0;
    width: auto;
  }

  .library-table-header,
  .library-table-row {
    grid-template-columns: 24px minmax(0, 1fr) 92px;
    gap: 8px;
  }

  .library-table-header > :nth-child(3),
  .library-tags-cell {
    display: none;
  }

  .library-ref-title {
    -webkit-line-clamp: 2;
  }

  .library-detail-inner {
    gap: 8px;
    padding: 10px 10px 12px;
  }

  .library-detail-title {
    font-size: var(--surface-font-card);
  }
}

@container (max-width: 760px) {
  .library-select,
  .library-inline-button.is-primary,
  .library-quiet-button {
    flex: 1 1 0;
    width: auto;
  }

  .library-table-header,
  .library-table-row {
    grid-template-columns: 24px minmax(0, 1fr) 84px;
  }

  .library-detail {
    width: min(100%, 360px);
  }

  .library-detail-grid {
    grid-template-columns: 56px minmax(0, 1fr);
    gap: 4px 8px;
  }

  .library-detail-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .library-detail-actions > :last-child {
    grid-column: 1 / -1;
  }
}

@container (max-width: 640px) {
  .library-table-header,
  .library-table-row {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .library-table-header > :nth-child(4),
  .library-project-cell {
    display: none;
  }
}
</style>
