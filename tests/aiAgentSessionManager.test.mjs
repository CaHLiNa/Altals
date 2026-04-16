import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDefaultAgentSessionTitle,
  createAgentSessionState,
  createInitialAgentSessionsState,
  deleteAgentSessionState,
  renameAgentSessionState,
  restoreAgentSessionsState,
  switchAgentSessionState,
} from '../src/services/ai/agentSessionManager.js'

test('buildDefaultAgentSessionTitle delegates to the provided translator', () => {
  const title = buildDefaultAgentSessionTitle((key, vars) => `${key}:${vars.count}`, 3)
  assert.equal(title, 'Run {count}:3')
})

test('restoreAgentSessionsState falls back to an initial session when storage is empty', () => {
  const state = restoreAgentSessionsState({
    workspacePath: '/workspace',
    fallbackTitle: 'Run 1',
    loadState: () => null,
  })

  assert.equal(state.sessions.length, 1)
  assert.equal(state.sessions[0].title, 'Run 1')
  assert.equal(state.currentSessionId, state.sessions[0].id)
})

test('restoreAgentSessionsState clears transient runtime flags from persisted sessions', () => {
  const state = restoreAgentSessionsState({
    workspacePath: '/workspace',
    fallbackTitle: 'Run 1',
    loadState: () => ({
      currentSessionId: 's1',
      sessions: [
        {
          id: 's1',
          title: 'Recovered run',
          isRunning: true,
          permissionRequests: [{ requestId: 'p1' }],
          askUserRequests: [{ requestId: 'a1' }],
          exitPlanRequests: [{ requestId: 'e1' }],
          backgroundTasks: [{ id: 't1', status: 'running' }],
          isCompacting: true,
          lastCompactAt: 123,
          waitingResume: true,
          waitingResumeMessage: 'waiting',
          planMode: { active: true, summary: 'summary', note: 'note' },
        },
      ],
    }),
  })

  assert.equal(state.sessions.length, 1)
  assert.equal(state.currentSessionId, 's1')
  assert.equal(state.sessions[0].isRunning, false)
  assert.deepEqual(state.sessions[0].permissionRequests, [])
  assert.deepEqual(state.sessions[0].askUserRequests, [])
  assert.deepEqual(state.sessions[0].exitPlanRequests, [])
  assert.deepEqual(state.sessions[0].backgroundTasks, [])
  assert.equal(state.sessions[0].isCompacting, false)
  assert.equal(state.sessions[0].lastCompactAt, 0)
  assert.equal(state.sessions[0].waitingResume, false)
  assert.equal(state.sessions[0].waitingResumeMessage, '')
  assert.deepEqual(state.sessions[0].planMode, { active: false, summary: '', note: '' })
})

test('create, switch, rename, and delete session state transitions stay consistent', () => {
  const initial = createInitialAgentSessionsState({ fallbackTitle: 'Run 1' })
  const created = createAgentSessionState({
    sessions: initial.sessions,
    currentSessionId: initial.currentSessionId,
    title: 'Second run',
    activate: true,
    mode: 'agent',
    permissionMode: 'accept-edits',
  })

  const switched = switchAgentSessionState({
    sessions: created.sessions,
    currentSessionId: created.currentSessionId,
    sessionId: initial.currentSessionId,
  })
  const renamed = renameAgentSessionState({
    sessions: created.sessions,
    sessionId: created.session.id,
    title: 'Renamed run',
  })
  const deleted = deleteAgentSessionState({
    sessions: renamed.sessions,
    currentSessionId: renamed.session.id,
    sessionId: renamed.session.id,
    fallbackTitle: 'Run 1',
  })

  assert.equal(switched.success, true)
  assert.equal(switched.currentSessionId, initial.currentSessionId)
  assert.equal(renamed.success, true)
  assert.equal(renamed.session.title, 'Renamed run')
  assert.equal(deleted.success, true)
  assert.equal(deleted.sessions.length, 1)
})
