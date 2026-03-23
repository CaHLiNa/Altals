import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ALL_WORKBENCH_SIDEBAR_PANELS,
  normalizeWorkbenchSidebarPanel,
  normalizeWorkbenchSurface,
} from '../src/shared/workbenchSidebarPanels.js'

test('workbench sidebar panels expose the expected cross-surface panel ids', () => {
  assert.deepEqual(ALL_WORKBENCH_SIDEBAR_PANELS, [
    'files',
    'references',
    'outline',
    'library-views',
    'library-tags',
    'ai-chats',
  ])
})

test('workbench sidebar panel normalization falls back to each surface default', () => {
  assert.equal(normalizeWorkbenchSidebarPanel('workspace', 'outline'), 'outline')
  assert.equal(normalizeWorkbenchSidebarPanel('workspace', 'library-tags'), 'files')
  assert.equal(normalizeWorkbenchSidebarPanel('library', 'library-tags'), 'library-tags')
  assert.equal(normalizeWorkbenchSidebarPanel('library', 'outline'), 'library-views')
  assert.equal(normalizeWorkbenchSidebarPanel('ai', 'ai-chats'), 'ai-chats')
  assert.equal(normalizeWorkbenchSidebarPanel('ai', 'references'), 'ai-chats')
})

test('workbench surface normalization stays inside the supported shell surfaces', () => {
  assert.equal(normalizeWorkbenchSurface('workspace'), 'workspace')
  assert.equal(normalizeWorkbenchSurface('library'), 'library')
  assert.equal(normalizeWorkbenchSurface('ai'), 'ai')
  assert.equal(normalizeWorkbenchSurface('invalid'), 'workspace')
})
