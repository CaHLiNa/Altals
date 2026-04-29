import {
  getCachedLatexPreviewPath,
  getCachedLatexRootPath,
  resolveLatexProjectGraph,
} from './projectGraph.js'
import { normalizeFsPath } from '../documentIntelligence/workspaceGraph.js'

export function resolveCachedLatexRootPath(sourcePath = '') {
  return getCachedLatexRootPath(sourcePath)
}

export function resolveCachedLatexPreviewPath(sourcePath = '') {
  return getCachedLatexPreviewPath(sourcePath)
}

export async function resolveLatexCompileTarget(sourcePath, options = {}) {
  const graph = await resolveLatexProjectGraph(sourcePath, options)
  return graph?.rootPath || sourcePath
}

export async function resolveLatexReferenceScopePath(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (!normalizedSource) return ''

  const graph = await resolveLatexProjectGraph(normalizedSource, options).catch(() => null)
  return normalizeFsPath(graph?.rootPath || getCachedLatexRootPath(normalizedSource) || normalizedSource)
}

export async function resolveLatexPreviewArtifact(sourcePath, options = {}) {
  const graph = await resolveLatexProjectGraph(sourcePath, options)
  return graph?.previewPath || resolveCachedLatexPreviewPath(sourcePath)
}
