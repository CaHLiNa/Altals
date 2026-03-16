import { EditorSelection } from '@codemirror/state'

export const EDITOR_INPUT_ATTRIBUTES = Object.freeze({
  autocomplete: 'off',
  autocapitalize: 'off',
  autocorrect: 'off',
  spellcheck: 'false',
})

export function buildEditorInputAttributes() {
  return { ...EDITOR_INPUT_ATTRIBUTES }
}

function cloneSelection(selection) {
  return EditorSelection.create(
    selection.ranges.map((range) => EditorSelection.range(range.anchor, range.head)),
    selection.mainIndex,
  )
}

export function captureContextMenuState(state, pos) {
  const selection = cloneSelection(state.selection)
  const hasSelection = selection.ranges.some((range) => !range.empty)
  const clickPos = typeof pos === 'number' ? pos : null
  const clickedInsideSelection = clickPos !== null
    && selection.ranges.some((range) => range.from <= clickPos && clickPos <= range.to)

  return {
    selection,
    hasSelection,
    clickPos,
    clickedInsideSelection,
  }
}

export function resolveContextMenuSelection(contextMenuState) {
  const selection = contextMenuState?.selection || null
  const hasSelection = contextMenuState?.hasSelection === true
  const clickPos = typeof contextMenuState?.clickPos === 'number' ? contextMenuState.clickPos : null

  if (!selection) {
    return {
      hasSelection: false,
      nextSelection: null,
    }
  }

  if (contextMenuState.clickedInsideSelection) {
    return {
      hasSelection,
      nextSelection: hasSelection ? selection : null,
    }
  }

  if (clickPos === null) {
    return {
      hasSelection,
      nextSelection: hasSelection ? selection : null,
    }
  }

  if (selection.ranges.length === 1 && selection.main.from === clickPos && selection.main.to === clickPos) {
    return {
      hasSelection: false,
      nextSelection: null,
    }
  }

  return {
    hasSelection: false,
    nextSelection: EditorSelection.create([EditorSelection.cursor(clickPos)]),
  }
}
