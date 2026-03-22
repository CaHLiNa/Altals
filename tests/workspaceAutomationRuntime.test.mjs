import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createWorkspaceAutomationRuntime,
  DEFAULT_WORKSPACE_SYNC_INTERVAL_MS,
} from '../src/domains/workspace/workspaceAutomationRuntime.js'

test('workspace automation runtime schedules auto-commit and syncs committed changes', async () => {
  const cleared = []
  const handles = []
  const syncStates = []
  const autoCommitCalls = []
  const ensured = []
  const state = {
    path: '/workspace/demo',
    gitAutoCommitInterval: 1234,
    gitAutoCommitTimer: { old: true },
    syncTimer: null,
    githubToken: { token: 'gh-token' },
    remoteUrl: 'https://example.com/repo.git',
  }

  const runtime = createWorkspaceAutomationRuntime({
    getPath: () => state.path,
    getGitAutoCommitInterval: () => state.gitAutoCommitInterval,
    getGitAutoCommitTimer: () => state.gitAutoCommitTimer,
    setGitAutoCommitTimer: (timer) => {
      state.gitAutoCommitTimer = timer
    },
    getSyncTimer: () => state.syncTimer,
    setSyncTimer: (timer) => {
      state.syncTimer = timer
    },
    canAutoCommitWorkspace: async (path) => path === state.path,
    performWorkspaceAutoCommit: async (path) => {
      autoCommitCalls.push(path)
      return { committed: true }
    },
    ensureGitHubInitialized: async () => {
      ensured.push('init')
    },
    getGitHubToken: () => state.githubToken,
    getRemoteUrl: () => state.remoteUrl,
    setRemoteUrl: (remoteUrl) => {
      state.remoteUrl = remoteUrl
    },
    applySyncState: (syncState, remoteUrl) => {
      syncStates.push({ syncState, remoteUrl })
    },
    runWorkspaceAutoSync: async () => ({
      remoteUrl: 'https://example.com/repo.git',
      syncState: { status: 'synced' },
      result: { pushed: true },
    }),
    setIntervalImpl: (fn, ms) => {
      const handle = { fn, ms }
      handles.push(handle)
      return handle
    },
    clearIntervalImpl: (handle) => {
      cleared.push(handle)
    },
  })

  assert.equal(await runtime.startAutoCommit(), true)
  assert.deepEqual(cleared, [{ old: true }])
  assert.equal(handles.length, 1)
  assert.equal(handles[0].ms, 1234)
  assert.equal(state.gitAutoCommitTimer, handles[0])

  await runtime.autoCommit()
  assert.deepEqual(autoCommitCalls, ['/workspace/demo'])
  assert.deepEqual(ensured, ['init'])
  assert.deepEqual(syncStates, [{
    syncState: { status: 'synced' },
    remoteUrl: 'https://example.com/repo.git',
  }])

  runtime.stopAutoCommit()
  assert.deepEqual(cleared, [{ old: true }, handles[0]])
  assert.equal(state.gitAutoCommitTimer, null)
})

test('workspace automation runtime schedules remote fetches and reloads open files after pull', async () => {
  const cleared = []
  const handles = []
  const reloads = []
  const syncStates = []
  const ensured = []
  const state = {
    path: '/workspace/demo',
    gitAutoCommitTimer: null,
    syncTimer: { old: true },
    githubToken: { token: 'gh-token' },
    remoteUrl: 'https://example.com/repo.git',
  }

  const runtime = createWorkspaceAutomationRuntime({
    getPath: () => state.path,
    getGitAutoCommitTimer: () => state.gitAutoCommitTimer,
    setGitAutoCommitTimer: (timer) => {
      state.gitAutoCommitTimer = timer
    },
    getSyncTimer: () => state.syncTimer,
    setSyncTimer: (timer) => {
      state.syncTimer = timer
    },
    ensureGitHubInitialized: async () => {
      ensured.push('init')
    },
    getGitHubToken: () => state.githubToken,
    getRemoteUrl: () => state.remoteUrl,
    setRemoteUrl: (remoteUrl) => {
      state.remoteUrl = remoteUrl
    },
    applySyncState: (syncState, remoteUrl) => {
      syncStates.push({ syncState, remoteUrl })
    },
    fetchWorkspaceRemoteChanges: async () => ({
      remoteUrl: 'https://example.com/updated.git',
      syncState: { status: 'idle', lastSyncTime: '2026-03-22T10:00:00Z' },
      result: { pulled: true },
    }),
    reloadOpenFilesAfterPull: async () => {
      reloads.push('reload')
    },
    setIntervalImpl: (fn, ms) => {
      const handle = { fn, ms }
      handles.push(handle)
      return handle
    },
    clearIntervalImpl: (handle) => {
      cleared.push(handle)
    },
  })

  assert.equal(runtime.startSyncTimer(), true)
  assert.deepEqual(cleared, [{ old: true }])
  assert.equal(handles.length, 1)
  assert.equal(handles[0].ms, DEFAULT_WORKSPACE_SYNC_INTERVAL_MS)
  assert.equal(state.syncTimer, handles[0])

  const pulled = await runtime.fetchRemoteChanges()
  assert.deepEqual(pulled, { pulled: true })
  assert.deepEqual(ensured, ['init'])
  assert.equal(state.remoteUrl, 'https://example.com/updated.git')
  assert.deepEqual(syncStates, [{
    syncState: { status: 'idle', lastSyncTime: '2026-03-22T10:00:00Z' },
    remoteUrl: 'https://example.com/updated.git',
  }])
  assert.deepEqual(reloads, ['reload'])

  runtime.stopSyncTimer()
  assert.deepEqual(cleared, [{ old: true }, handles[0]])
  assert.equal(state.syncTimer, null)
})

test('workspace automation runtime cleanup stops both timers and syncNow reuses current remote', async () => {
  const cleared = []
  const syncStates = []
  const state = {
    path: '/workspace/demo',
    gitAutoCommitTimer: { auto: true },
    syncTimer: { sync: true },
    githubToken: { token: 'gh-token' },
    remoteUrl: 'https://example.com/repo.git',
  }

  const runtime = createWorkspaceAutomationRuntime({
    getPath: () => state.path,
    getGitAutoCommitTimer: () => state.gitAutoCommitTimer,
    setGitAutoCommitTimer: (timer) => {
      state.gitAutoCommitTimer = timer
    },
    getSyncTimer: () => state.syncTimer,
    setSyncTimer: (timer) => {
      state.syncTimer = timer
    },
    ensureGitHubInitialized: async () => {},
    getGitHubToken: () => state.githubToken,
    getRemoteUrl: () => state.remoteUrl,
    applySyncState: (syncState, remoteUrl) => {
      syncStates.push({ syncState, remoteUrl })
    },
    runWorkspaceSyncNow: async () => ({
      syncState: { status: 'synced' },
      result: { pushed: true },
    }),
    clearIntervalImpl: (handle) => {
      cleared.push(handle)
    },
  })

  assert.deepEqual(await runtime.syncNow(), { pushed: true })
  assert.deepEqual(syncStates, [{
    syncState: { status: 'synced' },
    remoteUrl: 'https://example.com/repo.git',
  }])

  runtime.cleanup()
  assert.deepEqual(cleared, [{ auto: true }, { sync: true }])
  assert.equal(state.gitAutoCommitTimer, null)
  assert.equal(state.syncTimer, null)
})
