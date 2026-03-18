import {
  getTinymistDiagnosticsStatus,
  normalizeTinymistDiagnostics,
} from '../tinymist/diagnostics.js'

function normalizeSeverity(value) {
  return value === 'error' ? 'error' : 'warning'
}

export function buildTypstCompileProblems(sourcePath, state = {}) {
  const errors = Array.isArray(state?.errors) ? state.errors : []
  const warnings = Array.isArray(state?.warnings) ? state.warnings : []

  return [
    ...errors.map((problem, index) => ({
      id: `typst:compile:error:${sourcePath}:${index}`,
      sourcePath,
      line: problem.line ?? null,
      column: problem.column ?? null,
      severity: 'error',
      message: problem.message || '',
      origin: 'compile',
      actionable: true,
      raw: problem.raw || problem.message || '',
    })),
    ...warnings.map((problem, index) => ({
      id: `typst:compile:warning:${sourcePath}:${index}`,
      sourcePath,
      line: problem.line ?? null,
      column: problem.column ?? null,
      severity: 'warning',
      message: problem.message || '',
      origin: 'compile',
      actionable: true,
      raw: problem.raw || problem.message || '',
    })),
  ]
}

export function buildTypstTinymistProblems(sourcePath, diagnostics = []) {
  return normalizeTinymistDiagnostics(sourcePath, diagnostics).map((problem, index) => ({
    id: `typst:tinymist:${normalizeSeverity(problem.severity)}:${sourcePath}:${index}`,
    sourcePath,
    line: problem.line ?? null,
    column: problem.column ?? null,
    severity: normalizeSeverity(problem.severity),
    message: problem.message || '',
    origin: 'tinymist',
    actionable: true,
    raw: problem.raw || problem.message || '',
  }))
}

export function buildTypstWorkflowProblems(sourcePath, options = {}) {
  const compileState = options.compileState || {}
  const liveState = options.liveState || {}
  const tinymistBacked = liveState?.tinymistBacked === true

  if (tinymistBacked) {
    return buildTypstTinymistProblems(sourcePath, liveState.diagnostics || [])
  }

  return buildTypstCompileProblems(sourcePath, compileState)
}

function formatCompileDuration(state = {}, t = (value) => value) {
  if (state?.status === 'compiling') return t('Compiling...')
  if (state?.status !== 'success') return ''
  const ms = state?.durationMs
  if (!ms) return t('Ready')
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function buildTypstWorkflowStatusText(options = {}, t = (value) => value) {
  const compileState = options.compileState || {}
  const queueState = options.queueState || {}
  const liveState = options.liveState || {}

  if (queueState?.phase === 'scheduled' || queueState?.phase === 'queued') {
    const pendingCount = Number(queueState?.pendingCount || 0)
    return pendingCount > 0
      ? t('Queued +{count}', { count: pendingCount })
      : t('Queued')
  }

  if (queueState?.phase === 'running' || compileState?.status === 'compiling') {
    return t('Compiling...')
  }

  if (compileState?.status === 'success') {
    return formatCompileDuration(compileState, t)
  }

  if (compileState?.status === 'error') {
    const problems = buildTypstCompileProblems('', compileState)
    const errorCount = problems.filter(problem => problem.severity === 'error').length
    const warningCount = problems.filter(problem => problem.severity === 'warning').length
    if (errorCount > 0) return t('{count} errors', { count: errorCount })
    if (warningCount > 0) return t('{count} warnings', { count: warningCount })
  }

  if (liveState?.tinymistBacked) {
    const problems = buildTypstTinymistProblems('', liveState.diagnostics || [])
    const errorCount = problems.filter(problem => problem.severity === 'error').length
    const warningCount = problems.filter(problem => problem.severity === 'warning').length
    if (errorCount > 0) return t('{count} errors', { count: errorCount })
    if (warningCount > 0) return t('{count} warnings', { count: warningCount })
    return 'Tinymist'
  }

  return ''
}

export function buildTypstWorkflowUiState(options = {}) {
  const compileState = options.compileState || {}
  const liveState = options.liveState || {}
  const queueState = options.queueState || {}
  const previewAvailable = options.previewAvailable === true
  const tinymistBacked = liveState?.tinymistBacked === true
  const liveDiagnostics = Array.isArray(liveState?.diagnostics) ? liveState.diagnostics : []
  const liveStatus = getTinymistDiagnosticsStatus(liveDiagnostics)
  const problems = buildTypstWorkflowProblems('', options)
  const errorCount = problems.filter(problem => problem.severity === 'error').length
  const warningCount = problems.filter(problem => problem.severity === 'warning').length

  let phase = 'idle'
  if (queueState?.phase === 'running' || compileState?.status === 'compiling') phase = 'compiling'
  else if (queueState?.phase === 'scheduled' || queueState?.phase === 'queued') phase = 'queued'
  else if (tinymistBacked && liveStatus === 'error') phase = 'error'
  else if (!tinymistBacked && compileState?.status === 'error') phase = 'error'
  else if (previewAvailable || compileState?.status === 'success') phase = 'ready'

  return {
    kind: 'typst',
    previewKind: 'pdf',
    phase,
    errorCount,
    warningCount,
    canShowProblems: errorCount > 0 || warningCount > 0,
    canRevealPreview: !!previewAvailable,
    forwardSync: 'reveal-only',
    backwardSync: false,
    primaryAction: 'compile',
  }
}
