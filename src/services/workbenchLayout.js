import { invoke } from '@tauri-apps/api/core'

export function loadWorkbenchLayout(legacyState = {}) {
  return invoke('workbench_layout_load', {
    params: {
      legacyState,
    },
  })
}

export function saveWorkbenchLayout(state = {}) {
  return invoke('workbench_layout_save', {
    params: {
      state,
    },
  })
}
