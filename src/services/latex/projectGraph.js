import { invoke } from '@tauri-apps/api/core'
import { readWorkspaceFlatFiles } from '../workspaceSnapshotIO.js'
import { listWorkspaceFlatFilePaths } from '../../domains/files/workspaceSnapshotFlatFilesRuntime.js'
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

async function listWorkspaceFiles(options = {}) {
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  const filesStore = options.filesStore

  if (Array.isArray(options.flatFiles) && options.flatFiles.length > 0) {
    return options.flatFiles.map((entry) => normalizeFsPath(entry.path || entry)).filter(Boolean)
  }

  const cachedSnapshotPaths = listWorkspaceFlatFilePaths(filesStore?.lastWorkspaceSnapshot)
    .map((entry) => normalizeFsPath(entry))
    .filter(Boolean)
  if (cachedSnapshotPaths.length > 0) return cachedSnapshotPaths

  const cachedFlatFiles = Array.isArray(filesStore?.flatFiles) ? filesStore.flatFiles : []
  const cachedFlatFilePaths = cachedFlatFiles
    .map((entry) => normalizeFsPath(entry.path || entry))
    .filter(Boolean)
  if (cachedFlatFilePaths.length > 0) return cachedFlatFilePaths

  if (filesStore?.ensureFlatFilesReady) {
    const entries = await filesStore.ensureFlatFilesReady().catch(() => [])
    const normalized = Array.isArray(entries)
      ? entries.map((entry) => normalizeFsPath(entry.path || entry)).filter(Boolean)
      : []
    if (normalized.length > 0) return normalized
  }

  if (!workspacePath) return [normalizeFsPath(options.sourcePath || '')].filter(Boolean)
  const entries = await readWorkspaceFlatFiles(workspacePath).catch(() => [])
  return Array.isArray(entries)
    ? entries.map((entry) => normalizeFsPath(entry.path || entry)).filter(Boolean)
    : []
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

  const flatFiles = await listWorkspaceFiles({
    ...options,
    sourcePath: normalizedSource,
  })
  const cacheKey = buildGraphCacheKey(normalizedSource, {
    ...options,
    flatFiles,
  })
  const cached = SOURCE_GRAPH_CACHE.get(normalizedSource)
  if (cached?.key === cacheKey) return cached.graph

  const graph = await invoke('latex_project_graph_resolve', {
    params: {
      sourcePath: normalizedSource,
      flatFiles,
      contentOverrides: options.contentOverrides || {},
    },
  }).catch(() => null)

  if (!graph || typeof graph !== 'object') return null
  SOURCE_GRAPH_CACHE.set(normalizedSource, {
    key: cacheKey,
    graph,
  })
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
