import {
  getCachedTypstPreviewPath,
  getCachedTypstRootPath,
  resolveTypstProjectGraph,
} from './projectGraph.js'

export function resolveCachedTypstRootPath(sourcePath = '') {
  return getCachedTypstRootPath(sourcePath)
}

export function resolveCachedTypstPreviewPath(sourcePath = '') {
  return getCachedTypstPreviewPath(sourcePath)
}

export async function resolveTypstCompileTarget(sourcePath, options = {}) {
  const graph = await resolveTypstProjectGraph(sourcePath, options)
  return graph?.rootPath || sourcePath
}

export async function resolveTypstPreviewArtifact(sourcePath, options = {}) {
  const graph = await resolveTypstProjectGraph(sourcePath, options)
  return graph?.previewPath || resolveCachedTypstPreviewPath(sourcePath)
}
