import { normalizeOutlineItems } from '../documentIntelligence/outline.js'
import { resolveLatexProjectGraph } from './projectGraph.js'

export async function buildLatexOutlineItems(sourcePath, options = {}) {
  const graph = await resolveLatexProjectGraph(sourcePath, options)
  return normalizeOutlineItems(graph?.outlineItems || [])
}
