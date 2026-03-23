export const WORKSPACE_STARTER_DRAFT_EXTENSIONS = Object.freeze([
  '.md',
  '.qmd',
  '.rmd',
  '.tex',
  '.typ',
])

export const WORKSPACE_STARTER_COMPUTATION_EXTENSIONS = Object.freeze([
  '.ipynb',
  '.py',
  '.r',
  '.jl',
])

export function normalizeWorkspaceStarterPath(path = '') {
  return String(path || '').replace(/\\/g, '/')
}

export function getWorkspaceStarterFileExtension(path = '') {
  const normalizedPath = normalizeWorkspaceStarterPath(path)
  const baseName = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)
  const dotIndex = baseName.lastIndexOf('.')
  if (dotIndex <= 0) return ''
  return baseName.slice(dotIndex).toLowerCase()
}

export function countWorkspaceStarterFilesByExtension(files = [], extensions = []) {
  const allowedExtensions = new Set(
    Array.from(extensions || [], (extension) => String(extension || '').toLowerCase()),
  )

  let count = 0
  for (const file of files || []) {
    const path = typeof file === 'string' ? file : file?.path
    if (allowedExtensions.has(getWorkspaceStarterFileExtension(path))) {
      count += 1
    }
  }
  return count
}

export function getWorkspaceStarterRelativePath(path = '', workspacePath = '') {
  const normalizedPath = normalizeWorkspaceStarterPath(path)
  const normalizedWorkspacePath = normalizeWorkspaceStarterPath(workspacePath)

  if (!normalizedPath) return ''
  if (!normalizedWorkspacePath) return normalizedPath
  if (normalizedPath === normalizedWorkspacePath) return ''
  if (normalizedPath.startsWith(`${normalizedWorkspacePath}/`)) {
    return normalizedPath.slice(normalizedWorkspacePath.length + 1)
  }
  return normalizedPath
}

export function getWorkspaceStarterDirectory(path = '', workspacePath = '') {
  const relativePath = getWorkspaceStarterRelativePath(path, workspacePath)
  if (!relativePath) return ''

  const lastSlashIndex = relativePath.lastIndexOf('/')
  if (lastSlashIndex <= 0) return ''
  return relativePath.slice(0, lastSlashIndex)
}
