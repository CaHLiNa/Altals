import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createEmptyWorkspaceReferenceCollection,
  parseWorkspaceReferenceCollection,
  resolveGlobalReferenceFulltextPath,
  resolveGlobalReferenceLibraryPath,
  resolveGlobalReferencePdfPath,
  resolveGlobalReferencesDir,
  resolveWorkspaceReferenceCollectionPath,
} from '../src/services/referenceLibraryPaths.js'

test('resolves global reference library paths under the Altals config dir', () => {
  assert.equal(resolveGlobalReferencesDir('/tmp/.altals'), '/tmp/.altals/references')
  assert.equal(resolveGlobalReferenceLibraryPath('/tmp/.altals'), '/tmp/.altals/references/library.json')
  assert.equal(resolveGlobalReferencePdfPath('/tmp/.altals', 'an2026.pdf'), '/tmp/.altals/references/pdfs/an2026.pdf')
  assert.equal(resolveGlobalReferenceFulltextPath('/tmp/.altals', 'an2026.txt'), '/tmp/.altals/references/fulltext/an2026.txt')
})

test('resolves workspace reference collection path beside project metadata', () => {
  assert.equal(
    resolveWorkspaceReferenceCollectionPath('/tmp/.altals/workspaces/abc/project'),
    '/tmp/.altals/workspaces/abc/project/references/workspace-library.json',
  )
})

test('creates and parses workspace reference collections safely', () => {
  assert.deepEqual(createEmptyWorkspaceReferenceCollection(), {
    version: 1,
    keys: [],
  })

  assert.deepEqual(
    parseWorkspaceReferenceCollection(JSON.stringify({
      version: 1,
      keys: ['an2026', 'liu2024', 'an2026', null],
    })),
    {
      version: 1,
      keys: ['an2026', 'liu2024'],
    },
  )

  assert.deepEqual(parseWorkspaceReferenceCollection('not-json'), {
    version: 1,
    keys: [],
  })
})
