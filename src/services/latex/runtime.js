import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

function normalizeLatexIssue(issue = {}) {
  return {
    file: issue?.file ? String(issue.file) : null,
    line: Number.isFinite(Number(issue?.line)) ? Number(issue.line) : null,
    column: Number.isFinite(Number(issue?.column)) ? Number(issue.column) : null,
    message: String(issue?.message || '').trim(),
    severity: String(issue?.severity || '').trim() || 'error',
    raw: issue?.raw == null ? null : String(issue.raw),
  }
}

function normalizeCompileResult(result = {}) {
  const pdfPath = String(result?.pdf_path || result?.pdfPath || '')
  const synctexPath = String(result?.synctex_path || result?.synctexPath || '')
  const durationMs = Number(result?.duration_ms ?? result?.durationMs ?? 0)
  const compilerBackend = result?.compiler_backend ?? result?.compilerBackend ?? null
  const commandPreview = result?.command_preview ?? result?.commandPreview ?? null
  const requestedProgram = result?.requested_program ?? result?.requestedProgram ?? null
  const requestedProgramApplied =
    result?.requested_program_applied ?? result?.requestedProgramApplied ?? false

  return {
    ...result,
    success: result?.success === true,
    pdf_path: pdfPath || null,
    synctex_path: synctexPath || null,
    pdfPath,
    synctexPath,
    errors: Array.isArray(result?.errors) ? result.errors.map(normalizeLatexIssue) : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings.map(normalizeLatexIssue) : [],
    log: String(result?.log || ''),
    duration_ms: durationMs,
    durationMs,
    compiler_backend: compilerBackend,
    compilerBackend,
    command_preview: commandPreview,
    commandPreview,
    requested_program: requestedProgram,
    requestedProgram,
    requested_program_applied: requestedProgramApplied === true,
    requestedProgramApplied: requestedProgramApplied === true,
  }
}

function normalizeCompileExecution(execution = {}) {
  const result = normalizeCompileResult(execution?.result || {})
  return {
    sourceState:
      execution?.sourceState && typeof execution.sourceState === 'object'
        ? execution.sourceState
        : {},
    targetState:
      execution?.targetState && typeof execution.targetState === 'object'
        ? execution.targetState
        : {},
    queueState:
      execution?.queueState && typeof execution.queueState === 'object'
        ? execution.queueState
        : null,
    result,
  }
}

export function resolveLatexCompileRequest(params = {}) {
  return invoke('latex_compile_request_resolve', {
    params: {
      sourcePath: String(params.sourcePath || ''),
      workspacePath: String(params.workspacePath || ''),
      flatFiles: Array.isArray(params.flatFiles) ? params.flatFiles : [],
      contentOverrides: params.contentOverrides && typeof params.contentOverrides === 'object'
        ? params.contentOverrides
        : {},
    },
  })
}

export function resolveLatexCompileTargets(params = {}) {
  return invoke('latex_compile_targets_resolve', {
    params: {
      changedPath: String(params.changedPath || ''),
      workspacePath: String(params.workspacePath || ''),
      flatFiles: Array.isArray(params.flatFiles) ? params.flatFiles : [],
      contentOverrides: params.contentOverrides && typeof params.contentOverrides === 'object'
        ? params.contentOverrides
        : {},
    },
  })
}

export function resolveLatexLintState(params = {}) {
  return invoke('latex_runtime_lint_resolve', {
    params: {
      texPath: String(params.texPath || ''),
      content: params.content ?? null,
      customSystemTexPath: params.customSystemTexPath || null,
      workspacePath: params.workspacePath || null,
    },
  })
}

export function resolveLatexSyncTarget(params = {}) {
  return invoke('latex_sync_target_resolve', {
    params: {
      reportedFile: String(params.reportedFile || ''),
      sourcePath: String(params.sourcePath || ''),
      compileTargetPath: String(params.compileTargetPath || ''),
      workspacePath: String(params.workspacePath || ''),
    },
  })
}

export function resolveLatexExistingSynctex(params = {}) {
  return invoke('latex_existing_synctex_resolve', {
    params: {
      pdfPath: String(params.pdfPath || ''),
    },
  })
}

export function scheduleLatexRuntime(params = {}) {
  return invoke('latex_runtime_schedule', {
    params: {
      sourcePath: String(params.sourcePath || ''),
      targetPath: String(params.targetPath || ''),
      reason: String(params.reason || 'save'),
      buildExtraArgs: String(params.buildExtraArgs || ''),
      now: Number(params.now || Date.now()),
    },
  })
}

export async function executeLatexRuntimeCompile(params = {}) {
  const execution = await invoke('latex_runtime_compile_execute', {
    params: {
      texPath: String(params.texPath || ''),
      targetPath: String(params.targetPath || ''),
      projectRootPath: String(params.projectRootPath || ''),
      projectPreviewPath: String(params.projectPreviewPath || ''),
      reason: String(params.reason || 'manual'),
      buildExtraArgs: String(params.buildExtraArgs || ''),
      now: Number(params.now || Date.now()),
      compilerPreference: params.compilerPreference || null,
      enginePreference: params.enginePreference || null,
      customSystemTexPath: params.customSystemTexPath || null,
      customTectonicPath: params.customTectonicPath || null,
    },
  })
  return normalizeCompileExecution(execution)
}

export function cancelLatexRuntime(targetPaths = []) {
  return invoke('latex_runtime_cancel', {
    params: {
      targetPaths: Array.isArray(targetPaths) ? targetPaths : [],
    },
  })
}

export function checkLatexCompilers(params = {}) {
  return invoke('check_latex_compilers', {
    customSystemTexPath: params.customSystemTexPath || null,
    customTectonicPath: params.customTectonicPath || null,
  })
}

export function checkLatexTools(params = {}) {
  return invoke('check_latex_tools', {
    customSystemTexPath: params.customSystemTexPath || null,
  })
}

export function formatLatexDocument(params = {}) {
  return invoke('format_latex_document', {
    texPath: String(params.texPath || ''),
    content: String(params.content || ''),
    customSystemTexPath: params.customSystemTexPath || null,
  })
}

export function downloadTectonicBinary() {
  return invoke('download_tectonic')
}

export function listenLatexCompileStream(handler) {
  return listen('latex-compile-stream', handler)
}

export function listenLatexRuntimeCompileRequested(handler) {
  return listen('latex-runtime-compile-requested', handler)
}

export function listenTectonicDownloadProgress(handler) {
  return listen('tectonic-download-progress', handler)
}
