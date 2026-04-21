import { invoke } from '@tauri-apps/api/core'

export function invokeDocumentWorkflowBridge(command, params = {}) {
  return invoke(command, { params })
}
