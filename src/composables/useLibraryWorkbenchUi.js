import { computed, onUnmounted, ref } from 'vue'
import { useReferencesStore } from '../stores/references'
import { useI18n } from '../i18n'

const activeView = ref('all')
const searchQuery = ref('')
const sortKey = ref('added-desc')
const selectedTags = ref([])
const selectedKeys = ref([])
const tagActionInput = ref('')
const batchTagAction = ref('add')
const showImportDialog = ref(false)

let consumerCount = 0

function resetLibraryWorkbenchUi() {
  activeView.value = 'all'
  searchQuery.value = ''
  sortKey.value = 'added-desc'
  selectedTags.value = []
  selectedKeys.value = []
  tagActionInput.value = ''
  batchTagAction.value = 'add'
  showImportDialog.value = false
}

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
      .filter(Boolean),
  ))
}

function visibleTags(refItem = {}) {
  return (refItem._tags || []).slice(0, 2)
}

function hiddenTagCount(refItem = {}) {
  return Math.max(0, (refItem._tags || []).length - 2)
}

export function useLibraryWorkbenchUi() {
  consumerCount += 1
  onUnmounted(() => {
    consumerCount = Math.max(0, consumerCount - 1)
    if (consumerCount === 0) {
      resetLibraryWorkbenchUi()
    }
  })

  const referencesStore = useReferencesStore()
  const { t } = useI18n()

  const allRefs = computed(() => referencesStore.globalLibrary || [])
  const selectedKeySet = computed(() => new Set(selectedKeys.value))
  const projectKeySet = computed(() => new Set(referencesStore.workspaceKeys || []))
  const activeKey = computed(() => referencesStore.activeKey || '')
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
  const isLibraryLoading = computed(() => referencesStore.loading && allRefs.value.length === 0)
  const hasBatchSelection = computed(() => selectedKeys.value.length > 1)
  const hasSelection = computed(() => selectedKeys.value.length > 0)
  const hasSelectionInProject = computed(() => selectedKeys.value.some((key) => projectKeySet.value.has(key)))
  const hasActiveFilters = computed(() => (
    activeView.value !== 'all'
    || searchQuery.value.trim().length > 0
    || selectedTags.value.length > 0
  ))

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

  const librarySortOptions = computed(() => ([
    { id: 'added-desc', label: t('Date added (newest)') },
    { id: 'year-desc', label: t('Year (newest)') },
    { id: 'year-asc', label: t('Year (oldest)') },
    { id: 'title-asc', label: t('Title A → Z') },
    { id: 'author-asc', label: t('Author A → Z') },
  ]))

  const scopeFilteredRefs = computed(() => {
    switch (activeView.value) {
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

  const activeDetailRows = computed(() => {
    if (!activeRef.value) return []

    const year = extractYear(activeRef.value)
    const container = containerLabel(activeRef.value)
    return [
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
    ].filter(Boolean)
  })

  function clearFilters() {
    activeView.value = 'all'
    searchQuery.value = ''
    selectedTags.value = []
  }

  function activateView(viewId) {
    activeView.value = viewId
  }

  function clearSelectedTags() {
    selectedTags.value = []
  }

  function toggleTag(tag) {
    if (selectedTags.value.includes(tag)) {
      selectedTags.value = selectedTags.value.filter((item) => item !== tag)
      return
    }
    selectedTags.value = [...selectedTags.value, tag]
  }

  function clearSelection() {
    selectedKeys.value = []
  }

  function isInCurrentProject(key) {
    return projectKeySet.value.has(key)
  }

  return {
    activeView,
    searchQuery,
    sortKey,
    selectedTags,
    selectedKeys,
    tagActionInput,
    batchTagAction,
    showImportDialog,
    allRefs,
    selectedKeySet,
    projectKeySet,
    activeKey,
    activeRef,
    activePdfPath,
    activeSummaryText,
    activeCitedCount,
    activeDetailRows,
    isLibraryLoading,
    hasBatchSelection,
    hasSelection,
    hasSelectionInProject,
    hasActiveFilters,
    sidebarViewOptions,
    librarySortOptions,
    tagFacets,
    filteredRefs,
    formatAuthors,
    extractYear,
    containerLabel,
    parseTags,
    visibleTags,
    hiddenTagCount,
    clearFilters,
    activateView,
    clearSelectedTags,
    toggleTag,
    clearSelection,
    isInCurrentProject,
  }
}

