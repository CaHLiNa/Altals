import { ref } from 'vue'

const DEFAULT_LEFT_SIDEBAR_WIDTH = 240
const DEFAULT_RIGHT_SIDEBAR_WIDTH = 360
const DEFAULT_BOTTOM_PANEL_HEIGHT = 250

const leftSidebarWidth = ref(readNumberFromStorage('leftSidebarWidth', DEFAULT_LEFT_SIDEBAR_WIDTH))
const rightSidebarWidth = ref(readNumberFromStorage('rightSidebarWidth', DEFAULT_RIGHT_SIDEBAR_WIDTH))
const bottomPanelHeight = ref(readNumberFromStorage('bottomPanelHeight', DEFAULT_BOTTOM_PANEL_HEIGHT))
const rightSidebarPreSnapWidth = ref(null)

let sidebarWidthSaveTimer = null

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

function setLeftSidebarWidth(value) {
  leftSidebarWidth.value = Math.max(160, Math.min(500, value))
  debounceSidebarWidthSave()
}

function setRightSidebarWidth(value) {
  const maxWidth = Math.floor(window.innerWidth * 0.8)
  rightSidebarWidth.value = Math.max(200, Math.min(maxWidth, value))
  debounceSidebarWidthSave()
}

function setBottomPanelHeight(value) {
  bottomPanelHeight.value = Math.max(100, Math.min(600, value))
  saveNumberToStorage('bottomPanelHeight', bottomPanelHeight.value)
}

function onLeftResize(event) {
  setLeftSidebarWidth(event.x)
}

function onBottomResize(event) {
  setBottomPanelHeight(window.innerHeight - event.y)
}

function onRightResize(event) {
  setRightSidebarWidth(window.innerWidth - event.x)
  rightSidebarPreSnapWidth.value = null
}

function onRightResizeSnap() {
  const halfWindow = Math.floor(window.innerWidth / 2)
  if (rightSidebarPreSnapWidth.value !== null) {
    setRightSidebarWidth(rightSidebarPreSnapWidth.value)
    rightSidebarPreSnapWidth.value = null
    return
  }

  rightSidebarPreSnapWidth.value = rightSidebarWidth.value
  setRightSidebarWidth(halfWindow)
}

function cleanupAppShellLayout() {
  clearTimeout(sidebarWidthSaveTimer)
  sidebarWidthSaveTimer = null
}

export function useAppShellLayout() {
  return {
    leftSidebarWidth,
    rightSidebarWidth,
    bottomPanelHeight,
    onLeftResize,
    onBottomResize,
    onRightResize,
    onRightResizeSnap,
    cleanupAppShellLayout,
  }
}
