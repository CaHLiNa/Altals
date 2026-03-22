import { gitRemoteGetUrl } from './git'
import { createWorkspaceRepoLinkRuntime } from '../domains/git/workspaceRepoLinkRuntime.js'
import { ensureWorkspaceHistoryRepo } from './workspaceHistoryRepo.js'
import {
  enableWorkspaceAutoCommit,
  runWorkspaceAutoCommit as performWorkspaceAutoCommit,
} from './workspaceAutoCommit'

const workspaceRepoLinkRuntime = createWorkspaceRepoLinkRuntime({
  ensureWorkspaceHistoryRepoImpl: ensureWorkspaceHistoryRepo,
  enableWorkspaceAutoCommitImpl: enableWorkspaceAutoCommit,
  runWorkspaceAutoCommitImpl: performWorkspaceAutoCommit,
})

function normalizeGitHubUser(user = {}) {
  return {
    login: user.login,
    name: user.name,
    email: user.email,
    id: user.id,
    avatarUrl: user.avatarUrl || user.avatar_url,
  }
}

export function createDisconnectedGitHubState(overrides = {}) {
  return {
    githubToken: null,
    githubUser: null,
    syncStatus: 'disconnected',
    syncError: null,
    syncErrorType: null,
    syncConflictBranch: null,
    lastSyncTime: null,
    remoteUrl: '',
    ...overrides,
  }
}

export function mapWorkspaceSyncState(syncState = {}, currentRemoteUrl = '') {
  return {
    syncStatus: syncState.status,
    syncError: syncState.error,
    syncErrorType: syncState.errorType || null,
    syncConflictBranch: syncState.conflictBranch,
    lastSyncTime: syncState.lastSyncTime,
    remoteUrl: syncState.remoteUrl || currentRemoteUrl,
  }
}

export async function loadWorkspaceGitHubSession(path = '', options = {}) {
  const { loadGitHubToken, getGitHubUser } = await import('./githubSync')
  const stored = await loadGitHubToken(options)
  if (!stored?.token) return null

  let user
  try {
    user = normalizeGitHubUser(await getGitHubUser(stored.token))
  } catch {
    return null
  }

  let remoteUrl = ''
  let syncStatus = 'disconnected'
  if (path) {
    remoteUrl = await gitRemoteGetUrl(path)
    syncStatus = remoteUrl ? 'idle' : 'disconnected'
  }

  return {
    token: stored,
    user,
    remoteUrl,
    syncStatus,
  }
}

export async function runWorkspaceAutoSync(path = '', token = '') {
  if (!path || !token) return null
  const remoteUrl = await gitRemoteGetUrl(path)
  if (!remoteUrl) return null

  const { syncNow, syncState } = await import('./githubSync')
  const result = await syncNow(path, token, { quietNetworkErrors: true })
  return {
    remoteUrl,
    syncState,
    result,
  }
}

export async function fetchWorkspaceRemoteChanges(path = '', token = '') {
  if (!path || !token) return null
  const remoteUrl = await gitRemoteGetUrl(path)
  if (!remoteUrl) return null

  const { fetchAndPull, syncState } = await import('./githubSync')
  const result = await fetchAndPull(path, token)
  return {
    remoteUrl,
    syncState,
    result,
  }
}

export async function runWorkspaceSyncNow(path = '', token = '') {
  if (!path || !token) return null
  const { syncNow, syncState } = await import('./githubSync')
  const result = await syncNow(path, token, { quietNetworkErrors: false })
  return { syncState, result }
}

export async function connectWorkspaceGitHub({ tokenData, path = '' }) {
  const { storeGitHubToken, getGitHubUser, configureGitUser, ensureGitignore } = await import('./githubSync')
  await storeGitHubToken(tokenData)

  let user
  if (tokenData.login) {
    user = normalizeGitHubUser(tokenData)
  } else {
    user = normalizeGitHubUser(await getGitHubUser(tokenData.token))
  }

  if (path) {
    await configureGitUser(path, user)
    await ensureGitignore(path)
  }

  return {
    token: tokenData,
    user,
  }
}

export async function disconnectWorkspaceGitHub() {
  const { clearGitHubToken } = await import('./githubSync')
  await clearGitHubToken()
}

export async function linkWorkspaceRepo(path = '', cloneUrl = '') {
  const { setupRemote, ensureGitignore } = await import('./githubSync')
  return workspaceRepoLinkRuntime.linkWorkspaceRepo({
    path,
    cloneUrl,
    setupRemoteImpl: setupRemote,
    ensureGitignoreImpl: ensureGitignore,
  })
}

export async function unlinkWorkspaceRepo(path = '') {
  if (!path) return
  const { removeRemote } = await import('./githubSync')
  await removeRemote(path)
}
