import {
  getCachedTypstPreviewPath,
  getCachedTypstRootPath,
  resolveTypstProjectGraph,
} from './projectGraph.js'
import { normalizeFsPath } from '../documentIntelligence/workspaceGraph.js'

export function resolveCachedTypstRootPath(sourcePath = '') {
  return getCachedTypstRootPath(sourcePath)
}

export function resolveCachedTypstPreviewPath(sourcePath = '') {
  return getCachedTypstPreviewPath(sourcePath)
}

export async function resolveTypstRootPathForSource(sourcePath, options = {}) {
  const normalizedSourcePath = normalizeFsPath(sourcePath)
  if (!normalizedSourcePath) return ''

  const explicitRootPath = normalizeFsPath(options.rootPath || '')
  if (explicitRootPath) return explicitRootPath

  const cachedRootPath = normalizeFsPath(
    options.resolveCachedTypstRootPathImpl?.(normalizedSourcePath)
      || getCachedTypstRootPath(normalizedSourcePath),
  )
  if (cachedRootPath && cachedRootPath !== normalizedSourcePath) {
    return cachedRootPath
  }

  try {
    const graph = await resolveTypstProjectGraph(normalizedSourcePath, options)
    return normalizeFsPath(graph?.rootPath || '') || cachedRootPath || normalizedSourcePath
  } catch {
    return cachedRootPath || normalizedSourcePath
  }
}

export async function resolveTypstCompileTarget(sourcePath, options = {}) {
  const graph = await resolveTypstProjectGraph(sourcePath, options)
  return graph?.rootPath || sourcePath
}

export async function resolveTypstPreviewArtifact(sourcePath, options = {}) {
  const graph = await resolveTypstProjectGraph(sourcePath, options)
  return graph?.previewPath || resolveCachedTypstPreviewPath(sourcePath)
}
