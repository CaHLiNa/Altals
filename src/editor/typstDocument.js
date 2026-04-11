const LABEL_RE = /<([A-Za-z][\w:-]*)>/g
const HEADING_RE = /^(={1,6})\s+(.+)$/gm
const STRUCTURE_RE = /#(figure|table)\s*\(/g
const BIBLIOGRAPHY_RE = /#bibliography\s*\(/g
const REFERENCE_RE = /(^|[^\w])@([A-Za-z][\w:-]*)/gm

function buildLineOffsets(text = '') {
  const offsets = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') offsets.push(index + 1)
  }
  return offsets
}

function offsetToLine(lineOffsets = [], offset = 0) {
  let low = 0
  let high = lineOffsets.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    if (lineOffsets[mid] <= offset) low = mid + 1
    else high = mid - 1
  }
  return Math.max(1, high + 1)
}

export function extractTypstLabels(text = '') {
  const labels = []
  const seen = new Set()
  for (const entry of extractTypstLabelEntries(text)) {
    const label = entry?.key
    if (!label || seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }

  return labels
}

export function buildTypstLabelSet(text = '') {
  return new Set(extractTypstLabels(text))
}

export function extractTypstLabelEntries(text = '') {
  const labels = []
  const source = String(text || '')
  const lineOffsets = buildLineOffsets(source)
  let match

  LABEL_RE.lastIndex = 0
  while ((match = LABEL_RE.exec(source)) !== null) {
    const key = match[1]
    if (!key) continue
    labels.push({
      key,
      offset: match.index,
      line: offsetToLine(lineOffsets, match.index),
      from: match.index,
      to: match.index + String(match[0] || '').length,
    })
  }

  return labels
}

export function extractTypstReferenceKeys(text = '') {
  const references = []
  const seen = new Set()

  for (const entry of extractTypstReferenceEntries(text)) {
    if (!entry?.key || seen.has(entry.key)) continue
    seen.add(entry.key)
    references.push(entry.key)
  }

  return references
}

export function extractTypstReferenceEntries(text = '') {
  const references = []
  const source = String(text || '')
  const lineOffsets = buildLineOffsets(source)
  let match

  REFERENCE_RE.lastIndex = 0
  while ((match = REFERENCE_RE.exec(source)) !== null) {
    const key = match[2]
    if (!key) continue
    references.push({
      key,
      offset: match.index + String(match[1] || '').length,
      line: offsetToLine(lineOffsets, match.index),
    })
  }

  return references
}

export function findTypstLabelTokenAtOffset(text = '', offset = -1) {
  const source = String(text || '')
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) return null

  let match
  REFERENCE_RE.lastIndex = 0
  while ((match = REFERENCE_RE.exec(source)) !== null) {
    const key = match[2]
    if (!key) continue
    const from = match.index + String(match[1] || '').length
    const to = from + 1 + key.length
    if (offset >= from && offset <= to) {
      return {
        kind: 'reference',
        key,
        from,
        to,
      }
    }
  }

  LABEL_RE.lastIndex = 0
  while ((match = LABEL_RE.exec(source)) !== null) {
    const key = match[1]
    if (!key) continue
    const from = match.index
    const to = from + String(match[0] || '').length
    if (offset >= from && offset <= to) {
      return {
        kind: 'label',
        key,
        from,
        to,
      }
    }
  }

  return null
}

function skipTypstString(text, start) {
  let index = start + 1
  while (index < text.length) {
    const char = text[index]
    if (char === '\\') {
      index += 2
      continue
    }
    if (char === '"') return index
    index += 1
  }
  return text.length - 1
}

function skipTypstLineComment(text, start) {
  let index = start + 2
  while (index < text.length && text[index] !== '\n') index += 1
  return index
}

function findMatchingDelimiter(text, openIndex, openChar, closeChar) {
  let depth = 0
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index]

    if (char === '"') {
      index = skipTypstString(text, index)
      continue
    }

    if (char === '/' && text[index + 1] === '/') {
      index = skipTypstLineComment(text, index)
      continue
    }

    if (char === openChar) {
      depth += 1
      continue
    }

    if (char === closeChar) {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function normalizeOutlineText(text = '') {
  return String(text)
    .replace(/#([A-Za-z][\w-]*)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTrailingLabel(text, startIndex) {
  let index = startIndex
  while (index < text.length && /\s/.test(text[index])) index += 1
  if (text[index] !== '<') return null

  const closeIndex = text.indexOf('>', index + 1)
  if (closeIndex === -1) return null

  const label = text.slice(index + 1, closeIndex).trim()
  if (!/^[A-Za-z][\w:-]*$/.test(label)) return null

  return {
    label,
    from: index,
    to: closeIndex + 1,
  }
}

function findCaptionStart(text) {
  const match = /\bcaption\s*:/.exec(text)
  if (!match) return -1
  return match.index + match[0].length
}

function extractCaptionText(text = '') {
  const captionStart = findCaptionStart(text)
  if (captionStart === -1) return ''

  let index = captionStart
  while (index < text.length && /\s/.test(text[index])) index += 1
  if (text[index] !== '[') return ''

  const closeIndex = findMatchingDelimiter(text, index, '[', ']')
  if (closeIndex === -1) return ''

  return normalizeOutlineText(text.slice(index + 1, closeIndex))
}

function extractNamedBracketText(text = '', name = '') {
  const pattern = new RegExp(`\\b${name}\\s*:`)
  const match = pattern.exec(text)
  if (!match) return ''

  let index = match.index + match[0].length
  while (index < text.length && /\s/.test(text[index])) index += 1

  if (text[index] === '[') {
    const closeIndex = findMatchingDelimiter(text, index, '[', ']')
    if (closeIndex === -1) return ''
    return normalizeOutlineText(text.slice(index + 1, closeIndex))
  }

  if (text[index] === '"') {
    const closeIndex = skipTypstString(text, index)
    if (closeIndex <= index) return ''
    return normalizeOutlineText(text.slice(index + 1, closeIndex))
  }

  return ''
}

function detectFigureContentKind(text = '') {
  let index = 0

  while (index < text.length) {
    const char = text[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (char === '/' && text[index + 1] === '/') {
      index = skipTypstLineComment(text, index)
      continue
    }
    break
  }

  if (text[index] === '#') index += 1
  const remainder = text.slice(index)
  return /^table\b\s*\(/.test(remainder) ? 'table' : 'figure'
}

function getTypstOutlineLevel(headings, offset) {
  let currentLevel = 0
  for (const heading of headings) {
    if (heading.offset > offset) break
    currentLevel = heading.level
  }
  return Math.min(currentLevel + 1, 6) || 1
}

function buildStructureText(kind, body, label) {
  if (label) return label
  const caption = extractCaptionText(body)
  if (caption) return caption
  return kind === 'table' ? 'Table' : 'Figure'
}

function buildBibliographyText(body, label) {
  const title = extractNamedBracketText(body, 'title')
  if (title) return title
  if (label) return label
  return 'Bibliography'
}

function isInsideConsumedLabel(index, consumedRanges) {
  return consumedRanges.some(range => index >= range.from && index < range.to)
}

export function parseTypstOutlineItems(text = '') {
  const source = String(text || '')
  const headings = []
  const structureItems = []
  const consumedLabelRanges = []

  HEADING_RE.lastIndex = 0
  let match
  while ((match = HEADING_RE.exec(source)) !== null) {
    headings.push({
      kind: 'heading',
      text: normalizeOutlineText(match[2]),
      level: match[1].length,
      offset: match.index,
    })
  }

  STRUCTURE_RE.lastIndex = 0
  while ((match = STRUCTURE_RE.exec(source)) !== null) {
    const openParenIndex = match.index + match[0].length - 1
    const closeParenIndex = findMatchingDelimiter(source, openParenIndex, '(', ')')
    if (closeParenIndex === -1) continue

    const body = source.slice(openParenIndex + 1, closeParenIndex)
    const trailingLabel = extractTrailingLabel(source, closeParenIndex + 1)
    const kind = match[1] === 'table' ? 'table' : detectFigureContentKind(body)

    if (trailingLabel) consumedLabelRanges.push({ from: trailingLabel.from, to: trailingLabel.to })

    structureItems.push({
      kind,
      text: buildStructureText(kind, body, trailingLabel?.label || ''),
      level: getTypstOutlineLevel(headings, match.index),
      offset: match.index,
      label: trailingLabel?.label || '',
    })

    STRUCTURE_RE.lastIndex = closeParenIndex + 1
  }

  BIBLIOGRAPHY_RE.lastIndex = 0
  while ((match = BIBLIOGRAPHY_RE.exec(source)) !== null) {
    const openParenIndex = match.index + match[0].length - 1
    const closeParenIndex = findMatchingDelimiter(source, openParenIndex, '(', ')')
    if (closeParenIndex === -1) continue

    const body = source.slice(openParenIndex + 1, closeParenIndex)
    const trailingLabel = extractTrailingLabel(source, closeParenIndex + 1)
    if (trailingLabel) consumedLabelRanges.push({ from: trailingLabel.from, to: trailingLabel.to })

    structureItems.push({
      kind: 'bibliography',
      text: buildBibliographyText(body, trailingLabel?.label || ''),
      level: 1,
      offset: match.index,
      label: trailingLabel?.label || '',
    })

    BIBLIOGRAPHY_RE.lastIndex = closeParenIndex + 1
  }

  LABEL_RE.lastIndex = 0
  while ((match = LABEL_RE.exec(source)) !== null) {
    if (isInsideConsumedLabel(match.index, consumedLabelRanges)) continue

    structureItems.push({
      kind: 'label',
      text: match[1],
      level: getTypstOutlineLevel(headings, match.index),
      offset: match.index,
      label: match[1],
    })
  }

  return [...headings, ...structureItems].sort((left, right) => left.offset - right.offset)
}

export function collectTypstReferenceOptions({
  documentText = '',
  projectLabels = [],
  query = '',
  limit = 12,
} = {}) {
  const normalizedQuery = String(query || '').trim().toLowerCase()
  const options = []
  const seen = new Set()
  const labelEntries = Array.isArray(projectLabels) && projectLabels.length > 0
    ? projectLabels
    : extractTypstLabels(documentText).map(label => ({ key: label }))

  for (const entry of labelEntries) {
    const label = typeof entry === 'string' ? entry : entry?.key
    if (!label) continue
    if (normalizedQuery && !label.toLowerCase().includes(normalizedQuery)) continue
    const insertText = `@${label}`
    options.push({
      label: insertText,
      detail: entry?.filePath ? 'Project label' : 'Document label',
      type: 'variable',
      apply: insertText,
    })
    seen.add(insertText)
    if (options.length >= limit) return options
  }

  return options
}
