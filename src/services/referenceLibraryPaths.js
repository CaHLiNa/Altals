export const WORKSPACE_REFERENCE_COLLECTION_VERSION = 1
export const GLOBAL_REFERENCE_WORKBENCH_VERSION = 1

export function resolveGlobalReferencesDir(globalConfigDir = '') {
  return globalConfigDir ? `${globalConfigDir}/references` : ''
}

export function resolveGlobalReferenceLibraryPath(globalConfigDir = '') {
  const dir = resolveGlobalReferencesDir(globalConfigDir)
  return dir ? `${dir}/library.json` : ''
}

export function resolveGlobalReferenceWorkbenchPath(globalConfigDir = '') {
  const dir = resolveGlobalReferencesDir(globalConfigDir)
  return dir ? `${dir}/workbench.json` : ''
}

export function resolveGlobalReferencePdfsDir(globalConfigDir = '') {
  const dir = resolveGlobalReferencesDir(globalConfigDir)
  return dir ? `${dir}/pdfs` : ''
}

export function resolveGlobalReferenceFulltextDir(globalConfigDir = '') {
  const dir = resolveGlobalReferencesDir(globalConfigDir)
  return dir ? `${dir}/fulltext` : ''
}

export function resolveWorkspaceReferencesDir(projectDir = '') {
  return projectDir ? `${projectDir}/references` : ''
}

export function resolveWorkspaceReferenceCollectionPath(projectDir = '') {
  const dir = resolveWorkspaceReferencesDir(projectDir)
  return dir ? `${dir}/workspace-library.json` : ''
}

export function resolveLegacyWorkspaceReferenceLibraryPath(projectDir = '') {
  const dir = resolveWorkspaceReferencesDir(projectDir)
  return dir ? `${dir}/library.json` : ''
}

export function resolveLegacyWorkspaceReferencePdfsDir(projectDir = '') {
  const dir = resolveWorkspaceReferencesDir(projectDir)
  return dir ? `${dir}/pdfs` : ''
}

export function resolveLegacyWorkspaceReferenceFulltextDir(projectDir = '') {
  const dir = resolveWorkspaceReferencesDir(projectDir)
  return dir ? `${dir}/fulltext` : ''
}

export function resolveGlobalReferencePdfPath(globalConfigDir = '', fileName = '') {
  const dir = resolveGlobalReferencePdfsDir(globalConfigDir)
  return dir && fileName ? `${dir}/${fileName}` : ''
}

export function resolveGlobalReferenceFulltextPath(globalConfigDir = '', fileName = '') {
  const dir = resolveGlobalReferenceFulltextDir(globalConfigDir)
  return dir && fileName ? `${dir}/${fileName}` : ''
}

export function createEmptyWorkspaceReferenceCollection() {
  return {
    version: WORKSPACE_REFERENCE_COLLECTION_VERSION,
    keys: [],
  }
}

export function createEmptyGlobalReferenceWorkbench() {
  return {
    version: GLOBAL_REFERENCE_WORKBENCH_VERSION,
    collections: [],
    savedViews: [],
  }
}

export function parseWorkspaceReferenceCollection(content = '') {
  if (!content) return createEmptyWorkspaceReferenceCollection()

  try {
    const data = JSON.parse(content)
    const keys = Array.isArray(data?.keys) ? data.keys.filter(Boolean) : []
    return {
      version: Number(data?.version) || WORKSPACE_REFERENCE_COLLECTION_VERSION,
      keys: [...new Set(keys)],
    }
  } catch {
    return createEmptyWorkspaceReferenceCollection()
  }
}

export function parseGlobalReferenceWorkbench(content = '') {
  if (!content) return createEmptyGlobalReferenceWorkbench()

  try {
    const data = JSON.parse(content)
    return {
      version: Number(data?.version) || GLOBAL_REFERENCE_WORKBENCH_VERSION,
      collections: Array.isArray(data?.collections) ? data.collections : [],
      savedViews: Array.isArray(data?.savedViews) ? data.savedViews : [],
    }
  } catch {
    return createEmptyGlobalReferenceWorkbench()
  }
}
