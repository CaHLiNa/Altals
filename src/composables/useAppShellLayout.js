import { onMounted, ref } from 'vue'
import { MAX_WORKBENCH_SIDEBAR_PANEL_COUNT } from '../shared/workbenchSidebarPanels.js'
import { MAX_WORKBENCH_INSPECTOR_PANEL_COUNT } from '../shared/workbenchInspectorPanels.js'

const DEFAULT_LEFT_SIDEBAR_WIDTH = 240
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 360
const DEFAULT_BOTTOM_PANEL_HEIGHT = 250
const FALLBACK_LEFT_SIDEBAR_MIN_WIDTH = 160
const FALLBACK_RIGHT_SIDEBAR_MIN_WIDTH = 200
const MAX_LEFT_SIDEBAR_WIDTH = 500

const leftSidebarWidth = ref(readNumberFromStorage('leftSidebarWidth', DEFAULT_LEFT_SIDEBAR_WIDTH))
const rightSidebarWidth = ref(readNumberFromStorage('rightSidebarWidth', DEFAULT_RIGHT_SIDEBAR_WIDTH))
const bottomPanelHeight = ref(readNumberFromStorage('bottomPanelHeight', DEFAULT_BOTTOM_PANEL_HEIGHT))
const rightSidebarPreSnapWidth = ref(null)
const isLeftSidebarResizing = ref(false)
const isRightSidebarResizing = ref(false)

let sidebarWidthSaveTimer = null
let leftSidebarFrame = null
let rightSidebarFrame = null
let pendingLeftSidebarWidth = leftSidebarWidth.value
let pendingRightSidebarWidth = rightSidebarWidth.value

function readNumberFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function saveNumberToStorage(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore localStorage failures.
  }
}

function debounceSidebarWidthSave() {
  clearTimeout(sidebarWidthSaveTimer)
  sidebarWidthSaveTimer = window.setTimeout(() => {
    saveNumberToStorage('leftSidebarWidth', leftSidebarWidth.value)
    saveNumberToStorage('rightSidebarWidth', rightSidebarWidth.value)
  }, 300)
}

export function resolveMinimumLeftSidebarWidth(measurements = {}) {
  const railWidth = Number(measurements.railWidth)
  const currentSidebarWidth = Number(measurements.currentSidebarWidth)
  const collapseButtonLeft = Number(measurements.collapseButtonLeft)
  const collapseButtonWidth = Number(measurements.collapseButtonWidth)
  const rightmostPanelRight = Number(measurements.rightmostPanelRight)
  const panelGap = Number(measurements.panelGap)
  const currentPanelCount = Number(measurements.currentPanelCount)
  const maxPanelCount = Number(measurements.maxPanelCount)
  const panelButtonWidth = Number(measurements.panelButtonWidth)

  if (
    !Number.isFinite(railWidth)
    || !Number.isFinite(currentSidebarWidth)
    || !Number.isFinite(collapseButtonLeft)
    || !Number.isFinite(collapseButtonWidth)
    || !Number.isFinite(rightmostPanelRight)
    || !Number.isFinite(panelGap)
  ) {
    return FALLBACK_LEFT_SIDEBAR_MIN_WIDTH
  }

  const inferredInset = railWidth + currentSidebarWidth - collapseButtonWidth - collapseButtonLeft
  if (!Number.isFinite(inferredInset)) {
    return FALLBACK_LEFT_SIDEBAR_MIN_WIDTH
  }

  const normalizedPanelGap = Math.max(panelGap, 0)
  const normalizedCurrentPanelCount = Number.isFinite(currentPanelCount) && currentPanelCount > 0
    ? currentPanelCount
    : 1
  const normalizedMaxPanelCount = Number.isFinite(maxPanelCount) && maxPanelCount > 0
    ? Math.max(maxPanelCount, normalizedCurrentPanelCount)
    : normalizedCurrentPanelCount
  const extraPanels = Math.max(0, normalizedMaxPanelCount - normalizedCurrentPanelCount)
  const effectiveRightmostPanelRight = Number.isFinite(panelButtonWidth) && panelButtonWidth > 0
    ? rightmostPanelRight + extraPanels * (panelButtonWidth + normalizedPanelGap)
    : rightmostPanelRight

  return Math.max(
    0,
    Math.ceil(
      effectiveRightmostPanelRight
      + normalizedPanelGap
      - railWidth
      + collapseButtonWidth
      + Math.max(inferredInset, 0),
    ),
  )
}

export function resolveMinimumRightSidebarWidth(measurements = {}) {
  const viewportWidth = Number(measurements.viewportWidth)
  const leftmostPanelLeft = Number(measurements.leftmostPanelLeft)
  const collapseButtonWidth = Number(measurements.collapseButtonWidth)
  const panelGap = Number(measurements.panelGap)
  const currentPanelCount = Number(measurements.currentPanelCount)
  const maxPanelCount = Number(measurements.maxPanelCount)
  const panelButtonWidth = Number(measurements.panelButtonWidth)

  if (
    !Number.isFinite(viewportWidth)
    || !Number.isFinite(leftmostPanelLeft)
    || !Number.isFinite(collapseButtonWidth)
    || !Number.isFinite(panelGap)
  ) {
    return FALLBACK_RIGHT_SIDEBAR_MIN_WIDTH
  }

  const normalizedPanelGap = Math.max(panelGap, 0)
  const normalizedCurrentPanelCount = Number.isFinite(currentPanelCount) && currentPanelCount > 0
    ? currentPanelCount
    : 1
  const normalizedMaxPanelCount = Number.isFinite(maxPanelCount) && maxPanelCount > 0
    ? Math.max(maxPanelCount, normalizedCurrentPanelCount)
    : normalizedCurrentPanelCount
  const extraPanels = Math.max(0, normalizedMaxPanelCount - normalizedCurrentPanelCount)
  const effectiveLeftmostPanelLeft = Number.isFinite(panelButtonWidth) && panelButtonWidth > 0
    ? leftmostPanelLeft - extraPanels * (panelButtonWidth + normalizedPanelGap)
    : leftmostPanelLeft

  return Math.max(
    0,
    Math.ceil(
      viewportWidth
      - effectiveLeftmostPanelLeft
      + normalizedPanelGap
      + collapseButtonWidth,
    ),
  )
}

function readLeftSidebarChromeMeasurements() {
  if (typeof document === 'undefined') return null

  const railEl = document.querySelector('.workbench-rail')
  const collapseButtonEl = document.querySelector('.header-sidebar-collapse-button')
  const panelTabsEl = document.querySelector('.header-sidebar-panel-tabs.is-left')
  const panelButtonEls = Array.from(document.querySelectorAll('.header-sidebar-panel-button'))

  if (!railEl || !collapseButtonEl || !panelTabsEl || panelButtonEls.length === 0) {
    return null
  }

  const rightmostPanelRect = panelButtonEls.at(-1)?.getBoundingClientRect()
  const adjacentPanelRect = panelButtonEls.at(-2)?.getBoundingClientRect()
  const collapseButtonRect = collapseButtonEl.getBoundingClientRect()
  const railRect = railEl.getBoundingClientRect()
  const panelTabsStyle = window.getComputedStyle(panelTabsEl)
  const rawGap = parseFloat(panelTabsStyle.columnGap || panelTabsStyle.gap || '0')
  const panelGap = rightmostPanelRect && adjacentPanelRect
    ? rightmostPanelRect.left - adjacentPanelRect.right
    : (Number.isFinite(rawGap) ? rawGap : 0)

  if (!rightmostPanelRect || !adjacentPanelRect || !collapseButtonRect || !railRect) {
    if (!rightmostPanelRect || !collapseButtonRect || !railRect) {
      return null
    }
  }

  return {
    railWidth: railRect.width,
    currentSidebarWidth: leftSidebarWidth.value,
    collapseButtonLeft: collapseButtonRect.left,
    collapseButtonWidth: collapseButtonRect.width,
    rightmostPanelRight: rightmostPanelRect.right,
    panelGap,
    currentPanelCount: panelButtonEls.length,
    maxPanelCount: MAX_WORKBENCH_SIDEBAR_PANEL_COUNT,
    panelButtonWidth: rightmostPanelRect.width,
  }
}

function readRightSidebarChromeMeasurements() {
  if (typeof document === 'undefined') return null

  const collapseButtonEl = document.querySelector('.header-inspector-collapse-button')
  const panelTabsEl = document.querySelector('.header-sidebar-panel-tabs.is-right')
  const panelButtonEls = Array.from(document.querySelectorAll('.header-inspector-panel-button'))

  if (!collapseButtonEl || !panelTabsEl || panelButtonEls.length === 0) {
    return null
  }

  const leftmostPanelRect = panelButtonEls.at(0)?.getBoundingClientRect()
  const rightmostPanelRect = panelButtonEls.at(-1)?.getBoundingClientRect()
  const adjacentPanelRect = panelButtonEls.at(-2)?.getBoundingClientRect()
  const collapseButtonRect = collapseButtonEl.getBoundingClientRect()
  const panelTabsStyle = window.getComputedStyle(panelTabsEl)
  const rawGap = parseFloat(panelTabsStyle.columnGap || panelTabsStyle.gap || '0')
  const panelGap = rightmostPanelRect && adjacentPanelRect
    ? rightmostPanelRect.left - adjacentPanelRect.right
    : (Number.isFinite(rawGap) ? rawGap : 0)

  if (!leftmostPanelRect || !rightmostPanelRect || !collapseButtonRect) {
    return null
  }

  return {
    viewportWidth: window.innerWidth,
    leftmostPanelLeft: leftmostPanelRect.left,
    collapseButtonWidth: collapseButtonRect.width,
    panelGap,
    currentPanelCount: panelButtonEls.length,
    maxPanelCount: MAX_WORKBENCH_INSPECTOR_PANEL_COUNT,
    panelButtonWidth: rightmostPanelRect.width,
  }
}

function resolveDynamicLeftSidebarMinWidth() {
  return resolveMinimumLeftSidebarWidth(readLeftSidebarChromeMeasurements() || {})
}

function resolveDynamicRightSidebarMinWidth() {
  return resolveMinimumRightSidebarWidth(readRightSidebarChromeMeasurements() || {})
}

function commitLeftSidebarWidth(value) {
  const minWidth = resolveDynamicLeftSidebarMinWidth()
  leftSidebarWidth.value = Math.max(minWidth, Math.min(MAX_LEFT_SIDEBAR_WIDTH, value))
  debounceSidebarWidthSave()
}

function scheduleLeftSidebarWidth(value) {
  pendingLeftSidebarWidth = value
  if (leftSidebarFrame !== null) return

  leftSidebarFrame = window.requestAnimationFrame(() => {
    leftSidebarFrame = null
    commitLeftSidebarWidth(pendingLeftSidebarWidth)
  })
}

function commitRightSidebarWidth(value) {
  const maxWidth = Math.floor(window.innerWidth * 0.8)
  const minWidth = resolveDynamicRightSidebarMinWidth()
  rightSidebarWidth.value = Math.max(minWidth, Math.min(maxWidth, value))
  debounceSidebarWidthSave()
}

function scheduleRightSidebarWidth(value) {
  pendingRightSidebarWidth = value
  if (rightSidebarFrame !== null) return

  rightSidebarFrame = window.requestAnimationFrame(() => {
    rightSidebarFrame = null
    commitRightSidebarWidth(pendingRightSidebarWidth)
  })
}

function flushScheduledSidebarWidths() {
  if (leftSidebarFrame !== null) {
    window.cancelAnimationFrame(leftSidebarFrame)
    leftSidebarFrame = null
    commitLeftSidebarWidth(pendingLeftSidebarWidth)
  }

  if (rightSidebarFrame !== null) {
    window.cancelAnimationFrame(rightSidebarFrame)
    rightSidebarFrame = null
    commitRightSidebarWidth(pendingRightSidebarWidth)
  }
}

function setBottomPanelHeight(value) {
  bottomPanelHeight.value = Math.max(100, Math.min(600, value))
  saveNumberToStorage('bottomPanelHeight', bottomPanelHeight.value)
}

function onLeftResize(event) {
  scheduleLeftSidebarWidth(event.x)
}

function onBottomResize(event) {
  setBottomPanelHeight(window.innerHeight - event.y)
}

function onRightResize(event) {
  scheduleRightSidebarWidth(window.innerWidth - event.x)
  rightSidebarPreSnapWidth.value = null
}

function onRightResizeSnap() {
  const halfWindow = Math.floor(window.innerWidth / 2)
  if (rightSidebarPreSnapWidth.value !== null) {
    commitRightSidebarWidth(rightSidebarPreSnapWidth.value)
    rightSidebarPreSnapWidth.value = null
    return
  }

  rightSidebarPreSnapWidth.value = rightSidebarWidth.value
  commitRightSidebarWidth(halfWindow)
}

function startLeftSidebarResize() {
  isLeftSidebarResizing.value = true
}

function endLeftSidebarResize() {
  isLeftSidebarResizing.value = false
  flushScheduledSidebarWidths()
}

function startRightSidebarResize() {
  isRightSidebarResizing.value = true
}

function endRightSidebarResize() {
  isRightSidebarResizing.value = false
  flushScheduledSidebarWidths()
}

function cleanupAppShellLayout() {
  clearTimeout(sidebarWidthSaveTimer)
  sidebarWidthSaveTimer = null
  flushScheduledSidebarWidths()
}

export function useAppShellLayout() {
  onMounted(() => {
    window.requestAnimationFrame(() => {
      commitLeftSidebarWidth(leftSidebarWidth.value)
      commitRightSidebarWidth(rightSidebarWidth.value)
    })
  })

  return {
    leftSidebarWidth,
    rightSidebarWidth,
    bottomPanelHeight,
    isLeftSidebarResizing,
    isRightSidebarResizing,
    onLeftResize,
    startLeftSidebarResize,
    endLeftSidebarResize,
    onBottomResize,
    onRightResize,
    startRightSidebarResize,
    endRightSidebarResize,
    onRightResizeSnap,
    cleanupAppShellLayout,
  }
}
