import { computed, ref } from 'vue'

const MIN_SECTION_HEIGHT = 60
const COLLAPSED_SECTION_HEIGHT = 28
const HANDLE_HEIGHT = 2

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sectionHeight({ collapsed, expandedHeight }) {
  return collapsed ? COLLAPSED_SECTION_HEIGHT : expandedHeight
}

export function resolveOutlineResizeHeights({
  startRefHeight,
  startOutlineHeight,
  delta,
  minRefHeight = MIN_SECTION_HEIGHT,
  minOutlineHeight = MIN_SECTION_HEIGHT,
}) {
  const total = startRefHeight + startOutlineHeight
  const nextOutlineHeight = clamp(
    startOutlineHeight + delta,
    minOutlineHeight,
    total - minRefHeight,
  )

  return {
    refHeight: total - nextOutlineHeight,
    outlineHeight: nextOutlineHeight,
  }
}

function readBooleanFromStorage(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === 'true'
  } catch {
    return fallback
  }
}

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

function saveValue(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore localStorage failures.
  }
}

export function useLeftSidebarPanels(containerEl) {
  const explorerCollapsed = ref(readBooleanFromStorage('explorerCollapsed'))
  const refsCollapsed = ref(readBooleanFromStorage('refsCollapsed'))
  const outlineCollapsed = ref(readBooleanFromStorage('outlineCollapsed'))
  const refHeight = ref(readNumberFromStorage('referencesPanelHeight', 250))
  const outlineHeight = ref(readNumberFromStorage('outlinePanelHeight', 220))
  const refsLoaded = ref(!refsCollapsed.value)
  const outlineLoaded = ref(!outlineCollapsed.value)

  const expandedCount = computed(() => {
    let count = 0
    if (!explorerCollapsed.value) count += 1
    if (!refsCollapsed.value) count += 1
    if (!outlineCollapsed.value) count += 1
    return count
  })

  const primaryExpandedPanel = computed(() => {
    if (!explorerCollapsed.value) return 'explorer'
    if (!refsCollapsed.value) return 'refs'
    return 'outline'
  })

  const explorerStyle = computed(() => {
    if (explorerCollapsed.value) return { flex: '0 0 auto' }
    return {
      flex: '1 1 0',
      minHeight: expandedCount.value > 1 ? `${MIN_SECTION_HEIGHT}px` : `${COLLAPSED_SECTION_HEIGHT}px`,
    }
  })

  const refsStyle = computed(() => {
    if (refsCollapsed.value) return { flex: '0 0 auto' }
    if (primaryExpandedPanel.value === 'refs') {
      return {
        flex: '1 1 0',
        minHeight: expandedCount.value > 1 ? `${MIN_SECTION_HEIGHT}px` : `${COLLAPSED_SECTION_HEIGHT}px`,
      }
    }
    return { flex: `0 0 ${refHeight.value}px` }
  })

  const outlineStyle = computed(() => {
    if (outlineCollapsed.value) return { flex: '0 0 auto' }
    if (primaryExpandedPanel.value === 'outline') {
      return {
        flex: '1 1 0',
        minHeight: expandedCount.value > 1 ? `${MIN_SECTION_HEIGHT}px` : `${COLLAPSED_SECTION_HEIGHT}px`,
      }
    }
    return { flex: `0 0 ${outlineHeight.value}px` }
  })

  const showHandleExplorerRefs = computed(() => !explorerCollapsed.value && !refsCollapsed.value)
  const showHandleRefsOutline = computed(() => !refsCollapsed.value && !outlineCollapsed.value)

  function toggleExplorer() {
    explorerCollapsed.value = !explorerCollapsed.value
    saveValue('explorerCollapsed', explorerCollapsed.value)
  }

  function toggleRefs() {
    if (refsCollapsed.value) refsLoaded.value = true
    refsCollapsed.value = !refsCollapsed.value
    saveValue('refsCollapsed', refsCollapsed.value)
  }

  function toggleOutline() {
    if (outlineCollapsed.value) outlineLoaded.value = true
    outlineCollapsed.value = !outlineCollapsed.value
    saveValue('outlineCollapsed', outlineCollapsed.value)
  }

  function startResizeRefs(event) {
    const startY = event.clientY
    const startHeight = refHeight.value
    const container = containerEl.value

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY
      const containerHeight = container?.getBoundingClientRect().height || 600
      const outlineReserve = sectionHeight({
        collapsed: outlineCollapsed.value,
        expandedHeight: outlineHeight.value,
      })
      const visibleHandles = (showHandleExplorerRefs.value ? HANDLE_HEIGHT : 0)
        + (showHandleRefsOutline.value ? HANDLE_HEIGHT : 0)
      const maxHeight = containerHeight - MIN_SECTION_HEIGHT - outlineReserve - visibleHandles
      refHeight.value = clamp(startHeight + delta, MIN_SECTION_HEIGHT, maxHeight)
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      saveValue('referencesPanelHeight', refHeight.value)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function startResizeOutline(event) {
    const startY = event.clientY
    const startRefHeight = refHeight.value
    const startHeight = outlineHeight.value

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY
      const nextHeights = resolveOutlineResizeHeights({
        startRefHeight,
        startOutlineHeight: startHeight,
        delta,
      })
      refHeight.value = nextHeights.refHeight
      outlineHeight.value = nextHeights.outlineHeight
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      saveValue('outlinePanelHeight', outlineHeight.value)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return {
    explorerCollapsed,
    refsCollapsed,
    outlineCollapsed,
    refsLoaded,
    outlineLoaded,
    explorerStyle,
    refsStyle,
    outlineStyle,
    showHandleExplorerRefs,
    showHandleRefsOutline,
    toggleExplorer,
    toggleRefs,
    toggleOutline,
    startResizeRefs,
    startResizeOutline,
  }
}
