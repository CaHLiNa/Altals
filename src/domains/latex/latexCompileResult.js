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

export function normalizeLatexCompileResult(result = {}) {
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

export function normalizeLatexCompileExecution(execution = {}) {
  const result = normalizeLatexCompileResult(execution?.result || {})
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
