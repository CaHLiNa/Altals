import { invoke } from '@tauri-apps/api/core'
import {
  normalizeFsPath,
  relativePathBetween,
  stripExtension,
} from '../documentIntelligence/workspaceGraph.js'
import {
  buildLatexProjectGraphCacheKey,
  cacheLatexProjectGraph,
  readCachedLatexProjectGraphEntry,
} from './projectGraphCache.js'

export async function resolveLatexProjectGraph(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (!normalizedSource) return null

  const explicitFlatFiles = Array.isArray(options.flatFiles)
    ? options.flatFiles
        .map((entry) => normalizeFsPath(entry.path || entry))
        .filter(Boolean)
    : []
  const cacheKey = buildLatexProjectGraphCacheKey(normalizedSource, {
    workspacePath: normalizeFsPath(options.workspacePath || ''),
    flatFiles: explicitFlatFiles,
    contentOverrides: options.contentOverrides || {},
  })
  const cached = cacheKey ? readCachedLatexProjectGraphEntry(normalizedSource) : null
  if (cacheKey && cached?.key === cacheKey) return cached.graph

  const graph = await invoke('latex_project_graph_resolve', {
    params: {
      sourcePath: normalizedSource,
      workspacePath: normalizeFsPath(options.workspacePath || ''),
      flatFiles: explicitFlatFiles,
      includeHidden: options.includeHidden !== false,
      contentOverrides: options.contentOverrides || {},
    },
  }).catch(() => null)

  if (!graph || typeof graph !== 'object') return null
  if (cacheKey) {
    cacheLatexProjectGraph(normalizedSource, cacheKey, graph)
  }
  return graph
}

export function buildRelativeLatexInputPath(fromFilePath, targetPath) {
  const relative = relativePathBetween(fromFilePath, targetPath)
  return stripExtension(relative)
}
