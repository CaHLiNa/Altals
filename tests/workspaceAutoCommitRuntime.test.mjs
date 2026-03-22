import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceAutoCommitRuntime } from '../src/domains/changes/workspaceAutoCommitRuntime.js'

test('workspace auto-commit runtime writes the enablement marker only when the repo exists', async () => {
  const calls = []
  const runtime = createWorkspaceAutoCommitRuntime({
    pathExistsImpl: async (path) => {
      calls.push(['pathExists', path])
      return path === '/workspace/demo/.git'
    },
    writeFileImpl: async (path, content) => {
      calls.push(['writeFile', path, content])
    },
  })

  const result = await runtime.enableWorkspaceAutoCommit('/workspace/demo/')

  assert.equal(result, true)
  assert.deepEqual(calls, [
    ['pathExists', '/workspace/demo/.git'],
    ['writeFile', '/workspace/demo/.git/altals-auto-commit-enabled', '1\n'],
  ])
})

test('workspace auto-commit runtime keeps the home directory ineligible and checks the marker elsewhere', async () => {
  const markerChecks = []
  const runtime = createWorkspaceAutoCommitRuntime({
    getHomeDirCachedImpl: async () => '/Users/demo',
    pathExistsImpl: async (path) => {
      markerChecks.push(path)
      return true
    },
  })

  assert.equal(await runtime.canAutoCommitWorkspace('/Users/demo'), false)
  assert.equal(await runtime.canAutoCommitWorkspace('/workspace/demo/'), true)
  assert.deepEqual(markerChecks, [
    '/workspace/demo/.git/altals-auto-commit-enabled',
  ])
})

test('workspace auto-commit runtime short-circuits when the marker is not enabled', async () => {
  const calls = []
  const runtime = createWorkspaceAutoCommitRuntime({
    getHomeDirCachedImpl: async () => '/Users/demo',
    pathExistsImpl: async (path) => {
      calls.push(['pathExists', path])
      return false
    },
    gitAddImpl: async () => {
      calls.push(['gitAdd'])
    },
  })

  const result = await runtime.runWorkspaceAutoCommit('/workspace/demo')

  assert.deepEqual(result, { committed: false })
  assert.deepEqual(calls, [
    ['pathExists', '/workspace/demo/.git/altals-auto-commit-enabled'],
  ])
})

test('workspace auto-commit runtime skips the commit when git status is empty', async () => {
  const calls = []
  const runtime = createWorkspaceAutoCommitRuntime({
    getHomeDirCachedImpl: async () => '',
    pathExistsImpl: async () => true,
    gitAddImpl: async (workspacePath) => {
      calls.push(['gitAdd', workspacePath])
    },
    gitStatusImpl: async (workspacePath) => {
      calls.push(['gitStatus', workspacePath])
      return '   '
    },
    gitCommitImpl: async () => {
      calls.push(['gitCommit'])
    },
  })

  const result = await runtime.runWorkspaceAutoCommit('/workspace/demo')

  assert.deepEqual(result, { committed: false })
  assert.deepEqual(calls, [
    ['gitAdd', '/workspace/demo'],
    ['gitStatus', '/workspace/demo'],
  ])
})

test('workspace auto-commit runtime reuses the shared auto-message helper for commit text', async () => {
  const calls = []
  const runtime = createWorkspaceAutoCommitRuntime({
    getHomeDirCachedImpl: async () => '',
    pathExistsImpl: async () => true,
    gitAddImpl: async (workspacePath) => {
      calls.push(['gitAdd', workspacePath])
    },
    gitStatusImpl: async (workspacePath) => {
      calls.push(['gitStatus', workspacePath])
      return 'M draft.md'
    },
    buildAutoMessageImpl: ({ now }) => {
      calls.push(['buildAutoMessage', now instanceof Date])
      return 'Auto: shared-message'
    },
    formatTimestampImpl: () => '2026-03-22 10:11',
    gitCommitImpl: async (workspacePath, message) => {
      calls.push(['gitCommit', workspacePath, message])
    },
  })

  const result = await runtime.runWorkspaceAutoCommit('/workspace/demo/')

  assert.deepEqual(result, {
    committed: true,
    timestamp: '2026-03-22 10:11',
  })
  assert.deepEqual(calls, [
    ['gitAdd', '/workspace/demo'],
    ['gitStatus', '/workspace/demo'],
    ['buildAutoMessage', true],
    ['gitCommit', '/workspace/demo', 'Auto: shared-message'],
  ])
})
