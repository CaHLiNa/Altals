import { sortByOffset, uniqueBy } from './workspaceGraph.js'

export function normalizeOutlineItem(item = {}) {
  const normalizedLevel = Math.max(1, Number(item.level) || 1)
  return {
    kind: item.kind || 'heading',
    text: String(item.text || '').trim(),
    level: normalizedLevel,
    displayLevel: Math.max(1, Number(item.displayLevel) || normalizedLevel),
    offset: Math.max(0, Number(item.offset) || 0),
    order: Number.isInteger(item.order) ? item.order : null,
    filePath: item.filePath || '',
    line: Number.isInteger(item.line) && item.line > 0 ? item.line : null,
  }
}

export function normalizeOutlineItems(items = []) {
  const normalized = uniqueBy(
    items
      .map(normalizeOutlineItem)
      .filter(item => item.text),
    item => [item.filePath, item.offset, item.kind, item.text].join('::'),
  )
  if (normalized.some(item => item.order != null)) {
    return normalized.sort((left, right) => {
      const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
      const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return left.offset - right.offset
    })
  }
  return sortByOffset(normalized)
}
