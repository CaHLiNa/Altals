import { invoke } from '@tauri-apps/api/core'

export async function exportReferencesToBibTeX(references = []) {
  return invoke('references_export_bibtex', {
    params: {
      references,
    },
  })
}
