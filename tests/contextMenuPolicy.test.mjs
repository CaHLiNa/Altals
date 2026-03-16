import test from 'node:test'
import assert from 'node:assert/strict'

import { EditorState, EditorSelection } from '@codemirror/state'

import {
  buildEditorInputAttributes,
  captureContextMenuState,
  normalizeContextMenuClickPos,
  resolveContextMenuSelection,
} from '../src/editor/contextMenuPolicy.js'

test('disables browser-native text services on the editor input surface', () => {
  assert.deepEqual(buildEditorInputAttributes(), {
    autocomplete: 'off',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
  })
})

test('preserves the current selection when right-clicking inside it', () => {
  const state = EditorState.create({
    doc: 'hello world',
    selection: EditorSelection.range(0, 5),
  })

  const result = resolveContextMenuSelection(captureContextMenuState(state, 3))

  assert.equal(result.hasSelection, true)
  assert.equal(result.nextSelection.main.from, 0)
  assert.equal(result.nextSelection.main.to, 5)
})

test('collapses the selection to a caret when right-clicking outside it', () => {
  const state = EditorState.create({
    doc: 'hello world',
    selection: EditorSelection.range(0, 5),
  })

  const result = resolveContextMenuSelection(captureContextMenuState(state, 8))

  assert.equal(result.hasSelection, false)
  assert.equal(result.nextSelection.main.from, 8)
  assert.equal(result.nextSelection.main.to, 8)
})

test('moves the caret when there is no selection and the click is elsewhere', () => {
  const state = EditorState.create({
    doc: 'hello world',
    selection: EditorSelection.cursor(1),
  })

  const result = resolveContextMenuSelection(captureContextMenuState(state, 7))

  assert.equal(result.hasSelection, false)
  assert.equal(result.nextSelection.main.from, 7)
  assert.equal(result.nextSelection.main.to, 7)
})

test('preserves the caret snapshot when right-clicking at the caret position', () => {
  const state = EditorState.create({
    doc: 'hello\n\nworld',
    selection: EditorSelection.cursor(6),
  })

  const result = resolveContextMenuSelection(captureContextMenuState(state, 6))

  assert.equal(result.hasSelection, false)
  assert.equal(result.nextSelection.main.from, 6)
  assert.equal(result.nextSelection.main.to, 6)
})

test('preserves the caret snapshot when click position is unavailable', () => {
  const state = EditorState.create({
    doc: 'hello\n\nworld',
    selection: EditorSelection.cursor(6),
  })

  const result = resolveContextMenuSelection(captureContextMenuState(state, null))

  assert.equal(result.hasSelection, false)
  assert.equal(result.nextSelection.main.from, 6)
  assert.equal(result.nextSelection.main.to, 6)
})

test('preserves the pre-right-click selection snapshot even if the live state changes later', () => {
  const originalState = EditorState.create({
    doc: 'hello world',
    selection: EditorSelection.range(0, 5),
  })
  const snapshot = captureContextMenuState(originalState, 3)

  const mutatedLiveState = EditorState.create({
    doc: 'hello world',
    selection: EditorSelection.cursor(8),
  })
  assert.equal(mutatedLiveState.selection.main.from, 8)

  const result = resolveContextMenuSelection(snapshot)

  assert.equal(result.hasSelection, true)
  assert.equal(result.nextSelection.main.from, 0)
  assert.equal(result.nextSelection.main.to, 5)
})

test('clamps context-menu click positions to the clicked visual line range', () => {
  assert.equal(normalizeContextMenuClickPos(18, { from: 12, to: 12 }), 12)
  assert.equal(normalizeContextMenuClickPos(18, { from: 12, to: 16 }), 16)
  assert.equal(normalizeContextMenuClickPos(8, { from: 12, to: 16 }), 12)
  assert.equal(normalizeContextMenuClickPos(14, { from: 12, to: 16 }), 14)
})
