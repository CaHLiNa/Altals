export function normalizeProblem(problem = {}, defaults = {}) {
  const severity = problem?.severity === 'warning' || defaults.severity === 'warning'
    ? 'warning'
    : 'error'

  return {
    id: problem?.id || defaults.id || '',
    sourcePath: problem?.sourcePath || defaults.sourcePath || '',
    line: Number.isInteger(problem?.line) && problem.line > 0 ? problem.line : null,
    column: Number.isInteger(problem?.column) && problem.column > 0 ? problem.column : null,
    severity,
    message: String(problem?.message || defaults.message || '').trim(),
    origin: problem?.origin || defaults.origin || 'compile',
    actionable: problem?.actionable !== false,
    raw: String(problem?.raw || defaults.raw || problem?.message || '').trim(),
  }
}

export function normalizeProblems(problems = [], defaults = {}) {
  const seen = new Set()
  const next = []

  for (const entry of problems) {
    const normalized = normalizeProblem(entry, defaults)
    if (!normalized.message) continue
    const signature = [
      normalized.sourcePath,
      normalized.line ?? '',
      normalized.column ?? '',
      normalized.severity,
      normalized.origin,
      normalized.message,
    ].join('::')
    if (seen.has(signature)) continue
    seen.add(signature)
    next.push(normalized)
  }

  return next.sort((left, right) => {
    const byFile = String(left.sourcePath || '').localeCompare(String(right.sourcePath || ''))
    if (byFile !== 0) return byFile
    const leftLine = left.line ?? Number.MAX_SAFE_INTEGER
    const rightLine = right.line ?? Number.MAX_SAFE_INTEGER
    if (leftLine !== rightLine) return leftLine - rightLine
    if (left.severity !== right.severity) return left.severity === 'error' ? -1 : 1
    return left.message.localeCompare(right.message)
  })
}
