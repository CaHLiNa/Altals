import { invoke } from '@tauri-apps/api/core'

export async function resolveDocumentWorkspacePreviewState(params = {}) {
  return invoke('document_workspace_preview_state_resolve', {
    params: {
      path: String(params.path || ''),
      sourcePath: String(params.sourcePath || ''),
      workflowKind: String(params.workflowKind || ''),
      workflowPreviewKind: String(params.workflowPreviewKind || ''),
      previewKind: String(params.previewKind || ''),
      resolvedTargetPath: String(params.resolvedTargetPath || ''),
      targetResolution: String(params.targetResolution || ''),
      hiddenByUser: params.hiddenByUser === true,
      previewRequested: params.previewRequested === true,
      artifactReady: params.artifactReady === true,
      preserveOpenLegacy: params.preserveOpenLegacy === true,
      hasOpenLegacyPreview: params.hasOpenLegacyPreview === true,
    },
  })
}
