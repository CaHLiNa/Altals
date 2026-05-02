function normalizeWorkspaceRoot(value = '') {
  return String(value || '').trim()
}

export function buildExtensionCommandHostState(diagnostics = {}) {
  if (diagnostics?.ownsPendingPrompt) {
    const promptWorkspaceRoot = normalizeWorkspaceRoot(diagnostics.pendingPromptWorkspaceRoot || '')
    const pendingPromptInActiveWorkspace = diagnostics.pendingPromptInActiveWorkspace === true

    return {
      blocked: true,
      status: 'waiting',
      tone: 'is-warning',
      labelKey: 'Waiting for prompt',
      messageKey: pendingPromptInActiveWorkspace
        ? 'This extension is waiting for prompt input in this workspace. Complete or cancel that prompt before running another command.'
        : 'This extension is waiting for prompt input in {workspace}. Complete or cancel that prompt before running another command.',
      messageParams: pendingPromptInActiveWorkspace
        ? {}
        : { workspace: promptWorkspaceRoot || '/' },
    }
  }

  if (diagnostics?.blockedByForeignPrompt) {
    return {
      blocked: true,
      status: 'blocked',
      tone: 'is-blocked',
      labelKey: 'Blocked',
      messageKey: 'The shared extension host is currently blocked by {extensionId} in {workspace}. Resolve that prompt first.',
      messageParams: {
        extensionId: diagnostics.pendingPromptOwner?.extensionId || '',
        workspace: normalizeWorkspaceRoot(diagnostics.blockingPromptWorkspaceRoot || '') || '/',
      },
    }
  }

  return {
    blocked: false,
    status: 'ready',
    tone: '',
    labelKey: '',
    messageKey: '',
    messageParams: {},
  }
}
