import { onMounted, onUnmounted, ref } from 'vue'
import { listenNativeFileDropEvents } from '../services/fileTreeSystem'

const IMPORTABLE_EXTS = ['.bib', '.ris', '.json', '.pdf', '.csl', '.nbib', '.enw', '.txt']

function isImportableFile(path) {
  const lower = path.toLowerCase()
  return IMPORTABLE_EXTS.some((ext) => lower.endsWith(ext))
}

function hasImportableFiles(paths) {
  return paths.some((path) => isImportableFile(path))
}

export function useFileTreeDrag(options) {
  const {
    files,
    editor,
    workspace,
    treeContainer,
    selectedPaths,
  } = options

  const dragGhostVisible = ref(false)
  const dragGhostX = ref(0)
  const dragGhostY = ref(0)
  const dragGhostLabel = ref('')
  const dragOverDir = ref(null)
  const externalDragOver = ref(false)

  let draggedPaths = []
  let stopNativeListeners = null

  function cleanupDragState() {
    dragGhostVisible.value = false
    dragOverDir.value = null
    draggedPaths = []
    document.body.classList.remove('tab-dragging')
  }

  function isOverRefZone(position) {
    if (document.querySelector('[data-ref-dialog]')) return true
    const refZone = document.querySelector('[data-ref-drop-zone]')
    if (!refZone) return false
    const rect = refZone.getBoundingClientRect()
    return position.x >= rect.left && position.x <= rect.right &&
      position.y >= rect.top && position.y <= rect.bottom
  }

  function dirAtPosition(x, y) {
    const element = document.elementFromPoint(x, y)
    if (!element) return null
    const dirElement = element.closest('[data-dir-path]')
    if (dirElement) return dirElement.dataset.dirPath
    if (treeContainer.value?.contains(element)) return workspace.path
    return null
  }

  function onDragStart({ path, event }) {
    if (selectedPaths.has(path)) {
      draggedPaths = [...selectedPaths]
    } else {
      draggedPaths = [path]
    }

    const names = draggedPaths.map((itemPath) => itemPath.split('/').pop())
    dragGhostLabel.value = names.length === 1 ? names[0] : `${names.length} items`
    dragGhostVisible.value = true
    dragGhostX.value = event.clientX
    dragGhostY.value = event.clientY
    document.body.classList.add('tab-dragging')
    window.dispatchEvent(new CustomEvent('filetree-drag-start', { detail: { paths: [...draggedPaths] } }))

    const canImport = hasImportableFiles(draggedPaths)
    let overRefZone = false

    const onMouseMove = (moveEvent) => {
      dragGhostX.value = moveEvent.clientX
      dragGhostY.value = moveEvent.clientY
      window.dispatchEvent(new CustomEvent('filetree-drag-move', {
        detail: { paths: [...draggedPaths], x: moveEvent.clientX, y: moveEvent.clientY },
      }))

      if (!canImport) return
      const nowOverRef = isOverRefZone({ x: moveEvent.clientX, y: moveEvent.clientY })
      if (nowOverRef && !overRefZone) {
        window.dispatchEvent(new CustomEvent('ref-drag-over'))
        dragOverDir.value = null
        overRefZone = true
      } else if (!nowOverRef && overRefZone) {
        window.dispatchEvent(new CustomEvent('ref-drag-leave'))
        overRefZone = false
      }
    }

    const onMouseUp = (upEvent) => {
      if (canImport && overRefZone && draggedPaths.length > 0) {
        const importPaths = [...draggedPaths]
        cleanupDragState()
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        window.dispatchEvent(new CustomEvent('ref-drag-leave'))
        window.dispatchEvent(new CustomEvent('ref-file-drop', { detail: { paths: importPaths } }))
        window.dispatchEvent(new CustomEvent('filetree-drag-end'))
        return
      }

      const endPaths = [...draggedPaths]
      cleanupDragState()
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      window.dispatchEvent(new CustomEvent('filetree-drag-end', {
        detail: { paths: endPaths, x: upEvent.clientX, y: upEvent.clientY },
      }))
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onDragLeaveDir(dir) {
    if (dragOverDir.value === dir) {
      dragOverDir.value = null
    }
  }

  async function onDropOnDir(destDir) {
    if (!draggedPaths.length) return
    for (const srcPath of draggedPaths) {
      if (destDir.startsWith(`${srcPath}/`) || destDir === srcPath) continue
      await files.movePath(srcPath, destDir)
    }
    cleanupDragState()
    selectedPaths.clear()
  }

  function onTreeMouseUp() {
    if (!draggedPaths.length || !workspace.path) return
    if (dragOverDir.value) return
    if (!document.body.classList.contains('tab-dragging')) return
    void onDropOnDir(workspace.path)
  }

  onMounted(async () => {
    stopNativeListeners = await listenNativeFileDropEvents({
      onOver: ({ position }) => {
        if (draggedPaths.length > 0) return

        if (isOverRefZone(position)) {
          externalDragOver.value = false
          dragOverDir.value = null
          window.dispatchEvent(new CustomEvent('ref-drag-over'))
          return
        }

        window.dispatchEvent(new CustomEvent('ref-drag-leave'))
        externalDragOver.value = true
        dragOverDir.value = dirAtPosition(position.x, position.y)
      },
      onDrop: async ({ paths, position }) => {
        if (draggedPaths.length > 0) return
        externalDragOver.value = false

        if (!workspace.path || !paths || paths.length === 0) {
          dragOverDir.value = null
          return
        }

        if (isOverRefZone(position)) {
          dragOverDir.value = null
          window.dispatchEvent(new CustomEvent('ref-drag-leave'))
          window.dispatchEvent(new CustomEvent('ref-file-drop', { detail: { paths } }))
          return
        }

        const destDir = dirAtPosition(position.x, position.y) || workspace.path
        dragOverDir.value = null

        let lastCopied = null
        for (const srcPath of paths) {
          const result = await files.copyExternalFile(srcPath, destDir)
          if (result) lastCopied = result
        }
        if (lastCopied) {
          files.expandedDirs.add(destDir)
          if (lastCopied.isDir) {
            files.expandedDirs.add(lastCopied.path)
          } else {
            editor.openFile(lastCopied.path)
          }
        }
      },
      onLeave: () => {
        externalDragOver.value = false
        if (draggedPaths.length === 0) {
          dragOverDir.value = null
        }
        window.dispatchEvent(new CustomEvent('ref-drag-leave'))
      },
    })
  })

  onUnmounted(() => {
    stopNativeListeners?.()
    stopNativeListeners = null
    externalDragOver.value = false
    cleanupDragState()
    window.dispatchEvent(new CustomEvent('filetree-drag-end'))
    window.dispatchEvent(new CustomEvent('ref-drag-leave'))
  })

  return {
    dragGhostVisible,
    dragGhostX,
    dragGhostY,
    dragGhostLabel,
    dragOverDir,
    externalDragOver,
    onDragStart,
    onDragLeaveDir,
    onDropOnDir,
    onTreeMouseUp,
    isImportableFile,
  }
}
