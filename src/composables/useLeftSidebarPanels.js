import { computed, ref } from 'vue'

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
  const refHeight = ref(readNumberFromStorage('referencesPanelHeight', 250))
  const refsLoaded = ref(!refsCollapsed.value)

  const expandedCount = computed(() => {
    let count = 0
    if (!explorerCollapsed.value) count += 1
    if (!refsCollapsed.value) count += 1
    return count
  })

  const explorerStyle = computed(() => {
    if (explorerCollapsed.value) return { flex: '0 0 auto' }
    return { flex: '1 1 0', minHeight: expandedCount.value > 1 ? '60px' : '28px' }
  })

  const refsStyle = computed(() => {
    if (refsCollapsed.value) return { flex: '0 0 auto' }
    if (expandedCount.value === 1) return { flex: '1 1 0', minHeight: '28px' }
    return { flex: `0 0 ${refHeight.value}px` }
  })

  const showHandleExplorerRefs = computed(() => !explorerCollapsed.value && !refsCollapsed.value)

  function toggleExplorer() {
    explorerCollapsed.value = !explorerCollapsed.value
    saveValue('explorerCollapsed', explorerCollapsed.value)
  }

  function toggleRefs() {
    if (refsCollapsed.value) refsLoaded.value = true
    refsCollapsed.value = !refsCollapsed.value
    saveValue('refsCollapsed', refsCollapsed.value)
  }

  function startResizeRefs(event) {
    const startY = event.clientY
    const startHeight = refHeight.value
    const container = containerEl.value

    const onMouseMove = (moveEvent) => {
      const delta = startY - moveEvent.clientY
      const containerHeight = container?.getBoundingClientRect().height || 600
      const maxHeight = containerHeight - 60 - 3
      refHeight.value = Math.max(60, Math.min(maxHeight, startHeight + delta))
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      saveValue('referencesPanelHeight', refHeight.value)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return {
    explorerCollapsed,
    refsCollapsed,
    refsLoaded,
    explorerStyle,
    refsStyle,
    showHandleExplorerRefs,
    toggleExplorer,
    toggleRefs,
    startResizeRefs,
  }
}
