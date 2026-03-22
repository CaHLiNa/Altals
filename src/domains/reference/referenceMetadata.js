const VALID_READING_STATES = new Set(['unread', 'reading', 'reviewed'])
const VALID_PRIORITY_LEVELS = new Set(['low', 'medium', 'high'])

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function assignNormalizedField(ref = {}, field, normalizedValue) {
  if (field === '_rating') {
    if (normalizedValue > 0) ref[field] = normalizedValue
    else delete ref[field]
    return
  }

  if (Array.isArray(normalizedValue)) {
    if (normalizedValue.length > 0) ref[field] = normalizedValue
    else delete ref[field]
    return
  }

  if (normalizedValue) ref[field] = normalizedValue
  else delete ref[field]
}

function tagsEqual(left = [], right = []) {
  return left.join('\u0000') === right.join('\u0000')
}

export function normalizeReferenceTags(tags = []) {
  const raw = Array.isArray(tags) ? tags : String(tags || '').split(',')
  return Array.from(new Set(
    raw
      .map((tag) => String(tag || '').trim())
      .filter(Boolean)
  ))
}

export function normalizeReferenceCollections(collections = []) {
  const raw = Array.isArray(collections) ? collections : String(collections || '').split(',')
  return Array.from(new Set(
    raw
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ))
}

export function normalizeReadingState(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_READING_STATES.has(normalized) ? normalized : ''
}

export function normalizePriority(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return VALID_PRIORITY_LEVELS.has(normalized) ? normalized : ''
}

export function normalizeRating(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const rounded = Math.round(numeric)
  return rounded >= 1 && rounded <= 5 ? rounded : 0
}

export function normalizeWorkflowText(value) {
  return String(value || '').trim()
}

export function sanitizeReferenceRecord(ref = {}) {
  const next = cloneValue(ref) || {}

  assignNormalizedField(next, '_tags', normalizeReferenceTags(next._tags || []))
  assignNormalizedField(next, '_collections', normalizeReferenceCollections(next._collections || []))
  assignNormalizedField(next, '_readingState', normalizeReadingState(next._readingState))
  assignNormalizedField(next, '_priority', normalizePriority(next._priority))
  assignNormalizedField(next, '_rating', normalizeRating(next._rating))
  assignNormalizedField(next, '_summary', normalizeWorkflowText(next._summary))
  assignNormalizedField(next, '_readingNote', normalizeWorkflowText(next._readingNote))

  return next
}

export function updateReferenceWorkflowField(ref = {}, field = '', value) {
  const normalizers = {
    _readingState: normalizeReadingState,
    _priority: normalizePriority,
    _rating: normalizeRating,
    _summary: normalizeWorkflowText,
    _readingNote: normalizeWorkflowText,
  }

  const normalize = normalizers[field]
  if (!normalize) return false

  const currentValue = normalize(ref[field])
  const normalizedValue = normalize(value)
  if (currentValue === normalizedValue) return false

  assignNormalizedField(ref, field, normalizedValue)
  return true
}

export function addReferenceTags(ref = {}, tags = []) {
  const nextTags = normalizeReferenceTags(tags)
  if (nextTags.length === 0) return false

  const currentTags = normalizeReferenceTags(ref._tags || [])
  const mergedTags = normalizeReferenceTags([...currentTags, ...nextTags])
  if (tagsEqual(currentTags, mergedTags)) return false

  assignNormalizedField(ref, '_tags', mergedTags)
  return true
}

export function replaceReferenceTags(ref = {}, tags = []) {
  const normalizedTags = normalizeReferenceTags(tags)
  const currentTags = normalizeReferenceTags(ref._tags || [])
  if (tagsEqual(currentTags, normalizedTags)) return false

  assignNormalizedField(ref, '_tags', normalizedTags)
  return true
}

export function removeReferenceTags(ref = {}, tags = []) {
  const removeTags = new Set(normalizeReferenceTags(tags))
  if (removeTags.size === 0) return false

  const currentTags = normalizeReferenceTags(ref._tags || [])
  if (currentTags.length === 0) return false

  const nextTags = currentTags.filter((tag) => !removeTags.has(tag))
  if (tagsEqual(currentTags, nextTags)) return false

  assignNormalizedField(ref, '_tags', nextTags)
  return true
}
