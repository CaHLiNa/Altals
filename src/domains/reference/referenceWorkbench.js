import { normalizeReferenceCollections, normalizeReferenceTags } from './referenceMetadata'

const VALID_LIBRARY_SORT_KEYS = new Set(['added-desc', 'year-desc', 'year-asc', 'title-asc', 'author-asc'])

function createWorkbenchId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function sortByName(list = []) {
  return [...list].sort((left, right) => left.name.localeCompare(right.name))
}

function normalizeWorkbenchCollection(entry = {}, seenIds = new Set()) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  const preferredId = String(entry?.id || '').trim()
  let id = preferredId || createWorkbenchId('collection')
  while (seenIds.has(id)) {
    id = createWorkbenchId('collection')
  }
  seenIds.add(id)
  const now = new Date().toISOString()
  return {
    id,
    name,
    createdAt: String(entry?.createdAt || now),
    updatedAt: String(entry?.updatedAt || entry?.createdAt || now),
  }
}

export function normalizeSavedViewFilters(filters = {}) {
  const viewId = String(filters?.viewId || 'all').trim() || 'all'
  return {
    viewId,
    tags: normalizeReferenceTags(filters?.tags || []),
    searchQuery: String(filters?.searchQuery || '').trim(),
    sortKey: VALID_LIBRARY_SORT_KEYS.has(String(filters?.sortKey || '').trim())
      ? String(filters.sortKey).trim()
      : 'added-desc',
  }
}

function normalizeWorkbenchSavedView(entry = {}, seenIds = new Set()) {
  const name = String(entry?.name || '').trim()
  if (!name) return null
  const preferredId = String(entry?.id || '').trim()
  let id = preferredId || createWorkbenchId('view')
  while (seenIds.has(id)) {
    id = createWorkbenchId('view')
  }
  seenIds.add(id)
  const now = new Date().toISOString()
  return {
    id,
    name,
    filters: normalizeSavedViewFilters(entry?.filters || {}),
    createdAt: String(entry?.createdAt || now),
    updatedAt: String(entry?.updatedAt || entry?.createdAt || now),
  }
}

export function sanitizeReferenceWorkbenchState(payload = {}) {
  const collectionIds = new Set()
  const savedViewIds = new Set()
  const collections = (payload?.collections || [])
    .map((entry) => normalizeWorkbenchCollection(entry, collectionIds))
    .filter(Boolean)
  const savedViews = (payload?.savedViews || [])
    .map((entry) => normalizeWorkbenchSavedView(entry, savedViewIds))
    .filter(Boolean)
  return {
    version: Number(payload?.version) || 1,
    collections: sortByName(collections),
    savedViews: sortByName(savedViews),
  }
}

export function createReferenceWorkbenchCollection(collections = [], nameRaw = '') {
  const name = String(nameRaw || '').trim()
  if (!name) return { ok: false, error: 'Collection name is required.' }

  const existing = collections.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    return { ok: true, collection: existing, duplicated: true, collections }
  }

  const now = new Date().toISOString()
  const collection = {
    id: createWorkbenchId('collection'),
    name,
    createdAt: now,
    updatedAt: now,
  }
  return {
    ok: true,
    collection,
    duplicated: false,
    collections: sortByName([...collections, collection]),
  }
}

export function addReferenceCollection(ref = {}, collectionId = '') {
  const id = String(collectionId || '').trim()
  if (!id) return false

  const current = normalizeReferenceCollections(ref._collections || [])
  if (current.includes(id)) return false

  ref._collections = [...current, id]
  return true
}

export function removeReferenceCollection(ref = {}, collectionId = '') {
  const id = String(collectionId || '').trim()
  if (!id) return false

  const current = normalizeReferenceCollections(ref._collections || [])
  if (!current.includes(id)) return false

  const nextCollections = current.filter((item) => item !== id)
  if (nextCollections.length > 0) ref._collections = nextCollections
  else delete ref._collections
  return true
}

export function toggleReferenceCollection(ref = {}, collectionId = '') {
  const current = normalizeReferenceCollections(ref._collections || [])
  if (current.includes(String(collectionId || '').trim())) {
    return removeReferenceCollection(ref, collectionId)
  }
  return addReferenceCollection(ref, collectionId)
}

export function deleteReferenceWorkbenchCollection({
  collections = [],
  globalLibrary = [],
  savedViews = [],
  collectionId = '',
} = {}) {
  const id = String(collectionId || '').trim()
  if (!id) {
    return { ok: false, collections, savedViews, changedGlobalLibrary: false }
  }

  const exists = collections.some((entry) => entry.id === id)
  if (!exists) {
    return { ok: false, collections, savedViews, changedGlobalLibrary: false }
  }

  const nextCollections = collections.filter((entry) => entry.id !== id)
  let changedGlobalLibrary = false
  for (const refItem of globalLibrary) {
    changedGlobalLibrary = removeReferenceCollection(refItem, id) || changedGlobalLibrary
  }

  const nextSavedViews = savedViews.map((view) => {
    if (view.filters?.viewId !== `collection:${id}`) return view
    return {
      ...view,
      filters: normalizeSavedViewFilters({
        ...view.filters,
        viewId: 'all',
      }),
      updatedAt: new Date().toISOString(),
    }
  })

  return {
    ok: true,
    collections: nextCollections,
    savedViews: nextSavedViews,
    changedGlobalLibrary,
  }
}

export function createReferenceSavedView(savedViews = [], { name = '', filters = {} } = {}) {
  const nextName = String(name || '').trim()
  if (!nextName) return { ok: false, error: 'Saved view name is required.' }

  const existing = savedViews.find((entry) => entry.name.toLowerCase() === nextName.toLowerCase())
  if (existing) {
    return { ok: true, savedView: existing, duplicated: true, savedViews }
  }

  const now = new Date().toISOString()
  const savedView = {
    id: createWorkbenchId('view'),
    name: nextName,
    filters: normalizeSavedViewFilters(filters),
    createdAt: now,
    updatedAt: now,
  }
  return {
    ok: true,
    savedView,
    duplicated: false,
    savedViews: sortByName([...savedViews, savedView]),
  }
}

export function deleteReferenceSavedView(savedViews = [], savedViewId = '') {
  const id = String(savedViewId || '').trim()
  if (!id) return { ok: false, savedViews }

  const nextSavedViews = savedViews.filter((entry) => entry.id !== id)
  if (nextSavedViews.length === savedViews.length) {
    return { ok: false, savedViews }
  }

  return {
    ok: true,
    savedViews: nextSavedViews,
  }
}
