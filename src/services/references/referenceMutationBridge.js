import { invoke } from '@tauri-apps/api/core'
import { hasDesktopInvoke } from '../bridgeStorage.js'
import { applyReferenceMutationLocally } from '../../domains/references/referenceMutationRuntime.js'

export async function applyReferenceMutation(params = {}) {
  if (!hasDesktopInvoke()) {
    return applyReferenceMutationLocally(params)
  }

  return invoke('references_mutation_apply', {
    params: {
      snapshot: params.snapshot && typeof params.snapshot === 'object' ? params.snapshot : {},
      action: params.action && typeof params.action === 'object' ? params.action : { type: '' },
    },
  })
}
