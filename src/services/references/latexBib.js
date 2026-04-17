import { invoke } from '@tauri-apps/api/core'
import { useReferencesStore } from '../../stores/references.js'

export async function ensureBibFile(texPath = '') {
  const normalizedPath = String(texPath || '').trim()
  if (!normalizedPath.includes('/')) return ''

  const referencesStore = useReferencesStore()
  return invoke('references_write_bib_file', {
    params: {
      texPath: normalizedPath,
      references: referencesStore.references,
    },
  })
}
