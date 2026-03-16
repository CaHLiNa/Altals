import { invoke } from '@tauri-apps/api/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'

export function useCompiledPdfPreview(options) {
  const {
    pdfPathRef,
    reloadEventName = '',
    matchesReloadEvent = null,
    onReload = null,
  } = options

  const hasPdf = ref(false)
  const pdfReloadKey = ref(0)

  async function checkPdfExists() {
    const targetPath = pdfPathRef?.value
    if (!targetPath) {
      hasPdf.value = false
      return false
    }

    try {
      hasPdf.value = await invoke('path_exists', { path: targetPath })
    } catch {
      hasPdf.value = false
    }

    return hasPdf.value
  }

  function handleReloadEvent(event) {
    if (!reloadEventName) return
    if (typeof matchesReloadEvent === 'function' && !matchesReloadEvent(event)) return

    pdfReloadKey.value += 1
    void checkPdfExists()
    onReload?.(event)
  }

  onMounted(() => {
    if (reloadEventName) {
      window.addEventListener(reloadEventName, handleReloadEvent)
    }
    void checkPdfExists()
  })

  onUnmounted(() => {
    if (reloadEventName) {
      window.removeEventListener(reloadEventName, handleReloadEvent)
    }
  })

  watch(pdfPathRef, () => {
    void checkPdfExists()
  })

  return {
    hasPdf,
    pdfReloadKey,
    checkPdfExists,
  }
}
