import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceRepoLinkRuntime } from '../src/domains/git/workspaceRepoLinkRuntime.js'

test('workspace repo link runtime skips linking when no workspace path is provided', async () => {
  const runtime = createWorkspaceRepoLinkRuntime({
    ensureWorkspaceHistoryRepoImpl: async () => {
      throw new Error('should not initialize without a path')
    },
  })

  const result = await runtime.linkWorkspaceRepo({
    path: '',
    cloneUrl: 'https://example.com/repo.git',
  })

  assert.equal(result, null)
})

test('workspace repo link runtime throws when the local history repo cannot be prepared', async () => {
  const calls = []
  const runtime = createWorkspaceRepoLinkRuntime({
    ensureWorkspaceHistoryRepoImpl: async (path, options) => {
      calls.push(['ensureHistoryRepo', path, options.seedInitialCommit, options.seedMessage])
      return { ok: false }
    },
    enableWorkspaceAutoCommitImpl: async () => {
      calls.push(['enableAutoCommit'])
      return true
    },
  })

  await assert.rejects(
    runtime.linkWorkspaceRepo({
      path: '/workspace/demo',
      cloneUrl: 'https://example.com/repo.git',
    }),
    /Failed to initialize a local Git repository/,
  )

  assert.deepEqual(calls, [
    ['ensureHistoryRepo', '/workspace/demo', true, 'Initial history'],
  ])
})

test('workspace repo link runtime keeps local history setup ahead of remote setup and swallows initial auto-commit failures', async () => {
  const calls = []
  const runtime = createWorkspaceRepoLinkRuntime({
    ensureWorkspaceHistoryRepoImpl: async (path, options) => {
      calls.push(['ensureHistoryRepo', path, options.seedInitialCommit, options.seedMessage])
      return { ok: true, seeded: true }
    },
    enableWorkspaceAutoCommitImpl: async (path) => {
      calls.push(['enableAutoCommit', path])
      throw new Error('marker write failed')
    },
    runWorkspaceAutoCommitImpl: async (path) => {
      calls.push(['runAutoCommit', path])
      throw new Error('no staged changes')
    },
  })

  const result = await runtime.linkWorkspaceRepo({
    path: '/workspace/demo',
    cloneUrl: 'https://example.com/repo.git',
    setupRemoteImpl: async (path, cloneUrl) => {
      calls.push(['setupRemote', path, cloneUrl])
    },
    ensureGitignoreImpl: async (path) => {
      calls.push(['ensureGitignore', path])
    },
  })

  assert.deepEqual(calls, [
    ['ensureHistoryRepo', '/workspace/demo', true, 'Initial history'],
    ['enableAutoCommit', '/workspace/demo'],
    ['setupRemote', '/workspace/demo', 'https://example.com/repo.git'],
    ['ensureGitignore', '/workspace/demo'],
    ['runAutoCommit', '/workspace/demo'],
  ])
  assert.deepEqual(result, {
    remoteUrl: 'https://example.com/repo.git',
    syncStatus: 'idle',
    historyRepo: {
      ok: true,
      seeded: true,
      autoCommitEnabled: false,
    },
  })
})
