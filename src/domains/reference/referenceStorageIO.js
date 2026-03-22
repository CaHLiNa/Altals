import { invoke } from '@tauri-apps/api/core'
import { setUserStyles } from '../../services/citationStyleRegistry'
import {
  createEmptyGlobalReferenceWorkbench,
  createEmptyWorkspaceReferenceCollection,
  parseWorkspaceReferenceCollection,
  resolveGlobalReferenceFulltextDir,
  resolveGlobalReferenceLibraryPath,
  resolveGlobalReferencePdfsDir,
  resolveGlobalReferencesDir,
  resolveGlobalReferenceWorkbenchPath,
  resolveLegacyWorkspaceReferenceLibraryPath,
  resolveWorkspaceReferenceCollectionPath,
  resolveWorkspaceReferencesDir,
} from '../../services/referenceLibraryPaths'

export async function readFileIfExists(path) {
  if (!path) return null
  try {
    const exists = await invoke('path_exists', { path })
    if (!exists) return null
    return await invoke('read_file', { path })
  } catch {
    return null
  }
}

export async function readJsonArray(path) {
  const raw = await readFileIfExists(path)
  if (!raw) return []
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function readWorkspaceReferenceCollection(path) {
  return parseWorkspaceReferenceCollection(await readFileIfExists(path))
}

export async function copyFileIfPresent(src, dest) {
  if (!src || !dest) return false
  try {
    const exists = await invoke('path_exists', { path: src })
    if (!exists) return false
    const destExists = await invoke('path_exists', { path: dest })
    if (!destExists) {
      await invoke('copy_file', { src, dest })
    }
    return true
  } catch {
    return false
  }
}

export async function loadPersistedCitationStyle(projectDir = '') {
  if (!projectDir) return null

  try {
    const stylePath = `${projectDir}/citation-style.json`
    const exists = await invoke('path_exists', { path: stylePath })
    if (!exists) return null
    const raw = await invoke('read_file', { path: stylePath })
    const data = JSON.parse(raw)
    return data.citationStyle || null
  } catch {
    return null
  }
}

export async function loadReferenceUserStyles(baseDir = '') {
  if (!baseDir) return []

  const stylesDir = `${baseDir}/styles`
  const exists = await invoke('path_exists', { path: stylesDir })
  if (!exists) return []

  const entries = await invoke('read_dir', { path: stylesDir })
  const cslFiles = (entries || []).filter((entry) => entry.name?.endsWith('.csl'))
  if (cslFiles.length === 0) return []

  const { parseCslMetadata, deriveStyleId } = await import('../../utils/cslParser')

  const styles = []
  for (const entry of cslFiles) {
    try {
      const xml = await invoke('read_file', { path: `${stylesDir}/${entry.name}` })
      const meta = parseCslMetadata(xml)
      const id = deriveStyleId(meta.id, meta.title)
      styles.push({
        id,
        name: meta.title,
        category: meta.category || 'Custom',
        filename: entry.name,
      })
    } catch {
      // Skip malformed CSL files.
    }
  }

  if (styles.length > 0) {
    setUserStyles(styles)
  }
  return styles
}

export async function ensureReferenceStorageReady(context = {}) {
  if (!context?.projectDir || !context?.globalConfigDir) return

  const globalPdfsDir = resolveGlobalReferencePdfsDir(context.globalConfigDir)
  const globalFulltextDir = resolveGlobalReferenceFulltextDir(context.globalConfigDir)
  const globalLibraryPath = resolveGlobalReferenceLibraryPath(context.globalConfigDir)
  const workbenchStatePath = resolveGlobalReferenceWorkbenchPath(context.globalConfigDir)
  const workspaceRefsDir = resolveWorkspaceReferencesDir(context.projectDir)
  const workspaceCollectionPath = resolveWorkspaceReferenceCollectionPath(context.projectDir)

  await invoke('create_dir', { path: resolveGlobalReferencesDir(context.globalConfigDir) }).catch(() => {})
  await invoke('create_dir', { path: globalPdfsDir }).catch(() => {})
  await invoke('create_dir', { path: globalFulltextDir }).catch(() => {})
  await invoke('create_dir', { path: workspaceRefsDir }).catch(() => {})

  const globalLibraryExists = await invoke('path_exists', { path: globalLibraryPath }).catch(() => false)
  if (!globalLibraryExists) {
    await invoke('write_file', {
      path: globalLibraryPath,
      content: '[]',
    })
  }

  const workbenchStateExists = await invoke('path_exists', { path: workbenchStatePath }).catch(() => false)
  if (!workbenchStateExists) {
    await invoke('write_file', {
      path: workbenchStatePath,
      content: JSON.stringify(createEmptyGlobalReferenceWorkbench(), null, 2),
    })
  }

  const workspaceCollectionExists = await invoke('path_exists', { path: workspaceCollectionPath }).catch(() => false)
  if (!workspaceCollectionExists) {
    await invoke('write_file', {
      path: workspaceCollectionPath,
      content: JSON.stringify(createEmptyWorkspaceReferenceCollection(), null, 2),
    })
  }
}

export async function deleteLegacyWorkspaceReferenceLibrary(context = {}) {
  const legacyLibraryPath = resolveLegacyWorkspaceReferenceLibraryPath(context.projectDir)
  if (!legacyLibraryPath) return false
  try {
    const exists = await invoke('path_exists', { path: legacyLibraryPath })
    if (!exists) return false
    await invoke('delete_path', { path: legacyLibraryPath })
    return true
  } catch (error) {
    console.warn('Failed to delete legacy workspace reference library:', error)
    return false
  }
}
