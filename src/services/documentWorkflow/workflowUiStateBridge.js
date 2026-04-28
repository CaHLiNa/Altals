import { invokeDocumentWorkflowBridge } from './invokeBridge.js'

export async function resolveDocumentWorkflowUiState(params = {}) {
  return invokeDocumentWorkflowBridge('document_workflow_state_resolve', {
    filePath: String(params.filePath || ''),
    previewState: params.previewState || null,
    markdownState: params.markdownState || null,
    markdownDraftProblems: params.markdownDraftProblems || null,
    latexState: params.latexState || null,
    latexLintDiagnostics: params.latexLintDiagnostics || null,
    workspacePath: String(params.workspacePath || ''),
    sourceContent: String(params.sourceContent || ''),
    pythonState: params.pythonState || null,
    queueState: params.queueState || null,
    artifactPath: String(params.artifactPath || ''),
  })
}
