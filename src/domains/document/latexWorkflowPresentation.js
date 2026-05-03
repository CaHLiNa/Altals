import {
  dirnamePath,
  normalizeFsPath,
  resolveRelativePath,
} from '../../utils/path.js'

function isAbsoluteFsPath(value = '') {
  const normalized = normalizeFsPath(value)
  return normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)
}

function resolveLatexProblemSourcePath(problem = {}, fallbackSourcePath = '', state = {}) {
  const reportedPath = normalizeFsPath(problem.file || fallbackSourcePath)
  if (!reportedPath) return normalizeFsPath(fallbackSourcePath)
  if (isAbsoluteFsPath(reportedPath)) return reportedPath

  const basePath = normalizeFsPath(
    state.compileTargetPath ||
    state.projectRootPath ||
    fallbackSourcePath
  )
  if (!basePath) return reportedPath

  const baseDir = dirnamePath(basePath || fallbackSourcePath)
  return resolveRelativePath(baseDir, reportedPath)
}

function buildBuildStatusSuffix(context = {}, state = {}, queueState = null) {
  const extraArgs = state?.buildExtraArgs || queueState?.buildExtraArgs || ''
  const parts = []

  if (extraArgs) {
    parts.push(context.t?.('Custom args') || 'Custom args')
  }

  return parts.join(' · ')
}

function appendStatusSuffix(base, context = {}, state = {}, queueState = null) {
  const suffix = buildBuildStatusSuffix(context, state, queueState)
  return suffix ? `${base} · ${suffix}` : base
}

export function formatLatexCompileDuration(state = {}, context = {}, queueState = null) {
  const t = context.t || ((value) => value)
  if (state?.status === 'compiling') {
    const base =
      queueState?.pendingCount > 0
        ? `${t('Compiling...')} · ${t('Queued +{count}', { count: queueState.pendingCount })}`
        : t('Compiling...')
    return appendStatusSuffix(base, context, state, queueState)
  }
  if (queueState?.phase === 'scheduled' || queueState?.phase === 'queued') {
    return appendStatusSuffix(t('Queued'), context, state, queueState)
  }
  if (state?.status !== 'success') return ''
  const ms = state?.durationMs
  const durationText = !ms
    ? t('Compiled')
    : ms < 1000
      ? `${ms}ms`
      : `${(ms / 1000).toFixed(1)}s`
  return appendStatusSuffix(durationText, context, state, queueState)
}

export function buildLatexWorkflowProblems(sourcePath, state = {}) {
  const errors = Array.isArray(state?.errors) ? state.errors : []
  const warnings = Array.isArray(state?.warnings) ? state.warnings : []

  return [
    ...errors.map((problem, index) => {
      const problemSourcePath = resolveLatexProblemSourcePath(problem, sourcePath, state)
      return {
        id: `latex:error:${problemSourcePath}:${index}`,
        sourcePath: problemSourcePath,
        line: problem.line ?? null,
        column: problem.column ?? null,
        severity: 'error',
        message: problem.message || '',
        origin: 'compile',
        actionable: true,
        raw: problem.raw || problem.message || '',
      }
    }),
    ...warnings.map((problem, index) => {
      const problemSourcePath = resolveLatexProblemSourcePath(problem, sourcePath, state)
      return {
        id: `latex:warning:${problemSourcePath}:${index}`,
        sourcePath: problemSourcePath,
        line: problem.line ?? null,
        column: problem.column ?? null,
        severity: 'warning',
        message: problem.message || '',
        origin: 'compile',
        actionable: true,
        raw: problem.raw || problem.message || '',
      }
    }),
  ]
}

export function countLatexWorkflowProblemSeverities(problems = []) {
  const normalizedProblems = Array.isArray(problems) ? problems : []
  return {
    errorCount: normalizedProblems.filter(
      (problem) => problem.severity === 'error',
    ).length,
    warningCount: normalizedProblems.filter(
      (problem) => problem.severity === 'warning',
    ).length,
  }
}

export function buildLatexWorkflowUiState(state = {}, options = {}) {
  const severityCounts = options.problems
    ? countLatexWorkflowProblemSeverities(options.problems)
    : countLatexWorkflowProblemSeverities(buildLatexWorkflowProblems('', state))
  const { errorCount, warningCount } = severityCounts

  let phase = 'idle'
  if (state?.status === 'compiling') phase = 'compiling'
  else if (
    options.queuePhase === 'scheduled' ||
    options.queuePhase === 'queued'
  )
    phase = 'queued'
  else if (state?.status === 'error') phase = 'error'
  else if (options.previewAvailable || state?.status === 'success')
    phase = 'ready'

  return {
    kind: 'latex',
    previewKind: options.previewKind || null,
    phase,
    errorCount,
    warningCount,
    canShowProblems: errorCount > 0 || warningCount > 0,
    canRevealPreview: false,
    canOpenPdf: options.artifactReady === true,
    backwardSync: true,
    primaryAction: 'compile',
  }
}
