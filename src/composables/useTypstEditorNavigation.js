import { reactive } from 'vue'
import { EditorView } from '@codemirror/view'
import {
  requestTinymistDefinition,
  requestTinymistReferences,
  requestTinymistRename,
} from '../services/tinymist/session'
import {
  formatTinymistLocationLabel,
  normalizeTinymistLocations,
} from '../services/tinymist/locations'
import {
  offsetToTinymistPosition,
  tinymistRangeToOffsets,
} from '../services/tinymist/textEdits'
import { applyTinymistWorkspaceEdit } from '../services/tinymist/workspaceEdit'

const VIEW_WAIT_TIMEOUT_MS = 1500
const sharedReferenceCycle = {
  items: [],
  index: -1,
}

function getRenameCandidate(state, pos) {
  const line = state.doc.lineAt(pos)
  const lineOffset = pos - line.from
  const text = line.text
  const before = text.slice(0, lineOffset)
  const after = text.slice(lineOffset)
  const leftMatch = before.match(/[A-Za-z0-9_:-]+$/)
  const rightMatch = after.match(/^[A-Za-z0-9_:-]+/)
  return `${leftMatch?.[0] || ''}${rightMatch?.[0] || ''}`.trim()
}

function locationContainsOffset(state, location, offset) {
  const range = location?.targetSelectionRange || location?.range
  const offsets = tinymistRangeToOffsets(state, range)
  if (!offsets) return false
  return offset >= offsets.from && offset <= offsets.to
}

export function useTypstEditorNavigation(options) {
  const {
    filePath,
    getView,
    editorStore,
    filesStore,
    toastStore,
    isTinymistAvailable,
    t,
  } = options

  const tinymistNavUi = reactive({
    jumpInFlight: false,
  })

  function clearReferenceCycle() {
    sharedReferenceCycle.items = []
    sharedReferenceCycle.index = -1
  }

  function ensureTinymistReady() {
    if (isTinymistAvailable()) return true
    toastStore.showOnce(
      'tinymist-navigation-unavailable',
      t('Tinymist is not available for navigation.'),
      { type: 'error', duration: 4000 },
      5000,
    )
    return false
  }

  async function waitForEditorView(targetPath) {
    const startedAt = Date.now()
    let targetView = editorStore.getAnyEditorView(targetPath)

    while (!targetView && Date.now() - startedAt < VIEW_WAIT_TIMEOUT_MS) {
      await new Promise((resolve) => window.setTimeout(resolve, 16))
      targetView = editorStore.getAnyEditorView(targetPath)
    }

    return targetView
  }

  function focusTinymistRange(targetView, location, options = {}) {
    const range = location?.targetSelectionRange || location?.range
    const offsets = tinymistRangeToOffsets(targetView.state, range)
    if (!offsets) return false

    tinymistNavUi.jumpInFlight = true
    try {
      targetView.dispatch({
        selection: {
          anchor: offsets.from,
          head: offsets.to,
        },
        effects: EditorView.scrollIntoView(offsets.from, {
          y: options.center === false ? 'nearest' : 'center',
          yMargin: 80,
        }),
      })
      targetView.focus()
      return true
    } finally {
      tinymistNavUi.jumpInFlight = false
    }
  }

  async function revealTinymistLocation(location, options = {}) {
    const targetPath = String(location?.filePath || '')
    if (!targetPath) return false

    editorStore.openFile(targetPath)
    const targetView = targetPath === filePath
      ? (getView() || await waitForEditorView(targetPath))
      : await waitForEditorView(targetPath)

    if (!targetView) {
      toastStore.show(
        t('Could not open {location}.', { location: formatTinymistLocationLabel(location) }),
        { type: 'error', duration: 4500 },
      )
      return false
    }

    return focusTinymistRange(targetView, location, options)
  }

  async function goToDefinitionAtOffset(offset) {
    const view = getView()
    if (!view || !ensureTinymistReady()) return false

    const result = await requestTinymistDefinition(
      filePath,
      offsetToTinymistPosition(view.state, offset),
    )
    const locations = normalizeTinymistLocations(result)
    if (locations.length === 0) {
      toastStore.show(t('No definition found.'), { type: 'info', duration: 2500 })
      return false
    }

    const revealed = await revealTinymistLocation(locations[0])
    if (!revealed) return false

    if (locations.length > 1) {
      toastStore.show(
        t('Multiple definitions found. Opened {location}.', {
          location: formatTinymistLocationLabel(locations[0]),
        }),
        { type: 'info', duration: 3000 },
      )
    }
    return true
  }

  async function goToDefinitionFromCursor() {
    const view = getView()
    if (!view) return false
    return goToDefinitionAtOffset(view.state.selection.main.head)
  }

  async function handleDefinitionClick(event) {
    if (!event.metaKey && !event.ctrlKey) return
    const view = getView()
    if (!view) return

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return

    event.preventDefault()
    event.stopPropagation()
    await goToDefinitionAtOffset(pos)
  }

  function isCurrentReferenceCyclePosition() {
    if (sharedReferenceCycle.index < 0 || sharedReferenceCycle.items.length === 0) return false
    const view = getView()
    if (!view) return false

    const activeLocation = sharedReferenceCycle.items[sharedReferenceCycle.index]
    if (activeLocation?.filePath !== filePath) return false
    return locationContainsOffset(view.state, activeLocation, view.state.selection.main.head)
  }

  async function goToReferenceByIndex(index) {
    if (sharedReferenceCycle.items.length === 0) return false

    const nextIndex = ((index % sharedReferenceCycle.items.length) + sharedReferenceCycle.items.length) % sharedReferenceCycle.items.length
    const location = sharedReferenceCycle.items[nextIndex]
    const revealed = await revealTinymistLocation(location)
    if (!revealed) return false

    sharedReferenceCycle.index = nextIndex
    if (sharedReferenceCycle.items.length > 1) {
      toastStore.show(
        t('Reference {index} of {count}: {location}', {
          index: nextIndex + 1,
          count: sharedReferenceCycle.items.length,
          location: formatTinymistLocationLabel(location),
        }),
        { type: 'info', duration: 2600 },
      )
    }
    return true
  }

  async function findReferencesFromCursor() {
    const view = getView()
    if (!view || !ensureTinymistReady()) return false

    if (isCurrentReferenceCyclePosition()) {
      return goToReferenceByIndex(sharedReferenceCycle.index + 1)
    }

    const result = await requestTinymistReferences(
      filePath,
      offsetToTinymistPosition(view.state, view.state.selection.main.head),
      { includeDeclaration: false },
    )
    const locations = normalizeTinymistLocations(result)
    if (locations.length === 0) {
      clearReferenceCycle()
      toastStore.show(t('No references found.'), { type: 'info', duration: 2500 })
      return false
    }

    sharedReferenceCycle.items = locations
    sharedReferenceCycle.index = -1
    return goToReferenceByIndex(0)
  }

  async function renameSymbolAtCursor() {
    const view = getView()
    if (!view || !ensureTinymistReady()) return false

    const position = view.state.selection.main.head
    const currentName = getRenameCandidate(view.state, position)
    const nextName = window.prompt(
      t('Rename symbol to:'),
      currentName,
    )

    if (nextName == null) return false
    const trimmedName = nextName.trim()
    if (!trimmedName || trimmedName === currentName) return false

    const workspaceEdit = await requestTinymistRename(
      filePath,
      offsetToTinymistPosition(view.state, position),
      trimmedName,
    )
    const applied = await applyTinymistWorkspaceEdit(workspaceEdit, {
      filesStore,
      editorStore,
    })

    if (applied.totalFiles === 0) {
      toastStore.show(
        t('Rename could not be applied at the current cursor location.'),
        { type: 'warning', duration: 3500 },
      )
      return false
    }

    clearReferenceCycle()

    if (applied.skippedFiles.length > 0) {
      toastStore.show(
        t('Renamed {count} file(s), but skipped {skipped}.', {
          count: applied.appliedFiles.length,
          skipped: applied.skippedFiles.map((value) => value.split('/').pop() || value).join(', '),
        }),
        { type: 'warning', duration: 5000 },
      )
      return true
    }

    toastStore.show(
      t('Renamed {count} file(s).', { count: applied.appliedFiles.length }),
      { type: 'success', duration: 2600 },
    )
    return true
  }

  function handleNavigationSelectionChange() {
    if (tinymistNavUi.jumpInFlight) return
    clearReferenceCycle()
  }

  function buildDefinitionKeymap() {
    return [
      {
        key: 'F12',
        run: () => {
          void goToDefinitionFromCursor()
          return true
        },
      },
      {
        key: 'Shift-F12',
        run: () => {
          void findReferencesFromCursor()
          return true
        },
      },
      {
        key: 'F2',
        run: () => {
          void renameSymbolAtCursor()
          return true
        },
      },
    ]
  }

  return {
    buildDefinitionKeymap,
    handleDefinitionClick,
    handleNavigationSelectionChange,
    renameSymbolAtCursor,
    tinymistNavUi,
  }
}
