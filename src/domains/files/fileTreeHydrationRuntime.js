import {
  mergePreservingLoadedChildren,
  patchTreeEntry,
} from './fileTreeRefreshRuntime.js'

export function findTreeEntry(entries = [], targetPath) {
  for (const entry of entries) {
    if (entry.path === targetPath) return entry
    if (Array.isArray(entry.children)) {
      const found = findTreeEntry(entry.children, targetPath)
      if (found) return found
    }
  }
  return null
}

function listAncestorDirPaths(workspacePath, path) {
  if (!workspacePath || !path?.startsWith(workspacePath)) return []
  const relativePath = path.slice(workspacePath.length).replace(/^\/+/, '')
  if (!relativePath) return []

  const parts = relativePath.split('/').filter(Boolean)
  const ancestors = []
  let currentPath = workspacePath
  for (let index = 0; index < parts.length - 1; index += 1) {
    currentPath = `${currentPath}/${parts[index]}`
    ancestors.push(currentPath)
  }
  return ancestors
}

export function createFileTreeHydrationRuntime({
  getWorkspacePath,
  getCurrentTree,
  readDirShallow,
  applyTree,
  refreshVisibleTree,
  setLastLoadError,
  addExpandedDir,
  removeExpandedDir,
  hasExpandedDir,
  cacheSnapshot,
  invalidateFlatFiles,
} = {}) {
  const dirLoadPromises = new Map()

  async function loadFileTree(options = {}) {
    const workspacePath = getWorkspacePath?.()
    if (!workspacePath) return undefined

    const {
      suppressErrors = false,
      keepCurrentTreeOnError = false,
    } = options

    try {
      const nextTree = mergePreservingLoadedChildren(
        await readDirShallow?.(workspacePath),
        getCurrentTree?.() ?? [],
      )
      applyTree?.(nextTree, workspacePath)
      setLastLoadError?.(null)
      return nextTree
    } catch (error) {
      setLastLoadError?.(error)
      if (!suppressErrors) throw error
      return keepCurrentTreeOnError ? (getCurrentTree?.() ?? []) : []
    }
  }

  async function ensureDirLoaded(path, options = {}) {
    const entry = findTreeEntry(getCurrentTree?.() ?? [], path)
    if (!entry?.is_dir) return []

    const { force = false } = options
    if (!force && Array.isArray(entry.children)) {
      return entry.children
    }

    const existingPromise = dirLoadPromises.get(path)
    if (existingPromise && !force) {
      return existingPromise
    }

    const loadPromise = (async () => {
      const children = await readDirShallow?.(path)
      const nextTree = patchTreeEntry(getCurrentTree?.() ?? [], path, (current) => ({
        ...current,
        children: mergePreservingLoadedChildren(children, current.children || []),
      }))
      applyTree?.(nextTree, getWorkspacePath?.(), { preserveFlatFiles: true })
      return children
    })()

    dirLoadPromises.set(path, loadPromise)
    try {
      return await loadPromise
    } finally {
      dirLoadPromises.delete(path)
    }
  }

  async function revealPath(path) {
    const workspacePath = getWorkspacePath?.()
    for (const dirPath of listAncestorDirPaths(workspacePath, path)) {
      await ensureDirLoaded(dirPath)
      addExpandedDir?.(dirPath)
    }
    cacheSnapshot?.()
  }

  async function toggleDir(path) {
    if (hasExpandedDir?.(path)) {
      removeExpandedDir?.(path)
      cacheSnapshot?.()
      return
    }

    await ensureDirLoaded(path)
    addExpandedDir?.(path)
    cacheSnapshot?.()
  }

  async function syncTreeAfterMutation(options = {}) {
    const { expandPath = null } = options
    await refreshVisibleTree?.({ suppressErrors: true, reason: 'mutation' })

    const workspacePath = getWorkspacePath?.()
    if (expandPath && expandPath !== workspacePath) {
      await ensureDirLoaded(expandPath, { force: true })
      addExpandedDir?.(expandPath)
    }

    invalidateFlatFiles?.()
    cacheSnapshot?.()
  }

  function reset() {
    dirLoadPromises.clear()
  }

  return {
    loadFileTree,
    ensureDirLoaded,
    revealPath,
    toggleDir,
    syncTreeAfterMutation,
    reset,
  }
}
