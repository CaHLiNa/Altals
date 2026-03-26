import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildHiddenHistoryEntryKey,
  createWorkspaceHistoryVisibilityRuntime,
  filterVisibleHistoryEntries,
  resolveHiddenHistoryIndexPath,
} from '../src/domains/changes/workspaceHistoryVisibilityRuntime.js'

test('workspace history visibility runtime resolves the hidden-history index path', () => {
  assert.equal(
    resolveHiddenHistoryIndexPath('/workspace/.altals'),
    '/workspace/.altals/snapshots/hidden-history.json'
  )
})

test('workspace history visibility runtime records hidden entries and filters matching snapshots', async () => {
  const files = new Map()
  const runtime = createWorkspaceHistoryVisibilityRuntime({
    readFileImpl: async (path) => {
      if (!files.has(path)) {
        throw new Error('missing')
      }
      return files.get(path)
    },
    writeFileImpl: async (path, content) => {
      files.set(path, content)
    },
    createDirImpl: async () => {},
    nowImpl: () => new Date('2026-03-25T09:00:00Z'),
  })

  const snapshot = {
    scope: 'file',
    filePath: '/workspace/demo/draft.md',
    sourceId: 'abc123',
    createdAt: '2026-03-25T08:55:00Z',
    message: 'Save: 2026-03-25 16:55',
  }

  const hidden = await runtime.hideHistoryEntry({
    workspaceDataDir: '/workspace/.altals',
    snapshot,
  })
  const loaded = await runtime.loadHiddenHistoryEntries({
    workspaceDataDir: '/workspace/.altals',
  })
  const filtered = await runtime.filterVisibleEntries({
    workspaceDataDir: '/workspace/.altals',
    snapshots: [
      snapshot,
      {
        ...snapshot,
        sourceId: 'def456',
      },
    ],
  })

  assert.equal(hidden?.key, buildHiddenHistoryEntryKey(snapshot))
  assert.equal(loaded.length, 1)
  assert.deepEqual(filtered, [
    {
      ...snapshot,
      sourceId: 'def456',
    },
  ])
})

test('workspace history visibility runtime also filters local-only synthetic save points by timestamp and message', () => {
  const snapshot = {
    scope: 'workspace',
    filePath: '',
    sourceId: '',
    createdAt: '2026-03-25T08:55:00.000Z',
    message: 'Draft 3 ready',
    rawMessage: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
  }

  const visible = filterVisibleHistoryEntries({
    snapshots: [snapshot],
    hiddenEntries: [
      {
        key: buildHiddenHistoryEntryKey(snapshot),
      },
    ],
  })

  assert.deepEqual(visible, [])
})
