export function resolveLeftSidebarChromeAnchor({
  hasVisibleTrafficLights = false,
  macSafePadding = 0,
  railBoundary = 44,
} = {}) {
  const normalizedRailBoundary = Number.isFinite(Number(railBoundary))
    ? Math.max(Number(railBoundary), 0)
    : 0
  const normalizedMacSafePadding = Number.isFinite(Number(macSafePadding))
    ? Math.max(Number(macSafePadding), 0)
    : 0

  if (hasVisibleTrafficLights) {
    return Math.max(normalizedMacSafePadding, normalizedRailBoundary)
  }

  return normalizedRailBoundary
}

export function resolveRightSidebarChromeAnchor({
  sidebarWidth = 0,
  buttonWidth = 30,
  buttonInset = 8,
} = {}) {
  const normalizedSidebarWidth = Number.isFinite(Number(sidebarWidth))
    ? Math.max(Number(sidebarWidth), 0)
    : 0
  const normalizedButtonWidth = Number.isFinite(Number(buttonWidth))
    ? Math.max(Number(buttonWidth), 0)
    : 0
  const normalizedButtonInset = Number.isFinite(Number(buttonInset))
    ? Math.max(Number(buttonInset), 0)
    : 0

  return Math.max(
    normalizedSidebarWidth
    - normalizedButtonWidth
    - normalizedButtonInset,
    0,
  )
}

export function resolveHeaderChromeLayout({
  hasVisibleTrafficLights = false,
  macSafePadding = 0,
  railBoundary = 44,
  leftSidebarWidth = 0,
  leftSidebarOpen = false,
  rightSidebarWidth = 0,
  rightSidebarOpen = false,
  buttonWidth = 30,
  buttonInset = 8,
} = {}) {
  const normalizedRailBoundary = Number.isFinite(Number(railBoundary))
    ? Math.max(Number(railBoundary), 0)
    : 0
  const normalizedLeftSidebarWidth = Number.isFinite(Number(leftSidebarWidth))
    ? Math.max(Number(leftSidebarWidth), 0)
    : 0
  const normalizedButtonWidth = Number.isFinite(Number(buttonWidth))
    ? Math.max(Number(buttonWidth), 0)
    : 0
  const normalizedButtonInset = Number.isFinite(Number(buttonInset))
    ? Math.max(Number(buttonInset), 0)
    : 0

  const leftCollapsedActualLeft = resolveLeftSidebarChromeAnchor({
    hasVisibleTrafficLights,
    macSafePadding,
    railBoundary: normalizedRailBoundary,
  })

  const leftExpandedActualLeft = Math.max(
    normalizedRailBoundary
    + normalizedLeftSidebarWidth
    - normalizedButtonWidth
    - normalizedButtonInset,
    0,
  )

  const rightExpandedActualRight = resolveRightSidebarChromeAnchor({
    sidebarWidth: rightSidebarWidth,
    buttonWidth: normalizedButtonWidth,
    buttonInset: normalizedButtonInset,
  })

  return {
    leftPanelTabsLeft: leftCollapsedActualLeft,
    leftCollapseLeft: leftSidebarOpen ? leftExpandedActualLeft : leftCollapsedActualLeft,
    rightPanelTabsRight: 0,
    rightCollapseRight: rightSidebarOpen ? rightExpandedActualRight : 0,
  }
}
