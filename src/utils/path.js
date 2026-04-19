export function normalizeFsPath(value = '') {
  return String(value || '').trim().replace(/\\/g, '/')
}

export function basenamePath(filePath = '') {
  const normalized = normalizeFsPath(filePath)
  if (!normalized) return ''

  const parts = normalized.split('/').filter(Boolean)
  if (!parts.length) {
    return normalized.endsWith('/') ? '/' : normalized
  }

  return parts.at(-1) || ''
}
