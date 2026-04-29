import { invoke } from '@tauri-apps/api/core'
import {
  normalizeFsPath,
  relativePathBetween,
  stripExtension,
} from '../documentIntelligence/workspaceGraph.js'

const SOURCE_GRAPH_CACHE = new Map()

export function stableContentFingerprint(value = '') {
  const text = String(value || '')
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`
}

function listCachedWorkspaceFiles(options = {}) {
  const filesStore = options.filesStore

  if (Array.isArray(options.flatFiles) && options.flatFiles.length > 0) {
    return options.flatFiles.map((entry) => normalizeFsPath(entry.path || entry)).filter(Boolean)
  }

  const cachedSnapshotPaths = (filesStore?.lastWorkspaceSnapshot?.flatFiles || [])
    .map((entry) => normalizeFsPath(entry?.path || entry))
    .filter(Boolean)
  if (cachedSnapshotPaths.length > 0) return cachedSnapshotPaths

  const cachedFlatFiles = Array.isArray(filesStore?.flatFiles) ? filesStore.flatFiles : []
  return cachedFlatFiles
    .map((entry) => normalizeFsPath(entry.path || entry))
    .filter(Boolean)
}

function buildGraphCacheKey(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  const flatFiles = Array.isArray(options.flatFiles)
    ? options.flatFiles.map((entry) => normalizeFsPath(entry.path || entry)).filter(Boolean)
    : []
  const overrideEntries = Object.entries(options.contentOverrides || {})
    .map(([path, content]) => ({
      path: normalizeFsPath(path),
      fingerprint: stableContentFingerprint(content),
    }))
    .filter((entry) => entry.path)
    .sort((left, right) => left.path.localeCompare(right.path))
  return JSON.stringify({
    sourcePath: normalizedSource,
    workspacePath: normalizeFsPath(options.workspacePath || ''),
    flatFiles,
    overrideEntries,
  })
}

export function getCachedLatexProjectGraph(sourcePath = '') {
  const normalized = normalizeFsPath(sourcePath)
  return SOURCE_GRAPH_CACHE.get(normalized)?.graph || null
}

export function getCachedLatexRootPath(sourcePath = '') {
  return getCachedLatexProjectGraph(sourcePath)?.rootPath || normalizeFsPath(sourcePath)
}

export function getCachedLatexPreviewPath(sourcePath = '') {
  return getCachedLatexProjectGraph(sourcePath)?.previewPath || `${stripExtension(sourcePath)}.pdf`
}

export async function resolveLatexProjectGraph(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (!normalizedSource) return null

  const flatFiles = listCachedWorkspaceFiles({
    ...options,
    sourcePath: normalizedSource,
  })
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  const cacheKey = buildGraphCacheKey(normalizedSource, {
    ...options,
    flatFiles,
    workspacePath,
  })
  const cached = SOURCE_GRAPH_CACHE.get(normalizedSource)
  const usesRustWorkspaceDiscovery = flatFiles.length === 0 && workspacePath
  if (!usesRustWorkspaceDiscovery && cached?.key === cacheKey) return cached.graph

  const graph = await invoke('latex_project_graph_resolve', {
    params: {
      sourcePath: normalizedSource,
      workspacePath,
      flatFiles,
      contentOverrides: options.contentOverrides || {},
    },
  }).catch(() => null)

  if (!graph || typeof graph !== 'object') return null
  if (!usesRustWorkspaceDiscovery) {
    SOURCE_GRAPH_CACHE.set(normalizedSource, {
      key: cacheKey,
      graph,
    })
  }
  return graph
}

export async function resolveLatexProjectContext(sourcePath, options = {}) {
  return resolveLatexProjectGraph(sourcePath, options)
}

export async function resolveLatexOutlineItems(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (!normalizedSource) return []

  const contentOverrides = options.sourceContent === undefined
    ? (options.contentOverrides || {})
    : {
        ...(options.contentOverrides || {}),
        [normalizedSource]: options.sourceContent,
      }

  const graph = await resolveLatexProjectGraph(normalizedSource, {
    ...options,
    contentOverrides,
  }).catch(() => null)

  return Array.isArray(graph?.outlineItems) ? graph.outlineItems : []
}

export function buildRelativeLatexInputPath(fromFilePath, targetPath) {
  const relative = relativePathBetween(fromFilePath, targetPath)
  return stripExtension(relative)
}
