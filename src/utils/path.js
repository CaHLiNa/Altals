export function normalizeFsPath(value = '') {
  return String(value || '').trim().replace(/\\/g, '/')
}

export function basenamePath(filePath = '') {
  const normalized = normalizeFsPath(filePath)
  if (!normalized) return ''
  if (normalized === '/') return '/'

  const withoutTrailing = normalized.replace(/\/+$/, '')
  if (/^[A-Za-z]:$/.test(withoutTrailing)) return `${withoutTrailing}/`

  const parts = withoutTrailing.split('/').filter(Boolean)
  return parts.at(-1) || withoutTrailing
}

export function dirnamePath(filePath = '') {
  const normalized = normalizeFsPath(filePath)
  if (!normalized) return '.'
  if (normalized === '/') return '/'
  if (/^[A-Za-z]:\/?$/.test(normalized)) return `${normalized.slice(0, 2)}/`

  const withoutTrailing = normalized.replace(/\/+$/, '')
  const index = withoutTrailing.lastIndexOf('/')
  if (index < 0) return '.'
  if (index === 0) return '/'

  const head = withoutTrailing.slice(0, index)
  if (/^[A-Za-z]:$/.test(head)) return `${head}/`
  return head
}

export function resolveRelativePath(baseDir = '', target = '') {
  const normalizedTarget = normalizeFsPath(target)
  if (!normalizedTarget) return ''
  if (normalizedTarget.startsWith('/') || /^[A-Za-z]:\//.test(normalizedTarget)) {
    return normalizedTarget
  }

  const seed = normalizeFsPath(baseDir || '.')
  const baseParts = seed.split('/').filter(Boolean)
  const targetParts = normalizedTarget.split('/')
  const absolute = seed.startsWith('/') || /^[A-Za-z]:\//.test(seed)
  const drivePrefix = /^[A-Za-z]:\//.test(seed) ? seed.slice(0, 2) : ''

  for (const segment of targetParts) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (baseParts.length > 0) baseParts.pop()
      continue
    }
    baseParts.push(segment)
  }

  if (drivePrefix) {
    return normalizeFsPath(`${drivePrefix}/${baseParts.slice(1).join('/')}`)
  }
  return absolute
    ? normalizeFsPath(`/${baseParts.join('/')}`)
    : normalizeFsPath(baseParts.join('/'))
}

export function stripExtension(filePath = '') {
  const name = basenamePath(filePath)
  const index = name.lastIndexOf('.')
  return index > 0 ? name.slice(0, index) : name
}
