import { tinymistUriToFilePath } from './session.js'

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function buildLineOffsets(text = '') {
  const offsets = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') {
      offsets.push(index + 1)
    }
  }
  return offsets
}

function positionToOffset(lineOffsets, textLength, position = {}) {
  const lineIndex = clamp(Number(position.line) || 0, 0, Math.max(0, lineOffsets.length - 1))
  const lineStart = lineOffsets[lineIndex] || 0
  const nextLineStart = lineOffsets[lineIndex + 1] ?? textLength
  const lineLength = Math.max(0, nextLineStart - lineStart)
  const character = clamp(Number(position.character) || 0, 0, lineLength)
  return Math.min(lineStart + character, textLength)
}

function mapOutlineKind(symbol = {}) {
  const name = String(symbol?.name || '').trim().toLowerCase()
  if (!name) return null
  if (name.startsWith('figure') || name.startsWith('fig.')) return 'figure'
  if (name.startsWith('table')) return 'table'
  if (name === 'bibliography' || name === 'references' || name === 'works cited') return 'bibliography'
  if (name.startsWith('equation') || name.startsWith('formula')) return 'equation'
  if (/^(eq|equation|formula|math)[:._-]/.test(name)) return 'equation'
  if (/^(fig|tbl|tab)[:._-]/.test(name)) return 'label'
  if (/^<[^>]+>$/.test(name)) return 'label'
  if (name.startsWith('label')) return 'label'
  return null
}

function normalizeSymbolRange(symbol = {}) {
  if (symbol?.selectionRange?.start) return symbol.selectionRange.start
  if (symbol?.range?.start) return symbol.range.start
  if (symbol?.location?.range?.start) return symbol.location.range.start
  return { line: 0, character: 0 }
}

function flattenDocumentSymbols(symbols = [], visitor, depth = 0) {
  for (const symbol of symbols) {
    visitor(symbol, depth)
    if (Array.isArray(symbol?.children) && symbol.children.length > 0) {
      flattenDocumentSymbols(symbol.children, visitor, depth + 1)
    }
  }
}

const WORKSPACE_SYMBOL_KIND_LABELS = {
  3: 'func',
  4: 'ctor',
  5: 'field',
  6: 'var',
  7: 'class',
  8: 'iface',
  10: 'prop',
  11: 'unit',
  12: 'val',
  13: 'enum',
  14: 'key',
  17: 'file',
  18: 'ref',
  20: 'key',
  21: 'const',
  22: 'struct',
  23: 'event',
  24: 'op',
  25: 'type',
  26: 'param',
}

function normalizeWorkspaceSymbolRange(symbol = {}) {
  return symbol?.location?.range || symbol?.range || null
}

export function normalizeTinymistWorkspaceSymbols(result = [], workspacePath = '') {
  const basePath = String(workspacePath || '')
  return (Array.isArray(result) ? result : [])
    .map((symbol) => {
      const filePath = tinymistUriToFilePath(
        symbol?.location?.uri || symbol?.uri || '',
      )
      const range = normalizeWorkspaceSymbolRange(symbol)
      const line = Number.isInteger(range?.start?.line) ? range.start.line + 1 : null
      const relativePath = basePath && filePath.startsWith(basePath)
        ? filePath.slice(basePath.length + 1)
        : filePath

      if (!filePath || !range?.start) return null

      return {
        name: String(symbol?.name || '').trim(),
        kind: Number(symbol?.kind) || null,
        kindLabel: WORKSPACE_SYMBOL_KIND_LABELS[symbol?.kind] || '',
        filePath,
        relativePath,
        range,
        line,
      }
    })
    .filter(symbol => symbol?.name && symbol?.filePath)
}

export function normalizeTinymistDocumentSymbols(documentText = '', symbols = []) {
  const text = String(documentText || '')
  const textLength = text.length
  const lineOffsets = buildLineOffsets(text)
  const items = []

  flattenDocumentSymbols(symbols, (symbol, depth) => {
    const name = String(symbol?.name || '').trim()
    if (!name) return
    const kind = mapOutlineKind(symbol)
    if (!kind) return

    const start = normalizeSymbolRange(symbol)
    items.push({
      kind,
      text: name,
      level: Math.max(1, depth + 1),
      offset: positionToOffset(lineOffsets, textLength, start),
    })
  })

  return items.sort((left, right) => left.offset - right.offset)
}
