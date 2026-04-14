import { defineStore } from 'pinia'
import { t } from '../i18n/index.js'
import {
  REFERENCE_COLLECTIONS,
  REFERENCE_FIXTURES,
  REFERENCE_LIBRARY_SECTIONS,
  REFERENCE_TAGS,
} from '../services/references/referenceLibraryFixtures.js'
import {
  buildDefaultReferenceLibrarySnapshot,
  normalizeReferenceLibrarySnapshot,
  readOrCreateReferenceLibrarySnapshot,
  writeReferenceLibrarySnapshot,
} from '../services/references/referenceLibraryIO.js'
import { mergeImportedReferences, parseBibTeXText } from '../services/references/bibtexImport.js'

function normalizedAuthorSortText(reference = {}) {
  const authors = Array.isArray(reference.authors) ? reference.authors : []
  if (authors.length > 0) {
    return authors.join(' ').trim().toLowerCase()
  }
  return String(reference.authorLine || '').trim().toLowerCase()
}

function buildCollectionKey(label = '') {
  const normalized = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || `collection-${Date.now()}`
}

function normalizeCollectionMembershipValue(value = '') {
  return String(value || '').trim().toLowerCase()
}

function resolveCollection(collections = [], collectionKey = '') {
  const normalizedKey = normalizeCollectionMembershipValue(collectionKey)
  if (!normalizedKey) return null

  return (
    collections.find((collection) => normalizeCollectionMembershipValue(collection.key) === normalizedKey) ||
    collections.find((collection) => normalizeCollectionMembershipValue(collection.label) === normalizedKey) ||
    null
  )
}

function referenceHasCollection(reference = {}, collection = null) {
  if (!collection) return false
  const collectionValues = Array.isArray(reference.collections) ? reference.collections : []
  const normalizedKey = normalizeCollectionMembershipValue(collection.key)
  const normalizedLabel = normalizeCollectionMembershipValue(collection.label)

  return collectionValues.some((value) => {
    const normalizedValue = normalizeCollectionMembershipValue(value)
    return normalizedValue === normalizedKey || normalizedValue === normalizedLabel
  })
}

function filterReferenceBySection(reference, sectionKey) {
  if (sectionKey === 'unfiled') return !reference.collections.length
  if (sectionKey === 'missing-identifier') return !String(reference.identifier || '').trim()
  if (sectionKey === 'missing-pdf') return !referenceHasPdf(reference)
  return true
}

function filterReferenceByCollection(reference, collectionKey, collections = []) {
  if (!collectionKey) return true
  const collection = resolveCollection(collections, collectionKey)
  if (!collection) return false
  return referenceHasCollection(reference, collection)
}

function referenceHasPdf(reference = {}) {
  return String(reference.pdfPath || '').trim().length > 0 || reference.hasPdf === true
}

function normalizedReferenceSearchText(reference = {}) {
  return [
    reference.title,
    ...(Array.isArray(reference.authors) ? reference.authors : []),
    reference.authorLine,
    reference.source,
    reference.citationKey,
    reference.identifier,
    reference.pages,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function compareReferences(a = {}, b = {}, sortKey = 'year-desc') {
  if (sortKey === 'year-asc') {
    return (
      Number(a.year || 0) - Number(b.year || 0) ||
      String(a.title || '').localeCompare(String(b.title || ''))
    )
  }
  if (sortKey === 'author-desc') {
    return (
      normalizedAuthorSortText(b).localeCompare(normalizedAuthorSortText(a)) ||
      String(a.title || '').localeCompare(String(b.title || ''))
    )
  }
  if (sortKey === 'author-asc') {
    return (
      normalizedAuthorSortText(a).localeCompare(normalizedAuthorSortText(b)) ||
      String(a.title || '').localeCompare(String(b.title || ''))
    )
  }
  if (sortKey === 'title-desc') {
    return (
      String(b.title || '').localeCompare(String(a.title || '')) ||
      Number(b.year || 0) - Number(a.year || 0)
    )
  }
  if (sortKey === 'title-asc') {
    return (
      String(a.title || '').localeCompare(String(b.title || '')) ||
      Number(b.year || 0) - Number(a.year || 0)
    )
  }
  return (
    Number(b.year || 0) - Number(a.year || 0) ||
    String(a.title || '').localeCompare(String(b.title || ''))
  )
}

export const useReferencesStore = defineStore('references', {
  state: () => ({
    librarySections: REFERENCE_LIBRARY_SECTIONS,
    collections: REFERENCE_COLLECTIONS,
    tags: REFERENCE_TAGS,
    references: REFERENCE_FIXTURES,
    selectedSectionKey: 'all',
    selectedCollectionKey: '',
    selectedReferenceId: REFERENCE_FIXTURES[0]?.id || '',
    searchQuery: '',
    sortKey: 'year-desc',
    isLoading: false,
    loadError: '',
    importInFlight: false,
  }),

  getters: {
    sectionCounts: (state) =>
      Object.fromEntries(
        state.librarySections.map((section) => [
          section.key,
          state.references.filter((reference) => filterReferenceBySection(reference, section.key)).length,
        ])
      ),

    collectionCounts: (state) =>
      Object.fromEntries(
        state.collections.map((collection) => [
          collection.key,
          state.references.filter((reference) => filterReferenceByCollection(reference, collection.key, state.collections))
            .length,
        ])
      ),

    selectedCollection: (state) => resolveCollection(state.collections, state.selectedCollectionKey),

    filteredReferences: (state) =>
      state.references
        .filter((reference) => filterReferenceBySection(reference, state.selectedSectionKey))
        .filter((reference) =>
          filterReferenceByCollection(reference, state.selectedCollectionKey, state.collections)
        )
        .filter((reference) => {
          const query = String(state.searchQuery || '').trim().toLowerCase()
          if (!query) return true
          return normalizedReferenceSearchText(reference).includes(query)
        })
        .slice()
        .sort((a, b) => compareReferences(a, b, state.sortKey)),

    selectedReference(state) {
      return (
        state.references.find((reference) => reference.id === state.selectedReferenceId) ||
        this.filteredReferences[0] ||
        null
      )
    },
  },

  actions: {
    async persistLibrarySnapshot(workspaceDataDir = '') {
      const snapshot = {
        version: 1,
        collections: this.collections,
        tags: this.tags,
        references: this.references,
      }
      await writeReferenceLibrarySnapshot(workspaceDataDir, snapshot)
      return snapshot
    },

    applyLibrarySnapshot(snapshot = {}) {
      const normalized = {
        ...buildDefaultReferenceLibrarySnapshot(),
        ...normalizeReferenceLibrarySnapshot(snapshot),
      }

      this.collections = normalized.collections
      this.tags = normalized.tags
      this.references = normalized.references
      if (!resolveCollection(this.collections, this.selectedCollectionKey)) {
        this.selectedCollectionKey = ''
      }

      if (!this.references.some((reference) => reference.id === this.selectedReferenceId)) {
        this.selectedReferenceId = this.references[0]?.id || ''
      }
    },

    async loadWorkspaceLibrary(workspaceDataDir = '') {
      this.isLoading = true
      this.loadError = ''

      try {
        const snapshot = await readOrCreateReferenceLibrarySnapshot(workspaceDataDir)
        this.applyLibrarySnapshot(snapshot)
      } catch (error) {
        this.loadError = error?.message || t('Failed to load reference library')
        this.applyLibrarySnapshot(buildDefaultReferenceLibrarySnapshot())
      } finally {
        this.isLoading = false
      }
    },

    async importBibTeXContent(workspaceDataDir = '', content = '') {
      const importedReferences = parseBibTeXText(content)
      const mergedReferences = mergeImportedReferences(this.references, importedReferences)
      const importedCount = Math.max(0, mergedReferences.length - this.references.length)

      this.importInFlight = true
      try {
        const snapshot = {
          version: 1,
          collections: this.collections,
          tags: this.tags,
          references: mergedReferences,
        }
        await writeReferenceLibrarySnapshot(workspaceDataDir, snapshot)
        this.applyLibrarySnapshot(snapshot)
        if (importedReferences[0]?.id) {
          const importedSelection = mergedReferences.find((reference) =>
            importedReferences.some((candidate) => candidate.id === reference.id)
          )
          if (importedSelection) {
            this.selectedReferenceId = importedSelection.id
          }
        }
        return importedCount
      } finally {
        this.importInFlight = false
      }
    },

    async createCollection(workspaceDataDir = '', label = '') {
      const trimmedLabel = String(label || '').trim()
      if (!trimmedLabel) return null

      const existingCollection = this.collections.find(
        (collection) => String(collection.label || '').trim().toLowerCase() === trimmedLabel.toLowerCase()
      )
      if (existingCollection) return existingCollection

      let key = buildCollectionKey(trimmedLabel)
      let suffix = 2
      while (this.collections.some((collection) => collection.key === key)) {
        key = `${buildCollectionKey(trimmedLabel)}-${suffix}`
        suffix += 1
      }

      const nextCollection = {
        key,
        label: trimmedLabel,
      }

      this.collections = [...this.collections, nextCollection]
      await this.persistLibrarySnapshot(workspaceDataDir)
      return nextCollection
    },

    setSelectedSection(sectionKey) {
      const exists = this.librarySections.some((section) => section.key === sectionKey)
      this.selectedSectionKey = exists ? sectionKey : 'all'
      this.selectedCollectionKey = ''
      if (!this.filteredReferences.some((reference) => reference.id === this.selectedReferenceId)) {
        this.selectedReferenceId = this.filteredReferences[0]?.id || ''
      }
    },

    setSelectedCollection(collectionKey = '') {
      const collection = resolveCollection(this.collections, collectionKey)
      this.selectedCollectionKey = collection?.key || ''
      this.selectedSectionKey = 'all'
      if (!this.filteredReferences.some((reference) => reference.id === this.selectedReferenceId)) {
        this.selectedReferenceId = this.filteredReferences[0]?.id || ''
      }
    },

    setSearchQuery(value = '') {
      this.searchQuery = String(value || '')
      if (!this.filteredReferences.some((reference) => reference.id === this.selectedReferenceId)) {
        this.selectedReferenceId = this.filteredReferences[0]?.id || ''
      }
    },

    setSortKey(value = '') {
      this.sortKey = [
        'year-desc',
        'year-asc',
        'title-asc',
        'title-desc',
        'author-asc',
        'author-desc',
      ].includes(value)
        ? value
        : 'year-desc'
      if (!this.filteredReferences.some((reference) => reference.id === this.selectedReferenceId)) {
        this.selectedReferenceId = this.filteredReferences[0]?.id || ''
      }
    },

    selectReference(referenceId) {
      if (!this.references.some((reference) => reference.id === referenceId)) return
      this.selectedReferenceId = referenceId
    },

    async toggleReferenceCollection(workspaceDataDir = '', referenceId = '', collectionKey = '') {
      const collection = resolveCollection(this.collections, collectionKey)
      if (!collection) return false

      const referenceIndex = this.references.findIndex((reference) => reference.id === referenceId)
      if (referenceIndex === -1) return false

      const reference = this.references[referenceIndex]
      const currentCollections = Array.isArray(reference.collections) ? reference.collections : []
      const isMember = referenceHasCollection(reference, collection)
      const nextCollections = currentCollections.filter((value) => {
        const normalizedValue = normalizeCollectionMembershipValue(value)
        return (
          normalizedValue !== normalizeCollectionMembershipValue(collection.key) &&
          normalizedValue !== normalizeCollectionMembershipValue(collection.label)
        )
      })

      if (!isMember) {
        nextCollections.push(collection.key)
      }

      this.references = this.references.map((candidate, index) =>
        index === referenceIndex
          ? {
              ...candidate,
              collections: nextCollections,
            }
          : candidate
      )

      await this.persistLibrarySnapshot(workspaceDataDir)
      return !isMember
    },

    cleanup() {
      this.collections = REFERENCE_COLLECTIONS
      this.tags = REFERENCE_TAGS
      this.references = REFERENCE_FIXTURES
      this.selectedSectionKey = 'all'
      this.selectedCollectionKey = ''
      this.selectedReferenceId = REFERENCE_FIXTURES[0]?.id || ''
      this.searchQuery = ''
      this.sortKey = 'year-desc'
      this.isLoading = false
      this.loadError = ''
      this.importInFlight = false
    },
  },
})
