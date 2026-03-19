import { gitAdd, gitCommit, gitInit, gitLog, gitStatus } from './git'
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

export async function ensureWorkspaceHistoryRepo(path = '', options = {}) {
  const {
    seedInitialCommit = false,
    seedMessage = 'Initial snapshot',
  } = options
  if (!path) return { ok: false, reason: 'missing' }

  const normalizedPath = normalizePathValue(path)
  const normalizedHome = await getHomeDirCached()
  if (normalizedHome && normalizedPath === normalizedHome) {
    return { ok: false, reason: 'home' }
  }

  const hasRepo = await pathExists(`${normalizedPath}/.git`)
  let initialized = false
  if (hasRepo) {
    initialized = false
  } else {
    await gitInit(normalizedPath)
    initialized = true
  }

  if (!seedInitialCommit) {
    return { ok: true, initialized, seeded: false }
  }

  const commits = await gitLog(normalizedPath, null, 1)
  if (commits.length > 0) {
    return { ok: true, initialized, seeded: false }
  }

  await gitAdd(normalizedPath)
  const status = await gitStatus(normalizedPath)
  if (!status.trim()) {
    return { ok: true, initialized, seeded: false, empty: true }
  }

  await gitCommit(normalizedPath, seedMessage)
  return { ok: true, initialized, seeded: true }
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
