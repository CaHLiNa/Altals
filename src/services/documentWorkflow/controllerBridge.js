import { invokeDocumentWorkflowBridge } from './invokeBridge.js'

export async function executeDocumentWorkflowController(params = {}) {
  return invokeDocumentWorkflowBridge('document_workflow_controller_execute', {
    operation: String(params.operation || ''),
    activeFile: String(params.activeFile || ''),
    activePaneId: String(params.activePaneId || ''),
    trigger: String(params.trigger || ''),
    previewPrefs: params.previewPrefs || {},
    previewBindings: Array.isArray(params.previewBindings) ? params.previewBindings : [],
    session: params.session || {},
    force: params.force === true,
    previewKindOverride: String(params.previewKindOverride || ''),
    sourcePath: String(params.sourcePath || ''),
    previewKind: String(params.previewKind || ''),
    sourcePaneId: String(params.sourcePaneId || ''),
    activatePreview: params.activatePreview === true,
    reconcileAfterClose: params.reconcileAfterClose !== false,
  })
}
