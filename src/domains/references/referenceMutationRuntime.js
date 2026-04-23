function normalizeCollectionMembershipValue(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeCollectionLabel(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeTagKey(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeTagLabel(value = '') {
  return String(value || '').trim()
}

function normalizeTagEntry(value = null) {
  if (typeof value === 'string') {
    const label = normalizeTagLabel(value)
    if (!label) return null
    return {
      key: normalizeTagKey(label),
      label,
    }
  }

  if (!value || typeof value !== 'object') return null
  const label = normalizeTagLabel(value.label || value.name || value.key || '')
  if (!label) return null

  return {
    ...value,
    key: normalizeTagKey(value.key || label),
    label,
  }
}

function buildTagRegistry(existingTags = [], references = []) {
  const registry = new Map()

  for (const entry of Array.isArray(existingTags) ? existingTags : []) {
    const normalized = normalizeTagEntry(entry)
    if (!normalized?.key) continue
    registry.set(normalized.key, normalized)
  }

  for (const reference of Array.isArray(references) ? references : []) {
    for (const value of Array.isArray(reference?.tags) ? reference.tags : []) {
      const normalized = normalizeTagEntry(value)
      if (!normalized?.key || registry.has(normalized.key)) continue
      registry.set(normalized.key, normalized)
    }
  }

  return [...registry.values()].sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')))
}

function normalizeCollectionEntries(collections = []) {
  const seen = new Set()
  return (Array.isArray(collections) ? collections : [])
    .map((collection) => {
      const label = String(collection?.label || collection?.key || '').trim()
      const key = normalizeCollectionMembershipValue(collection?.key || label)
      if (!label || !key || seen.has(key)) return null
      seen.add(key)
      return { key, label }
    })
    .filter(Boolean)
}

function normalizeSnapshot(snapshot = {}) {
  const references = Array.isArray(snapshot?.references) ? snapshot.references : []
  const collections = normalizeCollectionEntries(snapshot?.collections)
  return {
    version: Number(snapshot?.version) || 2,
    legacyMigrationComplete: snapshot?.legacyMigrationComplete === true,
    citationStyle: String(snapshot?.citationStyle || 'apa').trim() || 'apa',
    collections,
    tags: buildTagRegistry(snapshot?.tags, references),
    references,
  }
}

function buildCollectionKey(label = '') {
  const normalized = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'collection'
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

function titleSimilarity(left = '', right = '') {
  const tokenize = (value) =>
    new Set(
      String(value || '')
        .trim()
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fff]+/)
        .filter(Boolean)
    )
  const leftTokens = tokenize(left)
  const rightTokens = tokenize(right)
  if (!leftTokens.size || !rightTokens.size) return 0

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1
  }
  const union = new Set([...leftTokens, ...rightTokens]).size
  return union > 0 ? intersection / union : 0
}

function findDuplicateReferenceLocally(existing = [], candidate = {}) {
  const candidateCitationKey = String(candidate?.citationKey || '').trim().toLowerCase()
  const candidateIdentifier = String(candidate?.identifier || '').trim().toLowerCase()
  const candidateTitle = String(candidate?.title || '').trim().toLowerCase()
  const candidateYear = Number(candidate?.year || 0)

  return (Array.isArray(existing) ? existing : []).find((current) => {
    const currentCitationKey = String(current?.citationKey || '').trim().toLowerCase()
    if (candidateCitationKey && currentCitationKey && candidateCitationKey === currentCitationKey) {
      return true
    }

    const currentIdentifier = String(current?.identifier || '').trim().toLowerCase()
    if (candidateIdentifier && currentIdentifier && candidateIdentifier === currentIdentifier) {
      return true
    }

    const currentTitle = String(current?.title || '').trim().toLowerCase()
    const currentYear = Number(current?.year || 0)
    return (
      candidateTitle &&
      currentTitle &&
      candidateYear > 0 &&
      currentYear > 0 &&
      candidateYear === currentYear &&
      (candidateTitle === currentTitle || titleSimilarity(candidateTitle, currentTitle) >= 0.85)
    )
  }) || null
}

function mergeImportedReferencesLocally(existing = [], imported = []) {
  const merged = Array.isArray(existing) ? existing.slice() : []
  for (const candidate of Array.isArray(imported) ? imported : []) {
    if (!findDuplicateReferenceLocally(merged, candidate)) {
      merged.push(candidate)
    }
  }
  return merged
}

function resolveImportedSelectionReferenceLocally(mergedReferences = [], imported = []) {
  if (!Array.isArray(imported) || imported.length === 0) return null

  let importedSelection = mergedReferences.find((reference) =>
    imported.some((candidate) => candidate?.id && candidate.id === reference?.id)
  )
  if (importedSelection) return importedSelection

  for (const reference of mergedReferences) {
    if (findDuplicateReferenceLocally(imported, reference)) {
      importedSelection = reference
      break
    }
  }

  return importedSelection || null
}

function respond(snapshot = {}, result = {}) {
  return {
    snapshot: normalizeSnapshot(snapshot),
    result,
  }
}

function applyCreateCollection(snapshot = {}, label = '') {
  const normalized = normalizeSnapshot(snapshot)
  const trimmedLabel = String(label || '').trim()
  if (!trimmedLabel) {
    return respond(normalized, { collection: null, changed: false })
  }

  const existingCollection = normalized.collections.find(
    (collection) => normalizeCollectionLabel(collection.label) === normalizeCollectionLabel(trimmedLabel)
  )
  if (existingCollection) {
    return respond(normalized, { collection: existingCollection, changed: false })
  }

  const baseKey = buildCollectionKey(trimmedLabel)
  let key = baseKey
  let suffix = 2
  while (normalized.collections.some((collection) => collection.key === key)) {
    key = `${baseKey}-${suffix}`
    suffix += 1
  }

  const collection = { key, label: trimmedLabel }
  return respond(
    {
      ...normalized,
      collections: [...normalized.collections, collection],
    },
    {
      collection,
      changed: true,
    }
  )
}

function applyRenameCollection(snapshot = {}, collectionKey = '', nextLabel = '') {
  const normalized = normalizeSnapshot(snapshot)
  const collection = resolveCollection(normalized.collections, collectionKey)
  const trimmedLabel = String(nextLabel || '').trim()
  if (!collection || !trimmedLabel) {
    return respond(normalized, { collection: null, changed: false })
  }

  const duplicate = normalized.collections.find(
    (candidate) =>
      candidate.key !== collection.key &&
      normalizeCollectionLabel(candidate.label) === normalizeCollectionLabel(trimmedLabel)
  )
  if (duplicate) {
    return respond(normalized, { collection: null, changed: false })
  }

  const nextCollections = normalized.collections.map((candidate) =>
    candidate.key === collection.key
      ? {
          ...candidate,
          label: trimmedLabel,
        }
      : candidate
  )

  const nextReferences = normalized.references.map((reference) => {
    const memberships = Array.isArray(reference.collections) ? reference.collections : []
    const nextMemberships = memberships.map((value) => {
      const normalizedValue = normalizeCollectionMembershipValue(value)
      if (
        normalizedValue === normalizeCollectionMembershipValue(collection.key) ||
        normalizedValue === normalizeCollectionMembershipValue(collection.label)
      ) {
        return collection.key
      }
      return value
    })

    return {
      ...reference,
      collections: nextMemberships,
    }
  })

  const nextSnapshot = normalizeSnapshot({
    ...normalized,
    collections: nextCollections,
    references: nextReferences,
  })

  return respond(nextSnapshot, {
    collection: nextSnapshot.collections.find((candidate) => candidate.key === collection.key) || null,
    changed: true,
  })
}

function applyRemoveCollection(snapshot = {}, collectionKey = '') {
  const normalized = normalizeSnapshot(snapshot)
  const collection = resolveCollection(normalized.collections, collectionKey)
  if (!collection) {
    return respond(normalized, { removed: false })
  }

  const nextCollections = normalized.collections.filter((candidate) => candidate.key !== collection.key)
  const nextReferences = normalized.references.map((reference) => {
    const memberships = Array.isArray(reference.collections) ? reference.collections : []
    return {
      ...reference,
      collections: memberships.filter((value) => {
        const normalizedValue = normalizeCollectionMembershipValue(value)
        return (
          normalizedValue !== normalizeCollectionMembershipValue(collection.key) &&
          normalizedValue !== normalizeCollectionMembershipValue(collection.label)
        )
      }),
    }
  })

  return respond(
    {
      ...normalized,
      collections: nextCollections,
      references: nextReferences,
    },
    {
      removed: true,
    }
  )
}

function applyToggleReferenceCollection(snapshot = {}, referenceId = '', collectionKey = '') {
  const normalized = normalizeSnapshot(snapshot)
  const collection = resolveCollection(normalized.collections, collectionKey)
  if (!collection) {
    return respond(normalized, { changed: false, toggledOn: false })
  }

  let changed = false
  let toggledOn = false
  const nextReferences = normalized.references.map((reference) => {
    if (reference.id !== referenceId) return reference

    changed = true
    const memberships = Array.isArray(reference.collections) ? reference.collections : []
    const isMember = referenceHasCollection(reference, collection)
    const nextMemberships = memberships.filter((value) => {
      const normalizedValue = normalizeCollectionMembershipValue(value)
      return (
        normalizedValue !== normalizeCollectionMembershipValue(collection.key) &&
        normalizedValue !== normalizeCollectionMembershipValue(collection.label)
      )
    })

    toggledOn = !isMember
    if (toggledOn) {
      nextMemberships.push(collection.key)
    }

    return {
      ...reference,
      collections: nextMemberships,
    }
  })

  if (!changed) {
    return respond(normalized, { changed: false, toggledOn: false })
  }

  return respond(
    {
      ...normalized,
      references: nextReferences,
    },
    {
      changed: true,
      toggledOn,
    }
  )
}

function applyMergeImportedReferences(snapshot = {}, imported = []) {
  const normalized = normalizeSnapshot(snapshot)
  const mergedReferences = mergeImportedReferencesLocally(normalized.references, imported)
  const importedSelection = resolveImportedSelectionReferenceLocally(mergedReferences, imported)
  const selectedReferenceId = String(importedSelection?.id || '')
  return respond(
    {
      ...normalized,
      references: mergedReferences,
    },
    {
      importedCount: Math.max(0, mergedReferences.length - normalized.references.length),
      selectedReferenceId,
      reusedExisting: mergedReferences.length === normalized.references.length && Boolean(selectedReferenceId),
    }
  )
}

export function applyReferenceMutationLocally({ snapshot = {}, action = {} } = {}) {
  const type = String(action?.type || '')

  if (type === 'createCollection') {
    return applyCreateCollection(snapshot, action.label)
  }
  if (type === 'renameCollection') {
    return applyRenameCollection(snapshot, action.collectionKey, action.nextLabel)
  }
  if (type === 'removeCollection') {
    return applyRemoveCollection(snapshot, action.collectionKey)
  }
  if (type === 'toggleReferenceCollection') {
    return applyToggleReferenceCollection(snapshot, action.referenceId, action.collectionKey)
  }
  if (type === 'mergeImportedReferences') {
    return applyMergeImportedReferences(snapshot, Array.isArray(action.imported) ? action.imported : [])
  }

  return respond(snapshot, {})
}
