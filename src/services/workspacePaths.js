import { dirnamePath, normalizeFsPath } from '../utils/path'
import { getHomeDir } from './appDirs.js'

let cachedHomeDir = undefined

export async function hashWorkspacePath(value = '') {
  const bytes = new TextEncoder().encode(String(value || ''))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function resolveWorkspaceDataDir(globalConfigDir = '', workspaceId = '') {
  if (!globalConfigDir || !workspaceId) return ''
  return `${globalConfigDir}/workspaces/${workspaceId}`
}

export function resolveClaudeConfigDir(globalConfigDir = '') {
  const normalized = normalizeFsPath(globalConfigDir).replace(/\/+$/, '')
  if (!normalized) return ''
  const parentDir = dirnamePath(normalized)
  if (!parentDir || parentDir === '.') return ''
  return `${parentDir}/.claude`
}

export function resolveSkillPath(projectDir = '', rawPath = '') {
  const value = String(rawPath || '').trim()
  if (!projectDir || !value) return value
  if (value.startsWith('/')) return value
  if (value.startsWith('.project/')) return `${projectDir}/${value.slice('.project/'.length)}`
  return `${projectDir}/${value.replace(/^\.\//, '')}`
}

export function normalizePathValue(value = '') {
  const normalized = normalizeFsPath(value).replace(/\/+$/, '')
  return normalized || '/'
}

export async function getHomeDirCached() {
  if (cachedHomeDir !== undefined) return cachedHomeDir
  try {
    cachedHomeDir = normalizePathValue(await getHomeDir())
  } catch {
    cachedHomeDir = ''
  }
  return cachedHomeDir
}
