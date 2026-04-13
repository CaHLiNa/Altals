import { ref } from 'vue'
import { useTransientOverlayDismiss } from './useTransientOverlayDismiss'

function normalizeCoordinate(value = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function useSurfaceContextMenu() {
  const menuVisible = ref(false)
  const menuX = ref(0)
  const menuY = ref(0)
  const menuGroups = ref([])
  const { dismissOtherTransientOverlays } = useTransientOverlayDismiss(
    'surface-context-menu',
    () => {
      closeSurfaceContextMenu()
    }
  )

  function closeSurfaceContextMenu() {
    menuVisible.value = false
    menuGroups.value = []
  }

  function openSurfaceContextMenu(options = {}) {
    dismissOtherTransientOverlays()
    menuX.value = normalizeCoordinate(options.x)
    menuY.value = normalizeCoordinate(options.y)
    menuGroups.value = Array.isArray(options.groups) ? options.groups : []
    menuVisible.value = true
  }

  function handleSurfaceContextMenuSelect(_key, item) {
    closeSurfaceContextMenu()
    item?.action?.()
  }

  return {
    menuVisible,
    menuX,
    menuY,
    menuGroups,
    closeSurfaceContextMenu,
    openSurfaceContextMenu,
    handleSurfaceContextMenuSelect,
  }
}
