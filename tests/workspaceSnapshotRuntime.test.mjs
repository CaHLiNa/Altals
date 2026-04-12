import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createWorkspaceSnapshotRuntime,
  getWorkspaceSnapshotDisplayMessage,
  isFileWorkspaceSnapshot,
  isNamedWorkspaceSnapshot,
} from '../src/domains/changes/workspaceSnapshotRuntime.js'

test('workspace snapshot runtime exposes simple record helpers for save points', () => {
  const named = {
    id: 'local:workspace:workspace123',
    scope: 'workspace',
    kind: 'named',
    message: 'Draft 3 ready',
  }
  const auto = {
    id: 'local:workspace:workspace124',
    scope: 'workspace',
    kind: 'save',
    message: 'Save: 2026-03-22 10:12',
  }
  const fileScoped = {
    id: 'local:file:file123',
    scope: 'file',
    kind: 'save',
    message: 'Save: 2026-03-22 10:13',
  }

  assert.equal(isNamedWorkspaceSnapshot(named), true)
  assert.equal(isNamedWorkspaceSnapshot(auto), false)
  assert.equal(isFileWorkspaceSnapshot(named), false)
  assert.equal(isFileWorkspaceSnapshot(fileScoped), true)
  assert.equal(getWorkspaceSnapshotDisplayMessage(named), 'Draft 3 ready')
  assert.equal(getWorkspaceSnapshotDisplayMessage(auto), 'Save: 2026-03-22 10:12')
})

test('workspace snapshot runtime lists visible local workspace save points and applies limits', async () => {
  const calls = []
  const runtime = createWorkspaceSnapshotRuntime({
    localSnapshotStoreRuntime: {
      loadWorkspaceSavePointEntries: async ({ workspaceDataDir }) => {
        calls.push(['load', workspaceDataDir])
        return [
          {
            id: 'local:workspace:newer',
            scope: 'workspace',
            kind: 'named',
            message: 'Draft 3 ready',
          },
          {
            id: 'local:workspace:older',
            scope: 'workspace',
            kind: 'save',
            message: 'Save: 2026-03-22 10:12',
          },
        ]
      },
    },
    historyVisibilityRuntime: {
      filterVisibleEntries: async ({ workspaceDataDir, snapshots }) => {
        calls.push(['filter', workspaceDataDir, snapshots.length])
        return snapshots.filter((snapshot) => snapshot.id !== 'local:workspace:older')
      },
    },
  })

  const limited = await runtime.listWorkspaceSavePointEntries({
    workspacePath: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
    limit: 1,
  })
  const unlimited = await runtime.listWorkspaceSavePointEntries({
    workspacePath: '/workspace/demo',
    workspaceDataDir: '/workspace/.altals',
    limit: 0,
  })

  assert.deepEqual(calls, [
    ['load', '/workspace/.altals'],
    ['filter', '/workspace/.altals', 2],
    ['load', '/workspace/.altals'],
    ['filter', '/workspace/.altals', 2],
  ])
  assert.deepEqual(limited, [
    {
      id: 'local:workspace:newer',
      scope: 'workspace',
      kind: 'named',
      message: 'Draft 3 ready',
    },
  ])
  assert.deepEqual(unlimited, [
    {
      id: 'local:workspace:newer',
      scope: 'workspace',
      kind: 'named',
      message: 'Draft 3 ready',
    },
  ])
})

test('workspace snapshot runtime returns an empty list when no workspace path is available', async () => {
  const runtime = createWorkspaceSnapshotRuntime({
    localSnapshotStoreRuntime: {
      loadWorkspaceSavePointEntries: async () => {
        throw new Error('should not load without a workspace path')
      },
    },
  })

  const result = await runtime.listWorkspaceSavePointEntries({
    workspacePath: '',
    workspaceDataDir: '/workspace/.altals',
  })

  assert.deepEqual(result, [])
})
