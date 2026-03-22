function normalizeDoi(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/doi\.org\//i, '')
    .toLowerCase()
}

function normalizeTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeAuthorToken(author = {}) {
  return String(author?.family || author?.given || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function issuedYear(ref = {}) {
  return Number(ref?.issued?.['date-parts']?.[0]?.[0] || 0)
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value !== null && value !== undefined && value !== ''
}

export function cloneReferenceValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function mergeableFieldNames(existing = {}, incoming = {}) {
  return Array.from(new Set([
    ...Object.keys(existing || {}),
    ...Object.keys(incoming || {}),
  ])).filter((field) => (
    field &&
    field !== 'id' &&
    !field.startsWith('_')
  ))
}

export function prepareReferenceImport(cslJson = {}, { generateKey } = {}) {
  const nextRef = {
    ...cloneReferenceValue(cslJson),
  }

  if (!nextRef._key) {
    nextRef._key = generateKey?.(nextRef)
  }
  nextRef.id = nextRef._key

  return nextRef
}

export function auditReferenceImportCandidate(globalLibrary = [], cslJson = {}) {
  const incomingDoi = normalizeDoi(cslJson?.DOI)
  if (incomingDoi) {
    const strong = globalLibrary.find((ref) => normalizeDoi(ref?.DOI) === incomingDoi)
    if (strong) {
      return {
        existingKey: strong._key,
        matchType: 'strong',
        reason: 'doi',
      }
    }
  }

  const incomingTitle = normalizeTitle(cslJson?.title)
  const incomingAuthor = normalizeAuthorToken(cslJson?.author?.[0])
  const incomingYear = issuedYear(cslJson)

  if (incomingTitle && incomingAuthor && incomingYear) {
    const possible = globalLibrary.find((ref) => (
      normalizeTitle(ref?.title) === incomingTitle &&
      normalizeAuthorToken(ref?.author?.[0]) === incomingAuthor &&
      issuedYear(ref) === incomingYear
    ))
    if (possible) {
      return {
        existingKey: possible._key,
        matchType: 'possible',
        reason: 'title-author-year',
      }
    }
  }

  return {
    existingKey: null,
    matchType: null,
    reason: null,
  }
}

export function buildMergedReference(existingRef, importedRef, fieldSelections = {}) {
  if (!existingRef || !importedRef) return null

  const merged = {
    ...cloneReferenceValue(existingRef),
  }

  for (const field of mergeableFieldNames(existingRef, importedRef)) {
    if (fieldSelections[field] !== 'incoming') continue
    if (!hasValue(importedRef[field])) continue
    merged[field] = cloneReferenceValue(importedRef[field])
  }

  return merged
}
