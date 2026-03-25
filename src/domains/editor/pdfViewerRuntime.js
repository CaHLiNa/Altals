export const SIDEBAR_TOGGLE_RESIZE_PULSE_MS = 160

function normalizeBoolean(value) {
  return value === true || value === false ? value : null
}

function normalizePositiveNumber(value) {
  const normalizedValue = Number(value)
  if (!Number.isFinite(normalizedValue)) return 0
  return normalizedValue
}

export function shouldPulseShellResizeForSidebarToggle({
  previousOpen,
  nextOpen,
  hasVisiblePdfPane,
} = {}) {
  const previousState = normalizeBoolean(previousOpen)
  const nextState = normalizeBoolean(nextOpen)
  if (!hasVisiblePdfPane) return false
  if (previousState === null || nextState === null) return false
  return previousState !== nextState
}

export function isPdfViewerRenderReady({ pageElementCount, firstPageHeight, pagesCount } = {}) {
  return (
    normalizePositiveNumber(pagesCount) > 0 &&
    normalizePositiveNumber(pageElementCount) > 0 &&
    normalizePositiveNumber(firstPageHeight) > 0
  )
}

export function shouldRebuildPdfViewerOnActivation({
  pageElementCount,
  firstPageHeight,
  pagesCount,
} = {}) {
  return !isPdfViewerRenderReady({ pageElementCount, firstPageHeight, pagesCount })
}
