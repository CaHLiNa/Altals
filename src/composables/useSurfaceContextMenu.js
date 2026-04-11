import { ref } from 'vue'

function normalizeCoordinate(value = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function useSurfaceContextMenu() {
  const menuVisible = ref(false)
  const menuX = ref(0)
  const menuY = ref(0)
  const menuGroups = ref([])

  function closeSurfaceContextMenu() {
    menuVisible.value = false
    menuGroups.value = []
  }

  function openSurfaceContextMenu(options = {}) {
    menuX.value = normalizeCoordinate(options.x)
    menuY.value = normalizeCoordinate(options.y)
    menuGroups.value = Array.isArray(options.groups) ? options.groups : []
    menuVisible.value = true
  }

  function handleSurfaceContextMenuSelect(_key, item) {
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
