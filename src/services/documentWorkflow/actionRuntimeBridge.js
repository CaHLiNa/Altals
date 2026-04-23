import { invokeDocumentWorkflowBridge } from './invokeBridge.js'

export async function resolveDocumentWorkflowAction(params = {}) {
  return invokeDocumentWorkflowBridge('document_workflow_action_resolve', {
    filePath: String(params.filePath || ''),
    intent: String(params.intent || ''),
    uiState: params.uiState || null,
    previewState: params.previewState || null,
    artifactPath: String(params.artifactPath || ''),
  })
}
