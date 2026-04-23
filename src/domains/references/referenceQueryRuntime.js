function normalizedAuthorSortText(reference = {}) {
  const authors = Array.isArray(reference.authors) ? reference.authors : []
  if (authors.length > 0) {
    return authors.join(' ').trim().toLowerCase()
  }
  return String(reference.authorLine || '').trim().toLowerCase()
}

function normalizeCollectionMembershipValue(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeTagKey(value = '') {
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
  if (sectionKey === 'missing-pdf') {
    return !(String(reference.pdfPath || '').trim().length > 0 || reference.hasPdf === true)
  }
  return true
}

function filterReferenceBySource(reference, sourceKey) {
  if (sourceKey === 'zotero') return String(reference?._source || '').trim().toLowerCase() === 'zotero'
  if (sourceKey === 'manual') return String(reference?._source || '').trim().toLowerCase() !== 'zotero'
  return true
}

function filterReferenceByCollection(reference, collectionKey, collections = []) {
  if (!collectionKey) return true
  const collection = resolveCollection(collections, collectionKey)
  if (!collection) return false
  return referenceHasCollection(reference, collection)
}

function filterReferenceByTag(reference, tagKey = '') {
  const normalizedTag = normalizeTagKey(tagKey)
  if (!normalizedTag) return true
  const tags = Array.isArray(reference?.tags) ? reference.tags : []
  return tags.some((value) => normalizeTagKey(typeof value === 'string' ? value : value?.key || value?.label) === normalizedTag)
}

function normalizeReferenceSearchTokens(reference = {}) {
  return [
    reference.title,
    ...(Array.isArray(reference.authors) ? reference.authors : []),
    reference.authorLine,
    reference.source,
    reference.citationKey,
    reference.identifier,
    reference.pages,
    ...(Array.isArray(reference.tags) ? reference.tags : []),
  ]
    .filter(Boolean)
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim().toLowerCase())
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

function buildCitationUsageIndex(fileContents = {}) {
  const usage = {}
  const markdownCitationRe = /\[([^\[\]]*@[a-zA-Z][\w.-]*[^\[\]]*)\]/g
  const markdownKeyRe = /@([a-zA-Z][\w.-]*)/g
  const latexCitationRe =
    /\\(?:cite[tp]?|citealp|citealt|citeauthor|citeyear|autocite|textcite|parencite|nocite|footcite|fullcite|supercite|smartcite|Cite[tp]?|Parencite|Textcite|Autocite|Smartcite|Footcite|Fullcite)\{([^}]*)\}/g
  const latexKeyRe = /([a-zA-Z][\w.-]*)/g

  for (const [path, content] of Object.entries(fileContents || {})) {
    if (!content || typeof content !== 'string') continue

    if (path.endsWith('.md')) {
      markdownCitationRe.lastIndex = 0
      let citationMatch = null
      while ((citationMatch = markdownCitationRe.exec(content)) !== null) {
        markdownKeyRe.lastIndex = 0
        let keyMatch = null
        while ((keyMatch = markdownKeyRe.exec(citationMatch[1])) !== null) {
          const key = keyMatch[1]
          if (!usage[key]) usage[key] = []
          if (!usage[key].includes(path)) usage[key].push(path)
        }
      }
      continue
    }

    if (path.endsWith('.tex') || path.endsWith('.latex')) {
      latexCitationRe.lastIndex = 0
      let citationMatch = null
      while ((citationMatch = latexCitationRe.exec(content)) !== null) {
        latexKeyRe.lastIndex = 0
        let keyMatch = null
        while ((keyMatch = latexKeyRe.exec(citationMatch[1])) !== null) {
          const key = keyMatch[1]
          if (!usage[key]) usage[key] = []
          if (!usage[key].includes(path)) usage[key].push(path)
        }
      }
    }
  }

  return usage
}

export function resolveReferenceQueryStateLocally({
  librarySections = [],
  sourceSections = [],
  collections = [],
  tags = [],
  references = [],
  selectedSectionKey = 'all',
  selectedSourceKey = '',
  selectedCollectionKey = '',
  selectedTagKey = '',
  searchQuery = '',
  sortKey = 'year-desc',
  fileContents = {},
} = {}) {
  const normalizedSelectedSectionKey = librarySections.some((section) => section.key === selectedSectionKey)
    ? selectedSectionKey
    : 'all'
  const normalizedSelectedSourceKey = sourceSections.some((section) => section.key === selectedSourceKey)
    ? selectedSourceKey
    : ''
  const normalizedSelectedCollectionKey = resolveCollection(collections, selectedCollectionKey)?.key || ''
  const normalizedSelectedTagKey = tags.some((tag) => normalizeTagKey(tag.key) === normalizeTagKey(selectedTagKey))
    ? normalizeTagKey(selectedTagKey)
    : ''
  const normalizedSortKey = [
    'year-desc',
    'year-asc',
    'title-asc',
    'title-desc',
    'author-asc',
    'author-desc',
  ].includes(sortKey)
    ? sortKey
    : 'year-desc'
  const normalizedSearchQuery = String(searchQuery || '')

  const sortedReferences = references.slice().sort((a, b) => compareReferences(a, b, normalizedSortKey))
  const loweredQuery = normalizedSearchQuery.trim().toLowerCase()
  const filteredReferences = sortedReferences
    .filter((reference) => filterReferenceBySection(reference, normalizedSelectedSectionKey))
    .filter((reference) => filterReferenceBySource(reference, normalizedSelectedSourceKey))
    .filter((reference) => filterReferenceByCollection(reference, normalizedSelectedCollectionKey, collections))
    .filter((reference) => filterReferenceByTag(reference, normalizedSelectedTagKey))
    .filter((reference) => {
      if (!loweredQuery) return true
      return normalizeReferenceSearchTokens(reference).some((token) => token.includes(loweredQuery))
    })

  return {
    query: {
      selectedSectionKey: normalizedSelectedSectionKey,
      selectedSourceKey: normalizedSelectedSourceKey,
      selectedCollectionKey: normalizedSelectedCollectionKey,
      selectedTagKey: normalizedSelectedTagKey,
      searchQuery: normalizedSearchQuery,
      sortKey: normalizedSortKey,
    },
    sectionCounts: Object.fromEntries(
      librarySections.map((section) => [
        section.key,
        references.filter((reference) => filterReferenceBySection(reference, section.key)).length,
      ])
    ),
    sourceCounts: Object.fromEntries(
      sourceSections.map((section) => [
        section.key,
        references.filter((reference) => filterReferenceBySource(reference, section.key)).length,
      ])
    ),
    collectionCounts: Object.fromEntries(
      collections.map((collection) => [
        collection.key,
        references.filter((reference) => filterReferenceByCollection(reference, collection.key, collections)).length,
      ])
    ),
    tagCounts: Object.fromEntries(
      tags.map((tag) => [
        tag.key,
        references.filter((reference) => filterReferenceByTag(reference, tag.key)).length,
      ])
    ),
    sortedReferences,
    filteredReferences,
    citationUsageIndex: buildCitationUsageIndex(fileContents),
  }
}
