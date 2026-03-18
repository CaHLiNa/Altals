import { invoke } from '@tauri-apps/api/core'
import {
  buildContentSignature,
  dirnamePath,
  extnamePath,
  normalizeFsPath,
  resolveRelativePath,
  uniqueBy,
} from '../documentIntelligence/workspaceGraph.js'

const FILE_RECORD_CACHE = new Map()
const SOURCE_GRAPH_CACHE = new Map()
const ROOT_PATH_CACHE = new Map()
const PREVIEW_PATH_CACHE = new Map()

const IMPORT_RE = /#import\s+"([^"]+)"/g
const INCLUDE_RE = /#include\s+"([^"]+)"/g

function isTypstSourcePath(path = '') {
  return extnamePath(path) === '.typ'
}

function buildPreviewPath(filePath = '') {
  return filePath.replace(/\.typ$/i, '.pdf')
}

function sanitizeTarget(rawValue = '') {
  return String(rawValue || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\\/g, '/')
}

function isLocalTypstTarget(rawValue = '') {
  const value = sanitizeTarget(rawValue)
  if (!value) return false
  if (value.startsWith('@')) return false
  if (/^[A-Za-z]+:/.test(value)) return false
  return true
}

function candidatePathsFor(baseDir, rawValue = '') {
  const value = sanitizeTarget(rawValue)
  if (!isLocalTypstTarget(value)) return []
  const absolute = resolveRelativePath(baseDir, value)
  if (!absolute) return []
  if (isTypstSourcePath(absolute)) return [absolute]
  return [absolute, `${absolute}.typ`]
}

function resolveExistingPath(candidates = [], availablePaths = new Set()) {
  for (const candidate of candidates) {
    if (availablePaths.has(candidate)) return candidate
  }
  return candidates[0] || ''
}

function parseDependencies(content = '', filePath = '', availablePaths = new Set()) {
  const dependencies = []
  const baseDir = dirnamePath(filePath)

  IMPORT_RE.lastIndex = 0
  let match
  while ((match = IMPORT_RE.exec(content)) !== null) {
    const targetPath = resolveExistingPath(candidatePathsFor(baseDir, match[1]), availablePaths)
    if (!targetPath || !isTypstSourcePath(targetPath)) continue
    dependencies.push({
      kind: 'import',
      filePath,
      targetPath,
      offset: match.index,
      raw: match[1],
    })
  }

  INCLUDE_RE.lastIndex = 0
  while ((match = INCLUDE_RE.exec(content)) !== null) {
    const targetPath = resolveExistingPath(candidatePathsFor(baseDir, match[1]), availablePaths)
    if (!targetPath || !isTypstSourcePath(targetPath)) continue
    dependencies.push({
      kind: 'include',
      filePath,
      targetPath,
      offset: match.index,
      raw: match[1],
    })
  }

  return uniqueBy(
    dependencies,
    dependency => `${dependency.kind}:${dependency.filePath}:${dependency.targetPath}:${dependency.offset}`,
  )
}

async function readTextFile(path, options = {}) {
  const normalized = normalizeFsPath(path)
  if (!normalized) return ''
  if (options.contentOverrides && Object.prototype.hasOwnProperty.call(options.contentOverrides, normalized)) {
    return String(options.contentOverrides[normalized] || '')
  }
  const cachedContent = options.filesStore?.fileContents?.[normalized]
  if (cachedContent !== undefined) return String(cachedContent || '')
  return await invoke('read_file', { path: normalized }).catch(() => '')
}

async function listWorkspaceFiles(options = {}) {
  const workspacePath = normalizeFsPath(options.workspacePath || '')
  const filesStore = options.filesStore

  if (Array.isArray(options.flatFiles) && options.flatFiles.length > 0) {
    return options.flatFiles.map(entry => normalizeFsPath(entry.path || entry))
  }

  if (filesStore?.ensureFlatFilesReady) {
    const entries = await filesStore.ensureFlatFilesReady().catch(() => [])
    if (Array.isArray(entries) && entries.length > 0) {
      return entries.map(entry => normalizeFsPath(entry.path || entry))
    }
  }

  if (!workspacePath) return [normalizeFsPath(options.sourcePath || '')].filter(Boolean)
  const entries = await invoke('list_files_recursive', { path: workspacePath }).catch(() => [])
  return Array.isArray(entries)
    ? entries.map(entry => normalizeFsPath(entry.path || entry))
    : []
}

async function parseFileRecord(filePath, options = {}, availablePaths = new Set()) {
  const normalized = normalizeFsPath(filePath)
  const content = await readTextFile(normalized, options)
  const signature = buildContentSignature(content)
  const cached = FILE_RECORD_CACHE.get(normalized)
  if (cached?.signature === signature) return cached.record

  const record = {
    filePath: normalized,
    content,
    signature,
    dependencies: parseDependencies(content, normalized, availablePaths),
  }
  FILE_RECORD_CACHE.set(normalized, { signature, record })
  return record
}

function buildReverseDependencyMap(records = new Map()) {
  const reverse = new Map()
  for (const [filePath, record] of records.entries()) {
    for (const dependency of record.dependencies || []) {
      const targetPath = normalizeFsPath(dependency.targetPath)
      if (!targetPath) continue
      if (!reverse.has(targetPath)) reverse.set(targetPath, new Set())
      reverse.get(targetPath).add(filePath)
    }
  }
  return reverse
}

function collectProjectPaths(rootPath, records = new Map(), visited = new Set()) {
  const normalizedRoot = normalizeFsPath(rootPath)
  if (!normalizedRoot || visited.has(normalizedRoot)) return visited
  visited.add(normalizedRoot)
  const record = records.get(normalizedRoot)
  for (const dependency of record?.dependencies || []) {
    collectProjectPaths(dependency.targetPath, records, visited)
  }
  return visited
}

function inferRootCandidates(records = new Map(), reverseDependencies = new Map(), sourcePath = '') {
  const candidates = []
  for (const filePath of records.keys()) {
    if (!reverseDependencies.has(filePath) || reverseDependencies.get(filePath)?.size === 0) {
      candidates.push(filePath)
    }
  }
  if (candidates.length > 0) return candidates.sort()
  return [normalizeFsPath(sourcePath)].filter(Boolean)
}

function chooseRootPath(sourcePath, owningRoots = []) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (owningRoots.includes(normalizedSource)) return normalizedSource
  return owningRoots[0] || normalizedSource
}

function cacheResolvedRoot(sourcePath, rootPath) {
  const normalizedSource = normalizeFsPath(sourcePath)
  const normalizedRoot = normalizeFsPath(rootPath)
  if (!normalizedSource || !normalizedRoot) return
  ROOT_PATH_CACHE.set(normalizedSource, normalizedRoot)
  PREVIEW_PATH_CACHE.set(normalizedSource, buildPreviewPath(normalizedRoot))
}

export function getCachedTypstRootPath(sourcePath = '') {
  return ROOT_PATH_CACHE.get(normalizeFsPath(sourcePath)) || ''
}

export function getCachedTypstPreviewPath(sourcePath = '') {
  return PREVIEW_PATH_CACHE.get(normalizeFsPath(sourcePath)) || ''
}

export async function resolveTypstProjectGraph(sourcePath, options = {}) {
  const normalizedSource = normalizeFsPath(sourcePath)
  if (!normalizedSource) return null

  const workspaceFiles = await listWorkspaceFiles({
    ...options,
    sourcePath: normalizedSource,
  })
  const typstFiles = uniqueBy(
    [...workspaceFiles.filter(path => isTypstSourcePath(path)), normalizedSource],
    value => normalizeFsPath(value),
  ).sort()
  const availablePaths = new Set(typstFiles)

  const records = new Map()
  for (const filePath of typstFiles) {
    const record = await parseFileRecord(filePath, {
      ...options,
      flatFiles: typstFiles,
    }, availablePaths)
    records.set(filePath, record)
  }

  const workspaceSignature = typstFiles
    .map(filePath => `${filePath}:${records.get(filePath)?.signature || ''}`)
    .join('|')
  const cached = SOURCE_GRAPH_CACHE.get(normalizedSource)
  if (cached?.signature === workspaceSignature) {
    cacheResolvedRoot(normalizedSource, cached.graph.rootPath || normalizedSource)
    return cached.graph
  }

  const reverseDependencies = buildReverseDependencyMap(records)
  const rootCandidates = inferRootCandidates(records, reverseDependencies, normalizedSource)
  const rootProjects = rootCandidates.map((rootPath) => ({
    rootPath,
    projectPaths: [...collectProjectPaths(rootPath, records)].sort(),
  }))
  const owningRoots = rootProjects
    .filter(project => project.projectPaths.includes(normalizedSource))
    .map(project => project.rootPath)
    .sort()
  const rootPath = chooseRootPath(normalizedSource, owningRoots)
  const activeProject = rootProjects.find(project => project.rootPath === rootPath)

  const graph = {
    sourcePath: normalizedSource,
    rootPath,
    previewPath: buildPreviewPath(rootPath),
    projectPaths: activeProject?.projectPaths || [normalizedSource],
    dependencies: (records.get(normalizedSource)?.dependencies || []).map(entry => entry.targetPath),
    dependentPaths: [...(reverseDependencies.get(normalizedSource) || [])].sort(),
    owningRoots,
    rootCandidates,
  }

  SOURCE_GRAPH_CACHE.set(normalizedSource, { signature: workspaceSignature, graph })
  cacheResolvedRoot(normalizedSource, rootPath)
  return graph
}

export async function resolveTypstAffectedRootTargets(changedPath, options = {}) {
  const normalizedChangedPath = normalizeFsPath(changedPath)
  if (!normalizedChangedPath || !isTypstSourcePath(normalizedChangedPath)) return []

  const workspaceFiles = await listWorkspaceFiles({
    ...options,
    sourcePath: normalizedChangedPath,
  })
  const typstFiles = uniqueBy(
    [...workspaceFiles.filter(path => isTypstSourcePath(path)), normalizedChangedPath],
    value => normalizeFsPath(value),
  ).sort()

  const affectedRoots = new Map()
  for (const filePath of typstFiles) {
    const graph = await resolveTypstProjectGraph(filePath, {
      ...options,
      flatFiles: typstFiles,
    }).catch(() => null)
    if (!graph?.rootPath) continue
    if (!graph.projectPaths?.includes(normalizedChangedPath)) continue

    if (!affectedRoots.has(graph.rootPath)) {
      affectedRoots.set(graph.rootPath, {
        sourcePath: graph.rootPath,
        rootPath: graph.rootPath,
        previewPath: graph.previewPath || buildPreviewPath(graph.rootPath),
      })
    }
  }

  if (affectedRoots.size === 0) {
    return [{
      sourcePath: normalizedChangedPath,
      rootPath: normalizedChangedPath,
      previewPath: buildPreviewPath(normalizedChangedPath),
    }]
  }

  return [...affectedRoots.values()]
}
