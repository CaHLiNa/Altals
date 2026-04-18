import { invoke } from '@tauri-apps/api/core'

export async function executeDocumentWorkflowController(params = {}) {
  return invoke('document_workflow_controller_execute', {
    params: {
      operation: String(params.operation || ''),
      activeFile: String(params.activeFile || ''),
      activePaneId: String(params.activePaneId || ''),
      paneTree: params.paneTree || null,
      trigger: String(params.trigger || ''),
      previewPrefs: params.previewPrefs || {},
      detachedSources: params.detachedSources || {},
      previewBindings: Array.isArray(params.previewBindings) ? params.previewBindings : [],
      session: params.session || {},
      force: params.force === true,
      previewKindOverride: String(params.previewKindOverride || ''),
      allowLegacyPaneResult: params.allowLegacyPaneResult === true,
      sourcePath: String(params.sourcePath || ''),
      previewKind: String(params.previewKind || ''),
      sourcePaneId: String(params.sourcePaneId || ''),
      activatePreview: params.activatePreview === true,
      reconcileAfterClose: params.reconcileAfterClose !== false,
    },
  })
}
