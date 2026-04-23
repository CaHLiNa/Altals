import { invoke } from '@tauri-apps/api/core'
import { hasDesktopInvoke } from '../bridgeStorage.js'
import { resolveReferenceQueryStateLocally } from '../../domains/references/referenceQueryRuntime.js'

export async function resolveReferenceQueryState(params = {}) {
  if (!hasDesktopInvoke()) {
    return resolveReferenceQueryStateLocally(params)
  }

  return invoke('references_query_resolve', {
    params: {
      librarySections: Array.isArray(params.librarySections) ? params.librarySections : [],
      sourceSections: Array.isArray(params.sourceSections) ? params.sourceSections : [],
      collections: Array.isArray(params.collections) ? params.collections : [],
      tags: Array.isArray(params.tags) ? params.tags : [],
      references: Array.isArray(params.references) ? params.references : [],
      selectedSectionKey: String(params.selectedSectionKey || ''),
      selectedSourceKey: String(params.selectedSourceKey || ''),
      selectedCollectionKey: String(params.selectedCollectionKey || ''),
      selectedTagKey: String(params.selectedTagKey || ''),
      searchQuery: String(params.searchQuery || ''),
      sortKey: String(params.sortKey || ''),
      fileContents: params.fileContents && typeof params.fileContents === 'object' ? params.fileContents : {},
    },
  })
}
