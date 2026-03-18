import { parseTypstOutlineItems } from '../../editor/typstDocument.js'
import { normalizeOutlineItems } from '../documentIntelligence/outline.js'

function buildOutlineSignature(item = {}) {
  return `${item.kind || 'heading'}::${Number(item.offset) || 0}`
}

function mergeTinymistOutlineItems(liveItems = [], parsedItems = []) {
  const merged = []
  const parsedStructureItems = parsedItems.filter(item => item.kind !== 'heading')
  const parsedStructureSignatures = new Set(parsedStructureItems.map(buildOutlineSignature))

  for (const item of liveItems) {
    if (item?.kind === 'heading') {
      merged.push(item)
      continue
    }
    if (!parsedStructureSignatures.has(buildOutlineSignature(item))) {
      merged.push(item)
    }
  }

  merged.push(...parsedStructureItems)
  return normalizeOutlineItems(merged)
}

export function buildTypstOutlineItems(documentText = '', options = {}) {
  const liveState = options.liveState || {}
  const tinymistBacked = liveState?.tinymistBacked === true
  const outlineLoaded = liveState?.outlineLoaded === true
  const outlineItems = Array.isArray(liveState?.outlineItems) ? liveState.outlineItems : []
  const parsedItems = parseTypstOutlineItems(documentText)

  if (tinymistBacked && outlineLoaded) {
    return mergeTinymistOutlineItems(outlineItems, parsedItems)
  }

  return normalizeOutlineItems(parsedItems)
}
