import { gitAdd, gitCommit, gitStatus } from './git'
import { pathExists } from './workspaceBootstrap'
import { getHomeDirCached, normalizePathValue } from './workspacePaths'

export async function canAutoCommitWorkspace(path = '') {
  if (!path) return false
  const normalizedPath = normalizePathValue(path)
  const normalizedHome = await getHomeDirCached()
  if (normalizedHome && normalizedPath === normalizedHome) {
    return false
  }
  return pathExists(`${normalizedPath}/.git`)
}

export async function runWorkspaceAutoCommit(path = '') {
  if (!(await canAutoCommitWorkspace(path))) return { committed: false }

  await gitAdd(path)
  const status = await gitStatus(path)
  if (!status.trim()) {
    return { committed: false }
  }

  const now = new Date()
  const timestamp = now.toISOString().replace('T', ' ').substring(0, 16)
  await gitCommit(path, `Auto: ${timestamp}`)
  return {
    committed: true,
    timestamp,
  }
}
