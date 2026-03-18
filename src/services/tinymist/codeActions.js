import { offsetToTinymistPosition } from './textEdits.js'

function compareTinymistPosition(left = {}, right = {}) {
  const leftLine = Number(left?.line) || 0
  const rightLine = Number(right?.line) || 0
  if (leftLine !== rightLine) return leftLine - rightLine
  return (Number(left?.character) || 0) - (Number(right?.character) || 0)
}

function rangesOverlap(left = {}, right = {}) {
  if (!left?.start || !left?.end || !right?.start || !right?.end) return false
  const leftIsPoint = compareTinymistPosition(left.start, left.end) === 0
  const rightIsPoint = compareTinymistPosition(right.start, right.end) === 0
  if (leftIsPoint || rightIsPoint) {
    return compareTinymistPosition(left.end, right.start) >= 0
      && compareTinymistPosition(right.end, left.start) >= 0
  }
  return compareTinymistPosition(left.end, right.start) > 0
    && compareTinymistPosition(right.end, left.start) > 0
}

function kindPriority(kind = '') {
  if (kind === 'quickfix') return 0
  if (kind.startsWith('refactor')) return 1
  if (kind.startsWith('source')) return 2
  return 3
}

export function buildTinymistCodeActionRange(state, selection = null) {
  if (!state) return null
  const activeSelection = selection || state.selection?.main
  if (!activeSelection) return null

  const from = Math.min(activeSelection.from, activeSelection.to)
  const to = Math.max(activeSelection.from, activeSelection.to)
  return {
    start: offsetToTinymistPosition(state, from),
    end: offsetToTinymistPosition(state, to),
  }
}

export function buildTinymistCodeActionContext(rawDiagnostics = [], range = null, options = {}) {
  const diagnostics = Array.isArray(rawDiagnostics) && range
    ? rawDiagnostics.filter((diagnostic) => rangesOverlap(diagnostic?.range, range))
    : []

  const context = {
    diagnostics,
  }

  if (Array.isArray(options.only) && options.only.length > 0) {
    context.only = options.only.map((kind) => String(kind || '')).filter(Boolean)
  }

  if (options.triggerKind != null) {
    context.triggerKind = options.triggerKind
  }

  return context
}

function normalizeTinymistCodeAction(action = {}, index = 0) {
  const title = String(action?.title || '').trim()
  if (!title) return null

  const kind = String(action?.kind || '')
  const disabledReason = String(action?.disabled?.reason || '').trim()
  const edit = action?.edit || null
  const command = action?.command || null

  return {
    id: `${kind || 'action'}:${title}:${index}`,
    title,
    kind,
    edit,
    command,
    diagnostics: Array.isArray(action?.diagnostics) ? action.diagnostics : [],
    isPreferred: action?.isPreferred === true,
    disabledReason,
    canApply: !!edit,
  }
}

export function normalizeTinymistCodeActions(result = [], options = {}) {
  const supportedOnly = options.supportedOnly !== false
  const includeDisabled = options.includeDisabled === true

  return (Array.isArray(result) ? result : [])
    .map(normalizeTinymistCodeAction)
    .filter(Boolean)
    .filter((action) => includeDisabled || !action.disabledReason)
    .filter((action) => !supportedOnly || action.canApply)
    .sort((left, right) => {
      if (left.isPreferred !== right.isPreferred) return left.isPreferred ? -1 : 1
      const kindDelta = kindPriority(left.kind) - kindPriority(right.kind)
      if (kindDelta !== 0) return kindDelta
      return left.title.localeCompare(right.title)
    })
}
