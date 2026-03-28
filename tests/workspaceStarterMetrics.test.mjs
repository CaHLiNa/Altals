import test from 'node:test'
import assert from 'node:assert/strict'

import {
  WORKSPACE_STARTER_COMPUTATION_EXTENSIONS,
  WORKSPACE_STARTER_DRAFT_EXTENSIONS,
  countWorkspaceStarterFilesByExtension,
  getWorkspaceStarterDirectory,
  getWorkspaceStarterFileExtension,
  getWorkspaceStarterRelativePath,
  normalizeWorkspaceStarterPath,
} from '../src/domains/workspace/workspaceStarterMetrics.js'

test('workspace starter metrics normalizes paths and resolves extensions', () => {
  assert.equal(
    normalizeWorkspaceStarterPath('C:\\Research\\paper\\draft.tex'),
    'C:/Research/paper/draft.tex'
  )
  assert.equal(getWorkspaceStarterFileExtension('/workspace/notes/intro.MD'), '.md')
  assert.equal(getWorkspaceStarterFileExtension('/workspace/archive'), '')
})

test('workspace starter metrics counts draft and computation artifacts by extension', () => {
  const files = [
    { path: '/workspace/intro.md' },
    { path: '/workspace/paper/main.tex' },
    { path: '/workspace/slides/main.typ' },
    { path: '/workspace/archive/draft.pdf' },
    { path: '/workspace/assets/figure.png' },
    { path: '/workspace/data/table.csv' },
  ]

  assert.equal(countWorkspaceStarterFilesByExtension(files, WORKSPACE_STARTER_DRAFT_EXTENSIONS), 3)
  assert.equal(
    countWorkspaceStarterFilesByExtension(files, WORKSPACE_STARTER_COMPUTATION_EXTENSIONS),
    0
  )
})

test('workspace starter metrics resolves relative paths and project-root directories', () => {
  assert.equal(
    getWorkspaceStarterRelativePath('/workspace/sections/intro.md', '/workspace'),
    'sections/intro.md'
  )
  assert.equal(
    getWorkspaceStarterDirectory('/workspace/sections/intro.md', '/workspace'),
    'sections'
  )
  assert.equal(getWorkspaceStarterDirectory('/workspace/intro.md', '/workspace'), '')
})
