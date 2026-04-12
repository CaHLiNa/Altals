import test from 'node:test'
import assert from 'node:assert/strict'

import { createWorkspacePreviewSessionState } from '../src/domains/document/documentWorkspacePreviewRuntime.js'

test('workspace preview session state keeps latex workspace preview in pdf mode', () => {
  const sessionState = createWorkspacePreviewSessionState({
    filePath: '/workspace/paper.tex',
    kind: 'latex',
    previewKind: 'pdf',
    sourcePaneId: 'pane-source',
    currentSession: {
      activeFile: '/workspace/paper.tex',
      activeKind: 'latex',
      sourcePaneId: 'pane-source',
      previewKind: 'pdf',
      previewSourcePath: '/workspace/paper.tex',
      state: 'workspace-preview',
    },
  })

  assert.deepEqual(sessionState, {
    activeFile: '/workspace/paper.tex',
    activeKind: 'latex',
    sourcePaneId: 'pane-source',
    previewPaneId: null,
    previewKind: 'pdf',
    previewSourcePath: '/workspace/paper.tex',
    state: 'workspace-preview',
  })
})
