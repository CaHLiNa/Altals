import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspaceHistoryPointRuntime } from '../src/domains/changes/workspaceHistoryPointRuntime.js'
import { parseWorkspaceSnapshotPersistedMessage } from '../src/domains/changes/workspaceSnapshotManifestRuntime.js'

test('workspace history point runtime turns a requested label into a named history point before commit', async () => {
  const calls = []
  const runtime = createWorkspaceHistoryPointRuntime({
    availabilityRuntime: {
      ensureWorkspaceHistoryAvailable: async () => {
        calls.push(['availability'])
        return { ok: true }
      },
    },
    preparationRuntime: {
      prepareWorkspaceHistoryFiles: async () => {
        calls.push(['prepare'])
        return { ok: true }
      },
    },
    commitRuntime: {
      commitPreparedWorkspaceHistory: async (input) => {
        calls.push(['commit', input.workspacePath, input.preferredCommitMessage])
        return {
          committed: true,
          reason: 'committed',
          commitMessage: input.preferredCommitMessage,
          historyEntry: {
            hash: 'abc123',
            date: '2026-03-22T10:11:00Z',
            message: input.preferredCommitMessage,
          },
        }
      },
    },
    createSnapshotRecordImpl: ({ entry }) => ({
      id: `snapshot:${entry.hash || 'synthetic'}`,
      message: parseWorkspaceSnapshotPersistedMessage(entry.message).message,
    }),
  })

  const result = await runtime.createHistoryPoint({
    workspace: { path: '/workspace/demo' },
    filesStore: {},
    editorStore: {},
    requestHistoryLabel: async () => '  Draft 3 ready  ',
  })

  assert.deepEqual(calls, [
    ['availability'],
    ['prepare'],
    ['commit', '/workspace/demo', 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]'],
  ])
  assert.deepEqual(result, {
    committed: true,
    reason: 'committed',
    commitMessage: 'Draft 3 ready',
    historyEntry: {
      hash: 'abc123',
      date: '2026-03-22T10:11:00Z',
      message: 'Draft 3 ready [[altals-snapshot:v=1;scope=workspace;kind=named]]',
    },
    historyAvailability: {
      ok: true,
    },
    historyPoint: {
      kind: 'named',
      label: 'Draft 3 ready',
      commitMessage: 'Draft 3 ready',
    },
    snapshot: {
      id: 'snapshot:abc123',
      message: 'Draft 3 ready',
    },
  })
})

test('workspace history point runtime falls back to the save message when no label is provided', async () => {
  const runtime = createWorkspaceHistoryPointRuntime({
    availabilityRuntime: {
      ensureWorkspaceHistoryAvailable: async () => ({ ok: true }),
    },
    preparationRuntime: {
      prepareWorkspaceHistoryFiles: async () => ({ ok: true }),
    },
    commitRuntime: {
      commitPreparedWorkspaceHistory: async (input) => ({
        committed: true,
        reason: 'committed',
        commitMessage: input.preferredCommitMessage,
        historyEntry: null,
      }),
    },
    buildSaveMessageImpl: ({ t }) => t('save-message'),
    createSnapshotRecordImpl: ({ entry }) => {
      const parsed = parseWorkspaceSnapshotPersistedMessage(entry.message)
      return {
        id: `snapshot:${parsed.message}`,
        message: parsed.message,
      }
    },
  })

  const result = await runtime.createHistoryPoint({
    workspace: { path: '/workspace/demo' },
    filesStore: {},
    editorStore: {},
    requestHistoryLabel: async () => '   ',
    t: (value) => `translated:${value}`,
  })

  assert.deepEqual(result, {
    committed: true,
    reason: 'committed',
    commitMessage: 'translated:save-message',
    historyEntry: null,
    historyAvailability: {
      ok: true,
    },
    historyPoint: {
      kind: 'save',
      label: '',
      commitMessage: 'translated:save-message',
    },
    snapshot: {
      id: 'snapshot:translated:save-message',
      message: 'translated:save-message',
    },
  })
})

test('workspace history point runtime surfaces no-change commits through showNoChanges without re-prompting', async () => {
  let noChangesCalls = 0
  const runtime = createWorkspaceHistoryPointRuntime({
    availabilityRuntime: {
      ensureWorkspaceHistoryAvailable: async () => ({ ok: true }),
    },
    preparationRuntime: {
      prepareWorkspaceHistoryFiles: async () => ({ ok: true }),
    },
    commitRuntime: {
      commitPreparedWorkspaceHistory: async () => ({
        committed: false,
        reason: 'no-changes',
      }),
    },
    buildSaveMessageImpl: () => 'Save: 2026-03-22 20:10',
  })

  const result = await runtime.createHistoryPoint({
    workspace: { path: '/workspace/demo' },
    filesStore: {},
    editorStore: {},
    showNoChanges: () => {
      noChangesCalls += 1
    },
  })

  assert.equal(noChangesCalls, 1)
  assert.deepEqual(result, {
    committed: false,
    reason: 'no-changes',
    historyAvailability: {
      ok: true,
    },
    historyPoint: {
      kind: 'save',
      label: '',
      commitMessage: 'Save: 2026-03-22 20:10',
    },
  })
})
