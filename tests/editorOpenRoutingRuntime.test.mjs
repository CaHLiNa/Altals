import test from 'node:test'
import assert from 'node:assert/strict'

import { createEditorOpenRoutingRuntime } from '../src/domains/editor/editorOpenRoutingRuntime.js'
import { ROOT_PANE_ID } from '../src/domains/editor/paneTreeLayout.js'

function createState() {
  return {
    activePaneId: ROOT_PANE_ID,
    lastContextPath: null,
    pane: {
      type: 'leaf',
      id: ROOT_PANE_ID,
      tabs: [],
      activeTab: null,
    },
  }
}

function createRuntime(state, overrides = {}) {
  const events = {
    saves: 0,
    recorded: [],
    revealed: [],
    newTabCount: 0,
  }

  return {
    runtime: createEditorOpenRoutingRuntime({
      getActivePaneId: () => state.activePaneId,
      setActivePaneId: (paneId) => {
        state.activePaneId = paneId
      },
      findPane: (paneId) => (paneId === state.pane.id ? state.pane : null),
      findPaneWithTab: (path) => (state.pane.tabs.includes(path) ? state.pane : null),
      rememberContextPath: (path) => {
        state.lastContextPath = path
      },
      recordFileOpen: (path) => {
        events.recorded.push(path)
      },
      revealInTree: (path) => {
        events.revealed.push(path)
      },
      saveEditorState: () => {
        events.saves += 1
      },
      createNewTabPath: () => {
        events.newTabCount += 1
        return `newtab:generated-${events.newTabCount}`
      },
      ...overrides,
    }),
    events,
  }
}

test('openFile focuses an already-open document tab without duplicating it', () => {
  const state = createState()
  state.pane.tabs = ['/workspace/notes.md', '/workspace/draft.tex']
  state.pane.activeTab = '/workspace/notes.md'

  const { runtime, events } = createRuntime(state)
  runtime.openFile('/workspace/draft.tex')

  assert.deepEqual(state.pane.tabs, ['/workspace/notes.md', '/workspace/draft.tex'])
  assert.equal(state.pane.activeTab, '/workspace/draft.tex')
  assert.equal(state.lastContextPath, '/workspace/draft.tex')
  assert.deepEqual(events.recorded, ['/workspace/draft.tex'])
  assert.deepEqual(events.revealed, [])
  assert.equal(events.saves, 1)
})

test('openFile replaces the active new-tab launcher in the current pane', () => {
  const state = createState()
  state.pane.tabs = ['newtab:starter']
  state.pane.activeTab = 'newtab:starter'

  const { runtime, events } = createRuntime(state)
  runtime.openFile('/workspace/paper.typ')

  assert.deepEqual(state.pane.tabs, ['/workspace/paper.typ'])
  assert.equal(state.pane.activeTab, '/workspace/paper.typ')
  assert.equal(state.lastContextPath, '/workspace/paper.typ')
  assert.deepEqual(events.recorded, ['/workspace/paper.typ'])
  assert.deepEqual(events.revealed, ['/workspace/paper.typ'])
  assert.equal(events.saves, 1)
})

test('openNewTab appends a fresh launcher tab to the current pane', () => {
  const state = createState()
  state.pane.tabs = ['/workspace/main.md']
  state.pane.activeTab = '/workspace/main.md'

  const { runtime, events } = createRuntime(state)
  runtime.openNewTab()

  assert.deepEqual(state.pane.tabs, ['/workspace/main.md', 'newtab:generated-1'])
  assert.equal(state.pane.activeTab, 'newtab:generated-1')
  assert.equal(events.saves, 1)
})

test('openFileInPane replaces launcher tabs by default and can preserve them when asked', () => {
  const replacingState = createState()
  replacingState.pane.tabs = ['newtab:starter']
  replacingState.pane.activeTab = 'newtab:starter'

  const replacing = createRuntime(replacingState)
  const replacedPaneId = replacing.runtime.openFileInPane('/workspace/chapter.md', ROOT_PANE_ID, {
    activatePane: true,
  })

  assert.equal(replacedPaneId, ROOT_PANE_ID)
  assert.deepEqual(replacingState.pane.tabs, ['/workspace/chapter.md'])
  assert.equal(replacingState.pane.activeTab, '/workspace/chapter.md')
  assert.equal(replacingState.lastContextPath, '/workspace/chapter.md')

  const preservingState = createState()
  preservingState.pane.tabs = ['newtab:starter']
  preservingState.pane.activeTab = 'newtab:starter'

  const preserving = createRuntime(preservingState)
  preserving.runtime.openFileInPane('/workspace/appendix.tex', ROOT_PANE_ID, {
    replaceNewTab: false,
  })

  assert.deepEqual(preservingState.pane.tabs, ['newtab:starter', '/workspace/appendix.tex'])
  assert.equal(preservingState.pane.activeTab, '/workspace/appendix.tex')
  assert.equal(preservingState.lastContextPath, null)
})

test('openFile skips recent-file tracking for draft tabs', () => {
  const state = createState()
  state.pane.tabs = ['newtab:starter']
  state.pane.activeTab = 'newtab:starter'

  const { runtime, events } = createRuntime(state)
  runtime.openFile('draft:generated/Untitled.md')

  assert.deepEqual(state.pane.tabs, ['draft:generated/Untitled.md'])
  assert.equal(state.pane.activeTab, 'draft:generated/Untitled.md')
  assert.deepEqual(events.recorded, [])
  assert.deepEqual(events.revealed, ['draft:generated/Untitled.md'])
})
