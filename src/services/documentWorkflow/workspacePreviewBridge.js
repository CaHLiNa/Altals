import { invokeDocumentWorkflowBridge } from './invokeBridge.js'

export async function mutateDocumentWorkspacePreview(params = {}) {
  return invokeDocumentWorkflowBridge('document_workspace_preview_mutate', {
    intent: String(params.intent || ''),
    filePath: String(params.filePath || ''),
    kind: String(params.kind || ''),
    previewKind: String(params.previewKind || ''),
    preferredPreviewKind: String(params.preferredPreviewKind || ''),
    persistPreference: params.persistPreference !== false,
    sourcePaneId: String(params.sourcePaneId || ''),
    currentSession: params.currentSession || null,
  })
}
