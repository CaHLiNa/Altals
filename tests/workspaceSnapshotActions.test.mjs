import test from 'node:test'
import assert from 'node:assert/strict'

import { useWorkspaceSnapshotActions } from '../src/app/changes/useWorkspaceSnapshotActions.js'

test('workspace snapshot actions open the workspace snapshot browser only for an open workspace', () => {
  const workspaceSnapshotBrowserVisible = { value: false }
  const actions = useWorkspaceSnapshotActions({
    workspace: { path: '/workspace/demo' },
    filesStore: {},
    editorStore: {},
    footerRef: { value: null },
    toastStore: { show() {} },
    workspaceSnapshotBrowserVisible,
    fileVersionHistoryVisible: { value: false },
    fileVersionHistoryFile: { value: '' },
    t: (value) => value,
  })

  actions.openWorkspaceSnapshots()
  assert.equal(workspaceSnapshotBrowserVisible.value, true)

  workspaceSnapshotBrowserVisible.value = false
  const closedWorkspaceActions = useWorkspaceSnapshotActions({
    workspace: { path: '' },
    filesStore: {},
    editorStore: {},
    footerRef: { value: null },
    toastStore: { show() {} },
    workspaceSnapshotBrowserVisible,
    fileVersionHistoryVisible: { value: false },
    fileVersionHistoryFile: { value: '' },
    t: (value) => value,
  })

  closedWorkspaceActions.openWorkspaceSnapshots()
  assert.equal(workspaceSnapshotBrowserVisible.value, false)
})
