<template>
  <div class="library-workbench h-full min-h-0">
    <div class="library-shell h-full min-h-0" :class="{ 'is-editing': isEditing }">
      <aside class="library-sidebar">
        <div class="library-sidebar-header">
          <button type="button" class="library-back-button" @click="returnToWorkspace">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7">
              <path d="M9.5 3.5L5 8l4.5 4.5" />
            </svg>
            <span>{{ t('Back to workspace') }}</span>
          </button>
          <div class="library-sidebar-meta">
            <div class="library-section-label">{{ t('Current workspace') }}</div>
            <div class="library-sidebar-workspace-name">{{ workspaceName }}</div>
          </div>
        </div>

        <section class="library-sidebar-section">
          <div class="library-section-label">{{ t('Views') }}</div>
          <div class="library-nav-list">
            <button
              v-for="view in viewOptions"
              :key="view.id"
              type="button"
              class="library-nav-item"
              :class="{ 'is-active': activeView === view.id }"
              @click="activeView = view.id"
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
              <div class="library-editor-title-row">
                <div class="library-editor-title">{{ activeRef.title || `@${activeRef._key}` }}</div>
                <span class="library-state-pill active">@{{ activeRef._key }}</span>
              </div>
            </div>

            <div class="library-editor-actions">
              <button type="button" class="library-inline-button" @click="exitEditMode">
                {{ t('Back to list') }}
              </button>
              <button
                v-if="activePdfPath"
                type="button"
                class="library-inline-button"
                @click="openReferencePdf(activeRef._key)"
              >
                {{ t('Open PDF') }}
              </button>
            </div>
          </div>

          <div class="library-editor-surface">
            <ReferenceView
              :refKey="activeRef._key"
              :embedded="true"
              @close-embedded="handleEmbeddedEditorClose"
            />
          </div>
        </section>
      </template>

      <template v-else>
        <main class="library-main">
          <div class="library-main-header">
            <div class="library-main-heading">
              <div class="library-main-title-row">
                <h2 class="library-main-title">{{ t('Global library') }}</h2>
              </div>
            </div>
          </div>

          <div class="library-toolbar">
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
                <button type="button" class="library-link-button" @click="clearSelection">
                  {{ t('Clear') }}
                </button>
              </div>

              <div class="library-batch-actions">
                <button type="button" class="library-inline-button" @click="addSelectionToWorkspace">
                  {{ t('Add to project') }}
                </button>
                <button type="button" class="library-inline-button" @click="removeSelectionFromWorkspace">
                  {{ t('Remove from this project') }}
                </button>
                <input
                  v-model="tagActionInput"
                  class="library-batch-input"
                  :placeholder="t('comma-separated')"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
                <button type="button" class="library-inline-button" @click="applyTagAction('add')">
                  {{ t('Add tags') }}
                </button>
                <button type="button" class="library-inline-button" @click="applyTagAction('replace')">
                  {{ t('Replace tags') }}
                </button>
                <button type="button" class="library-inline-button" @click="applyTagAction('remove')">
                  {{ t('Remove tags') }}
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
                  <div class="library-empty-copy">{{ t('Global library is loading for the current workspace.') }}</div>
                </div>
              </template>

              <template v-else-if="filteredRefs.length === 0">
                <div class="library-empty-state">
                  <div class="library-empty-title">{{ t('No references found.') }}</div>
                  <div class="library-empty-copy">{{ t('Try another view, clear tag filters, or adjust the search query.') }}</div>
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
          <div class="library-pane-header">
            <div class="library-section-label">{{ t('Reference detail') }}</div>
            <div v-if="activeRef" class="library-detail-toolbar">
              <button type="button" class="library-inline-button" @click="enterEditMode(activeRef._key)">
                {{ t('View Details') }}
              </button>
              <button
                v-if="activePdfPath"
                type="button"
                class="library-inline-button"
                @click="openReferencePdf(activeRef._key)"
              >
                {{ t('Open PDF') }}
              </button>
            </div>
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
                <div class="library-detail-label">{{ t('Key') }}</div>
                <div class="library-detail-value">@{{ activeRef._key }}</div>
                <div class="library-detail-label">DOI</div>
                <div class="library-detail-value">{{ activeRef.DOI || t('None') }}</div>
                <div class="library-detail-label">{{ t('Scope') }}</div>
                <div class="library-detail-value">
                  {{ isInCurrentProject(activeRef._key) ? t('In current project') : t('Global only') }}
                </div>
              </div>

              <div class="library-detail-actions">
                <button type="button" class="library-inline-button" @click="toggleProjectMembership(activeRef._key)">
                  {{ isInCurrentProject(activeRef._key) ? t('Remove from this project') : t('Add to project') }}
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
              <div class="library-detail-tag-edit">
                <input
                  v-model="detailTagsInput"
                  class="library-batch-input"
                  :placeholder="t('comma-separated')"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
                <button type="button" class="library-inline-button" @click="saveDetailTags">
                  {{ t('Save tags') }}
                </button>
              </div>
            </div>

            <div class="library-detail-section grow">
              <div class="library-section-label">{{ t('Abstract') }}</div>
              <div class="library-abstract">
                {{ activeRef.abstract || t('No abstract available.') }}
              </div>
            </div>
          </div>

          <div v-else-if="isLibraryLoading" class="library-empty-state detail">
            <div class="library-empty-title">{{ t('Loading references...') }}</div>
            <div class="library-empty-copy">{{ t('Global library is loading for the current workspace.') }}</div>
          </div>

          <div v-else class="library-empty-state detail">
            <div class="library-empty-title">{{ t('No reference selected') }}</div>
            <div class="library-empty-copy">{{ t('Select a reference from the global library to inspect and manage it.') }}</div>
          </div>
        </aside>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { useI18n } from '../../i18n'

const ReferenceView = defineAsyncComponent(() => import('../editor/ReferenceView.vue'))

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()
const { t } = useI18n()

const activeView = ref('all')
const searchQuery = ref('')
const sortKey = ref('added-desc')
const selectedTags = ref([])
const selectedKeys = ref([])
const tagActionInput = ref('')
const detailTagsInput = ref('')

const workspaceName = computed(() => workspace.path?.split('/').pop() || t('No workspace'))
const allRefs = computed(() => referencesStore.globalLibrary || [])
const selectedKeySet = computed(() => new Set(selectedKeys.value))
const projectKeySet = computed(() => new Set(referencesStore.workspaceKeys || []))
const activeKey = computed(() => referencesStore.activeKey || '')
const isEditing = computed(() => referencesStore.libraryDetailMode === 'edit' && !!activeRef.value)
const hasBatchSelection = computed(() => selectedKeys.value.length > 1)
const isLibraryLoading = computed(() => referencesStore.loading && allRefs.value.length === 0)

const viewOptions = computed(() => ([
  { id: 'all', label: t('All references'), count: allRefs.value.length },
  { id: 'project', label: t('Current project'), count: referencesStore.workspaceKeys.length },
  { id: 'with-pdf', label: t('With PDF'), count: allRefs.value.filter((refItem) => !!refItem._pdfFile).length },
  { id: 'needs-review', label: t('Needs review'), count: allRefs.value.filter((refItem) => !!refItem._needsReview).length },
  { id: 'untagged', label: t('Untagged'), count: allRefs.value.filter((refItem) => !refItem._tags || refItem._tags.length === 0).length },
]))

const activeViewLabel = computed(() => {
  return viewOptions.value.find((item) => item.id === activeView.value)?.label || t('All references')
})

const projectRefsCount = computed(() => referencesStore.workspaceKeys.length)
const refsWithPdfCount = computed(() => allRefs.value.filter((refItem) => !!refItem._pdfFile).length)

const scopeFilteredRefs = computed(() => {
  switch (activeView.value) {
    case 'project':
      return allRefs.value.filter((refItem) => projectKeySet.value.has(refItem._key))
    case 'with-pdf':
      return allRefs.value.filter((refItem) => !!refItem._pdfFile)
    case 'needs-review':
      return allRefs.value.filter((refItem) => !!refItem._needsReview)
    case 'untagged':
      return allRefs.value.filter((refItem) => !refItem._tags || refItem._tags.length === 0)
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

watch(activeRef, (refItem) => {
  detailTagsInput.value = (refItem?._tags || []).join(', ')
}, { immediate: true })

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

function toggleTag(tag) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter((item) => item !== tag)
    return
  }
  selectedTags.value = [...selectedTags.value, tag]
}

function focusReference(key) {
  referencesStore.focusReferenceInLibrary(key, { mode: 'browse' })
}

function enterEditMode(key) {
  referencesStore.focusReferenceInLibrary(key, { mode: 'edit' })
}

function exitEditMode() {
  referencesStore.closeLibraryDetailMode()
}

function handleEmbeddedEditorClose() {
  referencesStore.closeLibraryDetailMode()
  if (!referencesStore.activeKey && filteredRefs.value[0]?._key) {
    referencesStore.activeKey = filteredRefs.value[0]._key
  }
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
  workspace.showEditorSurface()
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

function saveDetailTags() {
  if (!activeRef.value?._key) return
  referencesStore.replaceTagsForReferences([activeRef.value._key], parseTags(detailTagsInput.value))
}

function returnToWorkspace() {
  workspace.showEditorSurface()
}
</script>

<style scoped>
.library-workbench {
  background: var(--bg-primary);
  color: var(--fg-primary);
}

.library-shell {
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 320px;
  background: var(--bg-secondary);
}

.library-shell.is-editing {
  grid-template-columns: 196px minmax(0, 1fr);
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
  gap: 10px;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
  overflow: auto;
}

.library-sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 10px 9px;
  border-bottom: 1px solid var(--border);
}

.library-sidebar-row,
.library-toolbar-row,
.library-filter-row,
.library-batch-head,
.library-batch-actions,
.library-detail-toolbar,
.library-detail-actions,
.library-detail-tag-edit,
.library-editor-actions,
.library-editor-title-row,
.library-main-title-row,
.library-main-meta,
.library-detail-pill-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.library-sidebar-row,
.library-filter-row,
.library-batch-actions,
.library-detail-toolbar,
.library-detail-actions,
.library-detail-tag-edit,
.library-editor-actions,
.library-main-meta,
.library-detail-pill-row {
  flex-wrap: wrap;
}

.library-section-label,
.library-detail-label {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.library-main-title,
.library-editor-title,
.library-detail-title,
.library-empty-title {
  margin: 0;
  color: var(--fg-primary);
  font-weight: 650;
}

.library-inline-empty,
.library-muted-copy,
.library-empty-copy,
.library-ref-meta,
.library-detail-subtitle,
.library-detail-value,
.library-abstract {
  font-size: 12px;
  color: var(--fg-muted);
}

.library-sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 8px;
}

.library-sidebar-section.grow {
  min-height: 0;
  flex: 1;
  padding-bottom: 10px;
}

.library-nav-list,
.library-tag-list,
.library-filter-chip-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

.library-main-header,
.library-toolbar,
.library-editor-toolbar,
.library-pane-header {
  border-bottom: 1px solid var(--border);
}

.library-main-header {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px 8px;
  background: var(--bg-secondary);
}

.library-main-heading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.library-main-title {
  font-size: 18px;
  line-height: 1.2;
}

.library-back-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  line-height: 1.2;
  transition: color 120ms, opacity 120ms;
}

.library-back-button:hover {
  color: var(--fg-primary);
}

.library-back-button svg {
  width: 10px;
  height: 10px;
  opacity: 0.8;
}

.library-sidebar-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.library-sidebar-workspace-name {
  font-size: 14px;
  line-height: 1.2;
  color: var(--fg-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-inline-label {
  color: var(--fg-muted);
}

.library-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
}

.library-search-shell {
  flex: 1;
  min-width: 220px;
}

.library-search-input,
.library-select,
.library-batch-input {
  width: 100%;
  min-width: 0;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-primary);
  color: var(--fg-primary);
  outline: none;
}

.library-select {
  width: 170px;
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
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.library-batch-head {
  justify-content: space-between;
}

.library-batch-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-secondary);
}

.library-batch-actions .library-batch-input {
  flex: 1;
  min-width: 180px;
}

.library-nav-item,
.library-tag-row,
.library-inline-button,
.library-quiet-button,
.library-filter-chip {
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-secondary);
  transition: background-color 120ms, border-color 120ms, color 120ms;
}

.library-nav-item,
.library-tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 26px;
  padding: 0 6px 0 10px;
  border-left: 2px solid transparent;
  border-radius: 0 6px 6px 0;
}

.library-inline-button,
.library-quiet-button,
.library-filter-chip {
  height: 28px;
  padding: 0 9px;
}

.library-nav-item:hover,
.library-tag-row:hover,
.library-inline-button:hover:not(:disabled),
.library-quiet-button:hover:not(:disabled),
.library-filter-chip:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.library-nav-item.is-active,
.library-tag-row.is-active,
.library-state-pill.active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-hover));
  border-color: transparent;
  border-left-color: var(--accent);
  color: var(--accent);
}

.library-nav-count {
  min-width: 22px;
  text-align: right;
  font-size: 11px;
  color: var(--fg-muted);
}

.library-link-button {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  padding: 0;
  font-size: 12px;
}

.library-link-button:hover {
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
  font-size: 11px;
  color: var(--fg-muted);
  background: var(--bg-primary);
}

.library-state-pill,
.library-tag-chip {
  padding: 1px 7px;
  font-size: 11px;
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
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.library-table-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.library-table-row {
  align-items: flex-start;
  padding: 8px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 62%, transparent);
  cursor: default;
}

.library-table-row:hover {
  background: var(--bg-hover);
}

.library-table-row.is-focused {
  background: color-mix(in srgb, var(--bg-hover) 82%, var(--bg-primary));
  box-shadow: inset 2px 0 0 var(--accent);
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
  font-size: 14px;
  line-height: 1.32;
  color: var(--fg-primary);
  font-weight: 650;
}

.library-ref-meta {
  margin-top: 4px;
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

.library-pane-header,
.library-editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  padding: 8px 12px;
  background: var(--bg-secondary);
}

.library-detail-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.library-detail-primary {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.library-detail-title {
  font-size: 18px;
  line-height: 1.34;
}

.library-detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.library-detail-section.grow {
  flex: 1;
}

.library-detail-grid {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 6px 10px;
  align-items: start;
}

.library-detail-value {
  overflow-wrap: anywhere;
}

.library-abstract {
  line-height: 1.58;
  white-space: pre-wrap;
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
}

.library-editor-title {
  font-size: 15px;
  line-height: 1.3;
}

.library-editor-surface {
  flex: 1;
  min-height: 0;
}

.library-empty-state {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 12px;
}

.library-empty-state.detail {
  padding-top: 14px;
}

.library-empty-title {
  font-size: 15px;
}

.library-inline-button:disabled,
.library-quiet-button:disabled {
  opacity: 0.45;
  cursor: default;
}

@media (max-width: 1260px) {
  .library-shell {
    grid-template-columns: 188px minmax(0, 1fr) 296px;
  }
}

@media (max-width: 980px) {
  .library-shell,
  .library-shell.is-editing {
    grid-template-columns: 1fr;
  }

  .library-sidebar,
  .library-detail {
    border: none;
  }

  .library-sidebar {
    border-bottom: 1px solid var(--border);
  }

  .library-detail {
    border-top: 1px solid var(--border);
    max-height: 42%;
  }

  .library-editor-stage {
    grid-column: auto;
  }

  .library-main-header {
    flex-direction: column;
  }
}
</style>
