import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDefaultWorkspaceHistoryCommitMessage,
  createWorkspaceHistoryCommitRuntime,
} from '../src/domains/changes/workspaceHistoryCommitRuntime.js'

test('workspace history commit runtime stages and commits with a preferred commit message', async () => {
  const calls = []
  const runtime = createWorkspaceHistoryCommitRuntime({
    gitAddImpl: async (workspacePath) => {
      calls.push(['gitAdd', workspacePath])
    },
    gitStatusImpl: async (workspacePath) => {
      calls.push(['gitStatus', workspacePath])
      return ' M chapter.md'
    },
    gitCommitImpl: async (workspacePath, message) => {
      calls.push(['gitCommit', workspacePath, message])
    },
    gitLogImpl: async (workspacePath, ref, limit) => {
      calls.push(['gitLog', workspacePath, ref, limit])
      return [{
        hash: 'abc123',
        date: '2026-03-22T10:11:00Z',
        message: 'Named snapshot',
      }]
    },
  })

  const result = await runtime.commitPreparedWorkspaceHistory({
    workspacePath: '/workspace/demo',
    preferredCommitMessage: 'Named snapshot',
    requestCommitMessage: async () => 'ignored prompt',
  })

  assert.deepEqual(calls, [
    ['gitAdd', '/workspace/demo'],
    ['gitStatus', '/workspace/demo'],
    ['gitCommit', '/workspace/demo', 'Named snapshot'],
    ['gitLog', '/workspace/demo', null, 1],
  ])
  assert.deepEqual(result, {
    committed: true,
    reason: 'committed',
    commitMessage: 'Named snapshot',
    historyEntry: {
      hash: 'abc123',
      date: '2026-03-22T10:11:00Z',
      message: 'Named snapshot',
    },
  })
})

test('workspace history commit runtime falls back from empty request message to translated timestamp message', async () => {
  const runtime = createWorkspaceHistoryCommitRuntime({
    gitAddImpl: async () => {},
    gitStatusImpl: async () => ' M chapter.md',
    gitCommitImpl: async () => {},
    gitLogImpl: async () => [],
    nowImpl: () => new Date('2026-03-22T08:09:10.000Z'),
  })

  const result = await runtime.commitPreparedWorkspaceHistory({
    workspacePath: '/workspace/demo',
    requestCommitMessage: async () => '   ',
    t: (value, params = {}) => `${value} => ${params.ts}`,
  })

  assert.deepEqual(result, {
    committed: true,
    reason: 'committed',
    commitMessage: 'Save: {ts} => 2026-03-22 08:09',
    historyEntry: null,
  })
})

test('workspace history commit runtime returns no-changes before commit when git status is empty', async () => {
  const calls = []
  const runtime = createWorkspaceHistoryCommitRuntime({
    gitAddImpl: async (workspacePath) => {
      calls.push(['gitAdd', workspacePath])
    },
    gitStatusImpl: async (workspacePath) => {
      calls.push(['gitStatus', workspacePath])
      return ''
    },
    gitCommitImpl: async () => {
      calls.push(['gitCommit'])
    },
  })

  const result = await runtime.commitPreparedWorkspaceHistory({
    workspacePath: '/workspace/demo',
  })

  assert.deepEqual(calls, [
    ['gitAdd', '/workspace/demo'],
    ['gitStatus', '/workspace/demo'],
  ])
  assert.deepEqual(result, {
    committed: false,
    reason: 'no-changes',
  })
})

test('workspace history commit runtime maps git nothing-to-commit failures back to no-changes', async () => {
  const runtime = createWorkspaceHistoryCommitRuntime({
    gitAddImpl: async () => {},
    gitStatusImpl: async () => ' M chapter.md',
    gitCommitImpl: async () => {
      throw new Error('nothing to commit, working tree clean')
    },
    gitLogImpl: async () => {
      throw new Error('should not read history when nothing was committed')
    },
  })

  const result = await runtime.commitPreparedWorkspaceHistory({
    workspacePath: '/workspace/demo',
    fallbackCommitMessage: 'Fallback',
  })

  assert.deepEqual(result, {
    committed: false,
    reason: 'no-changes',
  })
})

test('buildDefaultWorkspaceHistoryCommitMessage formats the timestamp when no translator is available', () => {
  const result = buildDefaultWorkspaceHistoryCommitMessage({
    now: new Date('2026-03-22T10:11:12.000Z'),
  })

  assert.equal(result, 'Save: 2026-03-22 10:11')
})
