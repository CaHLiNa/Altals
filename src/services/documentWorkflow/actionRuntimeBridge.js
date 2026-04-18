import { invoke } from '@tauri-apps/api/core'

export async function resolveDocumentWorkflowAction(params = {}) {
  return invoke('document_workflow_action_resolve', {
    params: {
      filePath: String(params.filePath || ''),
      intent: String(params.intent || ''),
      previewDelivery: String(params.previewDelivery || ''),
      uiState: params.uiState || null,
      previewState: params.previewState || null,
      artifactPath: String(params.artifactPath || ''),
    },
  })
}
