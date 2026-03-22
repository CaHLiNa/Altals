import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceHistoryAvailabilityRuntime } from '../src/domains/changes/workspaceHistoryAvailabilityRuntime.js'

test('workspace history availability runtime returns null and reports unavailable workspaces', async () => {
  let unavailableCalls = 0
  const runtime = createWorkspaceHistoryAvailabilityRuntime({
    ensureWorkspaceHistoryRepoImpl: async () => ({ ok: false }),
  })

  const result = await runtime.ensureWorkspaceHistoryAvailable({
    workspacePath: '/workspace/demo',
    onUnavailable: () => {
      unavailableCalls += 1
    },
  })

  assert.equal(result, null)
  assert.equal(unavailableCalls, 1)
})

test('workspace history availability runtime reuses existing auto-commit enablement without enabling twice', async () => {
  let enabledCalls = 0
  const runtime = createWorkspaceHistoryAvailabilityRuntime({
    ensureWorkspaceHistoryRepoImpl: async () => ({ ok: true, seeded: false }),
    canAutoCommitWorkspaceImpl: async () => true,
    enableWorkspaceAutoCommitImpl: async () => {
      throw new Error('should not enable when already active')
    },
  })

  const result = await runtime.ensureWorkspaceHistoryAvailable({
    workspacePath: '/workspace/demo',
    options: { enableAutoCommit: true },
    onAutoCommitEnabled: () => {
      enabledCalls += 1
    },
  })

  assert.deepEqual(result, {
    ok: true,
    seeded: false,
    autoCommitEnabled: true,
  })
  assert.equal(enabledCalls, 1)
})

test('workspace history availability runtime enables auto-commit when requested and currently disabled', async () => {
  const calls = []
  const runtime = createWorkspaceHistoryAvailabilityRuntime({
    ensureWorkspaceHistoryRepoImpl: async (workspacePath, options) => {
      calls.push(['ensure', workspacePath, options.enableAutoCommit ?? false])
      return { ok: true, seeded: true }
    },
    canAutoCommitWorkspaceImpl: async (workspacePath) => {
      calls.push(['canAutoCommit', workspacePath])
      return false
    },
    enableWorkspaceAutoCommitImpl: async (workspacePath) => {
      calls.push(['enableAutoCommit', workspacePath])
      return true
    },
  })

  let enabledCalls = 0
  const result = await runtime.ensureWorkspaceHistoryAvailable({
    workspacePath: '/workspace/demo',
    options: {
      enableAutoCommit: true,
      seedInitialCommit: true,
    },
    onAutoCommitEnabled: () => {
      enabledCalls += 1
    },
  })

  assert.deepEqual(calls, [
    ['ensure', '/workspace/demo', true],
    ['canAutoCommit', '/workspace/demo'],
    ['enableAutoCommit', '/workspace/demo'],
  ])
  assert.deepEqual(result, {
    ok: true,
    seeded: true,
    autoCommitEnabled: true,
  })
  assert.equal(enabledCalls, 1)
})
