/** Extract cursor context for ghost suggestions */
export function extractCursorContext(state, maxBefore = 5000, maxAfter = 1000) {
  const { from } = state.selection
  const before = state.doc.textBetween(0, from, '\n', ' ')
  const after = state.doc.textBetween(from, state.doc.content.size, '\n', ' ')
  return { before: before.slice(-maxBefore), after: after.slice(0, maxAfter), pos: from }
}

/** Full document text for AI (chat tools, @file refs).
 * Walks the doc manually to skip text nodes with trackDelete marks (pending
 * tracked-change deletions). Including them causes the AI to see both old and
 * new text concatenated, leading to cascading garbled edits. */
export function extractDocumentText(state) {
  const parts = []
  state.doc.descendants((node) => {
    if (node.isText) {
      if (!node.marks.some(m => m.type.name === 'trackDelete')) parts.push(node.text)
      return false
    }
    if (node.isBlock && parts.length && parts[parts.length - 1] !== '\n') parts.push('\n')
    return true
  })
  return parts.join('')
}

/** Numbered block list for DOCX AI editing.
 * Returns one entry per non-empty paragraph/heading, in document order.
 * The `num` field (1-indexed) is stable within a single read — use it as
 * the address in edit_file's paragraph_number param. */
export function extractBlockList(state) {
  const blocks = []
  state.doc.descendants((node) => {
    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      const text = node.textContent.trim()
      if (text) blocks.push({ num: blocks.length + 1, node, text })
      return false
    }
    return true
  })
  return blocks
}

/** Selected text */
export function extractSelection(state) {
  const { from, to, empty } = state.selection
  if (empty) return { text: '', from, to }
  return { text: state.doc.textBetween(from, to, '\n', ' '), from, to }
}

/**
 * Find exact text in a ProseMirror doc and return { from, to } positions.
 * Searches textblock by textblock — handles inline marks correctly.
 */
export function findTextInPmDoc(doc, searchText) {
  let result = null
  doc.descendants((node, pos) => {
    if (result) return false
    if (node.isTextblock) {
      const blockText = node.textContent
      const idx = blockText.indexOf(searchText)
      if (idx !== -1) {
        // pos+1 = start of block content; marks don't affect positions
        result = { from: pos + 1 + idx, to: pos + 1 + idx + searchText.length }
        return false
      }
    }
  })
  return result
}
