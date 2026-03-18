import { parseTypstOutlineItems } from '../../editor/typstDocument.js'
import { normalizeOutlineItems } from '../documentIntelligence/outline.js'
import { normalizeFsPath } from '../documentIntelligence/workspaceGraph.js'
import { resolveTypstProjectGraph } from './projectGraph.js'

function buildOutlineSignature(item = {}) {
  return `${item.kind || 'heading'}::${Number(item.offset) || 0}`
}

function mergeTinymistOutlineItems(liveItems = [], parsedItems = []) {
  const merged = [...parsedItems]
  const parsedSignatures = new Set(parsedItems.map(buildOutlineSignature))

  for (const item of liveItems) {
    if (!parsedSignatures.has(buildOutlineSignature(item))) {
      merged.push(item)
    }
  }

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

export async function buildTypstProjectOutlineItems(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (!normalizedSource) return []

  const graph = await resolveTypstProjectGraph(normalizedSource, options).catch(() => null)
  const orderedProjectPaths = Array.isArray(graph?.orderedProjectPaths) && graph.orderedProjectPaths.length > 0
    ? graph.orderedProjectPaths
    : [normalizedSource]

  const items = []
  let order = 0

  for (const filePath of orderedProjectPaths) {
    const normalizedPath = normalizeFsPath(filePath)
    const documentText = normalizedPath === normalizedSource
      ? String((options.documentText ?? graph?.records?.get(normalizedPath)?.content) || '')
      : String(graph?.records?.get(normalizedPath)?.content || '')
    if (!documentText) continue

    const pathItems = buildTypstOutlineItems(documentText, {
      liveState: normalizedPath === normalizedSource ? options.liveState : null,
    })

    for (const item of pathItems) {
      items.push({
        ...item,
        filePath: normalizedPath,
        order: order++,
      })
    }
  }

  return normalizeOutlineItems(items)
}
