import { invoke } from '@tauri-apps/api/core'

export async function mutateDocumentWorkspacePreview(params = {}) {
  return invoke('document_workspace_preview_mutate', {
    params: {
      intent: String(params.intent || ''),
      filePath: String(params.filePath || ''),
      kind: String(params.kind || ''),
      previewKind: String(params.previewKind || ''),
      preferredPreviewKind: String(params.preferredPreviewKind || ''),
      persistPreference: params.persistPreference !== false,
      sourcePaneId: String(params.sourcePaneId || ''),
      currentSession: params.currentSession || null,
    },
  })
}
