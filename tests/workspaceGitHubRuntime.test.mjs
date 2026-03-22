import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceGitHubRuntime } from '../src/domains/workspace/workspaceGitHubRuntime.js'

function createState() {
  return {
    path: '/workspace/demo',
    remoteUrl: '',
    githubToken: null,
    githubUser: null,
    githubInitialized: false,
    _githubInitPromise: null,
    syncStatus: 'disconnected',
    syncError: null,
    syncErrorType: null,
    syncConflictBranch: null,
    lastSyncTime: null,
  }
}

function createRuntime(state, overrides = {}) {
  return createWorkspaceGitHubRuntime({
    getPath: () => state.path,
    getRemoteUrl: () => state.remoteUrl,
    getGitHubToken: () => state.githubToken,
    getGitHubInitialized: () => state.githubInitialized,
    getGitHubInitPromise: () => state._githubInitPromise,
    setGitHubInitPromise: (promise) => {
      state._githubInitPromise = promise
    },
    patchState: (patch) => {
      Object.assign(state, patch)
    },
    createDisconnectedGitHubState: ({ remoteUrl = '' } = {}) => ({
      githubToken: null,
      githubUser: null,
      syncStatus: 'disconnected',
      syncError: null,
      syncErrorType: null,
      syncConflictBranch: null,
      lastSyncTime: null,
      remoteUrl,
    }),
    mapWorkspaceSyncState: (syncState = {}, currentRemoteUrl = '') => ({
      syncStatus: syncState.status,
      syncError: syncState.error ?? null,
      syncErrorType: syncState.errorType ?? null,
      syncConflictBranch: syncState.conflictBranch ?? null,
      lastSyncTime: syncState.lastSyncTime ?? null,
      remoteUrl: syncState.remoteUrl || currentRemoteUrl,
    }),
    ...overrides,
  })
}

test('workspace github runtime initializes session and starts sync timer for idle remotes', async () => {
  const state = createState()
  const syncStarts = []

  const runtime = createRuntime(state, {
    loadWorkspaceGitHubSession: async () => ({
      token: { token: 'gh-token' },
      user: { login: 'writer' },
      remoteUrl: 'https://example.com/repo.git',
      syncStatus: 'idle',
    }),
    startSyncTimer: () => {
      syncStarts.push('start')
    },
  })

  const initPromise = runtime.ensureGitHubInitialized()
  assert.ok(state._githubInitPromise)

  assert.deepEqual(await initPromise, { token: 'gh-token' })
  assert.deepEqual(syncStarts, ['start'])
  assert.deepEqual(state.githubToken, { token: 'gh-token' })
  assert.deepEqual(state.githubUser, { login: 'writer' })
  assert.equal(state.remoteUrl, 'https://example.com/repo.git')
  assert.equal(state.syncStatus, 'idle')
  assert.equal(state.githubInitialized, true)
  assert.equal(state._githubInitPromise, null)
})

test('workspace github runtime disconnect resets session state and preserves known remote url', async () => {
  const state = createState()
  state.remoteUrl = 'https://example.com/repo.git'
  state.githubToken = { token: 'gh-token' }
  state.githubUser = { login: 'writer' }
  state.githubInitialized = true
  state._githubInitPromise = Promise.resolve('stale')

  const stops = []
  const disconnects = []
  const runtime = createRuntime(state, {
    disconnectWorkspaceGitHub: async () => {
      disconnects.push('disconnect')
    },
    stopSyncTimer: () => {
      stops.push('stop')
    },
  })

  await runtime.disconnectGitHub()

  assert.deepEqual(disconnects, ['disconnect'])
  assert.deepEqual(stops, ['stop'])
  assert.equal(state.remoteUrl, 'https://example.com/repo.git')
  assert.equal(state.syncStatus, 'disconnected')
  assert.equal(state.githubToken, null)
  assert.equal(state.githubUser, null)
  assert.equal(state.githubInitialized, true)
  assert.equal(state._githubInitPromise, null)
})

test('workspace github runtime links repos, starts timers, and unlinks cleanly', async () => {
  const state = createState()
  const autoCommitStarts = []
  const syncStarts = []
  const autoSyncs = []
  const syncStops = []
  const unlinks = []

  const runtime = createRuntime(state, {
    linkWorkspaceRepo: async () => ({
      remoteUrl: 'https://example.com/repo.git',
      syncStatus: 'idle',
      historyRepo: { autoCommitEnabled: true },
    }),
    unlinkWorkspaceRepo: async (path) => {
      unlinks.push(path)
    },
    startAutoCommit: async () => {
      autoCommitStarts.push('start')
      return true
    },
    startSyncTimer: () => {
      syncStarts.push('start')
    },
    stopSyncTimer: () => {
      syncStops.push('stop')
    },
    autoSync: async () => {
      autoSyncs.push('sync')
    },
  })

  await runtime.linkRepo('https://example.com/repo.git')
  assert.equal(state.remoteUrl, 'https://example.com/repo.git')
  assert.equal(state.syncStatus, 'idle')
  assert.deepEqual(autoCommitStarts, ['start'])
  assert.deepEqual(syncStarts, ['start'])
  assert.deepEqual(autoSyncs, ['sync'])

  state.syncConflictBranch = 'conflict/demo'
  await runtime.unlinkRepo()
  assert.deepEqual(unlinks, ['/workspace/demo'])
  assert.deepEqual(syncStops, ['stop'])
  assert.equal(state.remoteUrl, '')
  assert.equal(state.syncStatus, 'disconnected')
  assert.equal(state.syncConflictBranch, null)
})

test('workspace github runtime applies mapped sync state using the current remote by default', async () => {
  const state = createState()
  state.remoteUrl = 'https://example.com/repo.git'

  const runtime = createRuntime(state)
  runtime.applySyncState({
    status: 'conflict',
    error: 'needs attention',
    errorType: 'conflict',
    conflictBranch: 'conflict/demo',
    lastSyncTime: '2026-03-22T10:00:00Z',
  })

  assert.equal(state.remoteUrl, 'https://example.com/repo.git')
  assert.equal(state.syncStatus, 'conflict')
  assert.equal(state.syncError, 'needs attention')
  assert.equal(state.syncErrorType, 'conflict')
  assert.equal(state.syncConflictBranch, 'conflict/demo')
  assert.equal(state.lastSyncTime, '2026-03-22T10:00:00Z')
})
