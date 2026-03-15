import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useEnvironmentStore } from '../stores/environment'
import { useFilesStore } from '../stores/files'
import { useKernelStore } from '../stores/kernel'
import { useReviewsStore } from '../stores/reviews'
import { useToastStore } from '../stores/toast'
import { useI18n } from '../i18n'
import { normalizeNotebookOutput, summarizeNotebookCellOutputs, buildNotebookRunAllSummary } from '../editor/notebookOutputs'
import { readNotebookDocument, writeNotebookDocument, writeNotebookDocumentPreservingPendingEdits } from '../services/notebookDocument'
import { formatFileError } from '../utils/errorMessages'
import { generateCellId, getNotebookLanguage, parseNotebook } from '../utils/notebookFormat'

export function useNotebookEditor(props) {
  const filesStore = useFilesStore()
  const kernelStore = useKernelStore()
  const reviews = useReviewsStore()
  const envStore = useEnvironmentStore()
  const toastStore = useToastStore()
  const { t } = useI18n()

  const cells = reactive([])
  const metadata = ref({})
  const nbformat = ref(4)
  const nbformatMinor = ref(5)
  const activeCell = ref(0)
  const saving = ref(false)
  const kernelId = ref(null)
  const selectedSpec = ref('')
  const runningCells = reactive(new Set())

  const showStatusPopover = ref(false)
  const statusChipRef = ref(null)
  const popoverX = ref(0)
  const popoverY = ref(0)

  const cellRefs = {}
  let saveTimer = null
  let executionCounter = 0

  const pendingNotebookEdits = computed(() => reviews.notebookEditsForFile(props.filePath))

  const displayCells = computed(() => {
    const edits = pendingNotebookEdits.value
    if (edits.length === 0) {
      return cells.map((cell) => ({
        ...cell,
        _pendingEdit: null,
        _pendingDelete: false,
        _pendingAdd: false,
        _editId: null,
      }))
    }

    const result = []
    const editsByCell = {}
    const addEdits = []

    for (const edit of edits) {
      if (edit.tool === 'NotebookAddCell') {
        addEdits.push(edit)
      } else {
        editsByCell[edit.cell_id] = edit
      }
    }

    for (const cell of cells) {
      const edit = editsByCell[cell.id]
      result.push({
        ...cell,
        _pendingEdit: edit?.tool === 'NotebookEditCell' ? edit : null,
        _pendingDelete: edit?.tool === 'NotebookDeleteCell',
        _pendingAdd: false,
        _editId: edit?.id || null,
      })
    }

    const sortedAdds = [...addEdits].sort((a, b) => b.cell_index - a.cell_index)
    for (const add of sortedAdds) {
      const index = Math.min(add.cell_index, result.length)
      result.splice(index, 0, {
        id: add.cell_id,
        type: add.cell_type || 'code',
        source: add.cell_source || '',
        outputs: [],
        executionCount: null,
        metadata: {},
        _pendingEdit: null,
        _pendingDelete: false,
        _pendingAdd: true,
        _editId: add.id,
      })
    }

    return result
  })

  const kernelspecs = computed(() => kernelStore.kernelspecs)
  const notebookLanguage = computed(() => getNotebookLanguage(metadata.value))

  const langDisplayName = computed(() => {
    const lang = notebookLanguage.value
    if (lang === 'r') return 'R'
    return lang.charAt(0).toUpperCase() + lang.slice(1)
  })

  const mode = computed(() => envStore.capability(notebookLanguage.value))

  const kernelPackageName = computed(() => {
    const packages = { python: 'ipykernel', r: 'IRkernel', julia: 'IJulia' }
    return packages[notebookLanguage.value] || 'kernel'
  })

  const statusChipLabel = computed(() => envStore.statusLabel(notebookLanguage.value))

  const statusChipClass = computed(() => ({
    'nb-chip-jupyter': mode.value === 'jupyter',
    'nb-chip-none': mode.value === 'none',
  }))

  const statusDotClass = computed(() => ({
    good: mode.value === 'jupyter',
    none: mode.value === 'none',
  }))

  const kernelStatusLabel = computed(() => {
    if (!kernelId.value) return t('No kernel')
    const kernel = kernelStore.kernels[kernelId.value]
    return kernel ? kernel.status : t('disconnected')
  })

  const kernelStatusStyle = computed(() => {
    const status = kernelStatusLabel.value
    if (status === 'idle') {
      return { color: 'var(--success)', background: 'rgba(80, 250, 123, 0.1)' }
    }
    if (status === 'busy') {
      return { color: 'var(--warning, #e2b93d)', background: 'rgba(226, 185, 61, 0.1)' }
    }
    return { color: 'var(--fg-muted)', background: 'var(--bg-secondary)' }
  })

  function applyNotebookState(notebook) {
    cells.splice(0, cells.length, ...notebook.cells)
    metadata.value = notebook.metadata
    nbformat.value = notebook.nbformat
    nbformatMinor.value = notebook.nbformat_minor

    const specName = notebook.metadata?.kernelspec?.name
    if (specName && kernelspecs.value.find((kernel) => kernel.name === specName)) {
      selectedSpec.value = specName
    } else if (kernelspecs.value.length > 0) {
      selectedSpec.value = kernelspecs.value[0].name
    }
  }

  function setCellRef(index, element) {
    if (element) cellRefs[index] = element
    else delete cellRefs[index]
  }

  function toggleStatusPopover() {
    if (showStatusPopover.value) {
      showStatusPopover.value = false
      return
    }
    if (statusChipRef.value) {
      const rect = statusChipRef.value.getBoundingClientRect()
      popoverX.value = rect.left
      popoverY.value = rect.bottom + 4
    }
    showStatusPopover.value = true
  }

  async function handleInstallKernel() {
    const success = await envStore.installKernel(notebookLanguage.value)
    if (!success) return

    await kernelStore.discover()
    if (kernelspecs.value.length > 0 && !selectedSpec.value) {
      selectedSpec.value = kernelspecs.value[0].name
    }
  }

  async function redetect() {
    await envStore.detect()
    if (mode.value === 'jupyter') {
      await kernelStore.discover()
    }
  }

  async function loadNotebook() {
    const notebook = await readNotebookDocument(props.filePath, filesStore.fileContents)
    applyNotebookState(notebook)
  }

  function syncCellRefsIntoState() {
    for (const [indexText, cellRef] of Object.entries(cellRefs)) {
      if (!cellRef?.syncContent) continue
      const index = Number.parseInt(indexText, 10)
      const displayCell = displayCells.value[index]
      if (displayCell && !displayCell._pendingEdit && !displayCell._pendingDelete && !displayCell._pendingAdd) {
        cellRef.syncContent()
      }
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveNotebook()
    }, 1500)
  }

  async function saveNotebook() {
    saving.value = true
    try {
      syncCellRefsIntoState()

      const notebookState = {
        cells,
        metadata: metadata.value,
        nbformat: nbformat.value,
        nbformatMinor: nbformatMinor.value,
      }

      if (pendingNotebookEdits.value.length === 0) {
        await writeNotebookDocument(props.filePath, notebookState, filesStore.fileContents)
      } else {
        await writeNotebookDocumentPreservingPendingEdits(
          props.filePath,
          notebookState,
          (filePath, cellId) => reviews.notebookEditForCell(filePath, cellId),
          filesStore.fileContents,
        )
      }
    } catch (error) {
      console.error('Notebook save failed:', error)
      toastStore.showOnce(
        `save:${props.filePath}`,
        formatFileError('save', props.filePath, error),
        { type: 'error', duration: 5000 },
      )
    } finally {
      saving.value = false
    }
  }

  function addCell(index, type) {
    const newCell = {
      id: generateCellId(),
      type,
      source: '',
      outputs: [],
      executionCount: null,
      metadata: {},
    }
    cells.splice(index, 0, newCell)
    activeCell.value = index
    scheduleSave()
    nextTick(() => {
      if (cellRefs[index]?.focus) cellRefs[index].focus()
    })
  }

  function deleteCell(index) {
    if (cells.length <= 1) return
    cells.splice(index, 1)
    if (activeCell.value >= cells.length) {
      activeCell.value = cells.length - 1
    }
    scheduleSave()
  }

  function moveCell(index, direction) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= cells.length) return
    const [cell] = cells.splice(index, 1)
    cells.splice(newIndex, 0, cell)
    activeCell.value = newIndex
    scheduleSave()
  }

  function toggleCellType(index) {
    const cell = cells[index]
    cell.type = cell.type === 'code' ? 'markdown' : 'code'
    if (cell.type === 'markdown') {
      cell.outputs = []
      cell.executionCount = null
    }
    scheduleSave()
  }

  function updateCellSource(index, source) {
    cells[index].source = source
    scheduleSave()
  }

  function clearAllOutputs() {
    for (const cell of cells) {
      if (cell.type !== 'code') continue
      cell.outputs = []
      cell.executionCount = null
    }
    scheduleSave()
  }

  function scrollToCell(cellIndex) {
    const cellRef = cellRefs[cellIndex]
    if (!cellRef?.$el) return

    cellRef.$el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    activeCell.value = cellIndex
    nextTick(() => cellRef.focus?.())
  }

  async function ensureKernel() {
    if (kernelId.value && kernelStore.kernels[kernelId.value]) {
      return kernelId.value
    }

    if (!selectedSpec.value) {
      if (kernelspecs.value.length === 0) {
        await kernelStore.discover()
      }
      if (kernelspecs.value.length === 0) {
        throw new Error(t('No Jupyter kernels available'))
      }
      selectedSpec.value = kernelspecs.value[0].name
    }

    kernelId.value = await kernelStore.launch(selectedSpec.value)
    return kernelId.value
  }

  async function restartKernel() {
    if (kernelId.value) {
      await kernelStore.shutdown(kernelId.value)
      kernelId.value = null
    }

    for (const cell of cells) {
      if (cell.type !== 'code') continue
      cell.executionCount = null
    }

    await ensureKernel()
  }

  async function runCell(index) {
    const cell = cells[index]
    if (cell.type !== 'code' || !cell.source.trim()) return null

    if (mode.value !== 'jupyter') {
      cell.outputs = [{
        output_type: 'error',
        ename: t('No Kernel'),
        evalue: t('Set up a Jupyter kernel to run cells. Click the status chip in the toolbar.'),
        traceback: [],
      }]
      return { outputs: cell.outputs, success: false }
    }

    try {
      const currentKernelId = await ensureKernel()
      runningCells.add(cell.id)
      cell.outputs = []

      const result = await kernelStore.execute(currentKernelId, cell.source)
      executionCounter += 1
      cell.executionCount = executionCounter
      cell.outputs = result.outputs.map(normalizeNotebookOutput)

      scheduleSave()
      return { outputs: cell.outputs, success: result.success }
    } catch (error) {
      const message = error?.message || String(error)
      cell.outputs = [{
        output_type: 'error',
        ename: t('ExecutionError'),
        evalue: message,
        traceback: [message],
      }]
      return { outputs: cell.outputs, success: false }
    } finally {
      runningCells.delete(cell.id)
    }
  }

  async function runAllCells() {
    for (let index = 0; index < cells.length; index += 1) {
      if (cells[index].type !== 'code') continue
      const result = await runCell(index)
      if (result && result.success === false) break
    }
  }

  function onNotebookScrollToCell(event) {
    const { path, cellId } = event.detail || {}
    if (path !== props.filePath) return

    const index = cells.findIndex((cell) => cell.id === cellId)
    if (index >= 0) scrollToCell(index)
  }

  function onRunNotebookCell(event) {
    const { path, index } = event.detail || {}
    if (path !== props.filePath) return

    runCell(index).then((result) => {
      window.dispatchEvent(new CustomEvent('cell-execution-complete', {
        detail: {
          path,
          index,
          output: summarizeNotebookCellOutputs(result?.outputs || [], t),
          success: result?.success !== false,
          error: result?.success === false ? summarizeNotebookCellOutputs(result?.outputs || [], t) : null,
        },
      }))
    })
  }

  function onRunAllNotebookCells(event) {
    const { path } = event.detail || {}
    if (path !== props.filePath) return

    runAllCells().then(() => {
      window.dispatchEvent(new CustomEvent('all-cells-execution-complete', {
        detail: {
          path,
          summary: buildNotebookRunAllSummary(cells, t),
        },
      }))
    })
  }

  function onNotebookPendingEdit(event) {
    const { file_path: filePath } = event.detail || {}
    if (filePath !== props.filePath) return
  }

  function onNotebookReviewResolved(event) {
    const { file_path: filePath } = event.detail || {}
    if (filePath !== props.filePath) return
    loadNotebook()
  }

  async function initialize() {
    if (!envStore.detected) {
      await envStore.detect()
    }

    if (mode.value === 'jupyter') {
      await kernelStore.discover()
    }

    await loadNotebook()

    window.addEventListener('run-notebook-cell', onRunNotebookCell)
    window.addEventListener('run-all-notebook-cells', onRunAllNotebookCells)
    window.addEventListener('notebook-scroll-to-cell', onNotebookScrollToCell)
    window.addEventListener('notebook-pending-edit', onNotebookPendingEdit)
    window.addEventListener('notebook-review-resolved', onNotebookReviewResolved)
  }

  async function dispose() {
    window.removeEventListener('run-notebook-cell', onRunNotebookCell)
    window.removeEventListener('run-all-notebook-cells', onRunAllNotebookCells)
    window.removeEventListener('notebook-scroll-to-cell', onNotebookScrollToCell)
    window.removeEventListener('notebook-pending-edit', onNotebookPendingEdit)
    window.removeEventListener('notebook-review-resolved', onNotebookReviewResolved)

    if (saveTimer) clearTimeout(saveTimer)
    if (!filesStore.deletingPaths.has(props.filePath)) {
      await saveNotebook()
    }
  }

  function acceptPendingEdit(editId) {
    return reviews.acceptNotebookEdit(editId)
  }

  function rejectPendingEdit(editId) {
    return reviews.rejectNotebookEdit(editId)
  }

  watch(() => filesStore.fileContents[props.filePath], (newContent) => {
    if (!newContent || saving.value) return

    try {
      const notebook = parseNotebook(newContent)
      const nextSources = notebook.cells.map((cell) => cell.source)
      const currentSources = cells.map((cell) => cell.source)
      if (JSON.stringify(nextSources) !== JSON.stringify(currentSources)) {
        applyNotebookState(notebook)
      }
    } catch {
      // Ignore invalid notebook payloads pushed by in-flight file changes.
    }
  })

  onMounted(() => {
    initialize().catch((error) => {
      console.error('Notebook initialization failed:', error)
    })
  })

  onUnmounted(() => {
    dispose().catch((error) => {
      console.error('Notebook dispose failed:', error)
    })
  })

  return {
    cells,
    activeCell,
    saving,
    kernelId,
    selectedSpec,
    runningCells,
    showStatusPopover,
    statusChipRef,
    popoverX,
    popoverY,
    envStore,
    displayCells,
    kernelspecs,
    notebookLanguage,
    langDisplayName,
    mode,
    kernelPackageName,
    statusChipLabel,
    statusChipClass,
    statusDotClass,
    kernelStatusLabel,
    kernelStatusStyle,
    setCellRef,
    toggleStatusPopover,
    handleInstallKernel,
    redetect,
    addCell,
    deleteCell,
    moveCell,
    toggleCellType,
    updateCellSource,
    clearAllOutputs,
    runCell,
    runAllCells,
    restartKernel,
    acceptPendingEdit,
    rejectPendingEdit,
  }
}
