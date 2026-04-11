import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import rehypeHighlight from 'rehype-highlight'
import DOMPurify from 'dompurify'
import { visit } from 'unist-util-visit'

const SOURCE_POSITION_NODE_TYPES = new Set([
  'heading',
  'paragraph',
  'blockquote',
  'code',
  'math',
  'list',
  'listItem',
  'table',
  'tableRow',
  'tableCell',
  'thematicBreak',
  'footnoteDefinition',
])

function remarkSourceAnchors() {
  return (tree) => {
    visit(tree, (node) => {
      if (!SOURCE_POSITION_NODE_TYPES.has(node?.type)) return

      const start = node.position?.start
      const end = node.position?.end
      if (!start || !end) return

      const data = node.data || (node.data = {})
      const existing = data.hProperties || {}
      const classNames = Array.isArray(existing.className)
        ? [...existing.className]
        : [existing.className].filter(Boolean)

      if (!classNames.includes('md-preview-source-anchor')) {
        classNames.push('md-preview-source-anchor')
      }

      data.hProperties = {
        ...existing,
        className: classNames,
        'data-source-kind': String(node.type || ''),
        'data-source-start-line': Number(start.line || 0),
        'data-source-end-line': Number(end.line || 0),
        'data-source-start-offset': Number(start.offset || 0),
        'data-source-end-offset': Number(end.offset || 0),
      }
    })
  }
}

const markdownPreviewProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkSourceAnchors)
  .use(remarkRehype)
  .use(rehypeKatex)
  .use(rehypeHighlight, { detect: true, ignoreMissing: true })
  .use(rehypeStringify)

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g
const SKIP_PARENT_TAGS = new Set(['A', 'CODE', 'PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'])

function parseWikiLink(raw = '') {
  let target = String(raw || '')
  let display = null
  let heading = null

  const pipeIdx = target.indexOf('|')
  if (pipeIdx !== -1) {
    display = target.slice(pipeIdx + 1).trim()
    target = target.slice(0, pipeIdx)
  }

  const hashIdx = target.indexOf('#')
  if (hashIdx !== -1) {
    heading = target.slice(hashIdx + 1).trim()
    target = target.slice(0, hashIdx)
  }

  return {
    target: target.trim(),
    display: display || null,
    heading: heading || null,
  }
}

function createWikiLinkNode(document, raw = '') {
  const parsed = parseWikiLink(raw)
  const anchor = document.createElement('a')
  anchor.className = 'md-preview-wikilink'
  anchor.dataset.target = parsed.target
  if (parsed.heading) {
    anchor.dataset.heading = parsed.heading
  }
  anchor.textContent = parsed.display || parsed.target
  return anchor
}

function candidateFromMatch(type, match, cursor) {
  if (!match) return null
  if (type === 'wiki') {
    return {
      type,
      start: cursor + match.index,
      end: cursor + match.index + match[0].length,
      raw: match[1],
      matchedText: match[0],
    }
  }
  return null
}

function nextInlineDraftToken(text = '', cursor = 0) {
  const remaining = text.slice(cursor)
  if (!remaining) return null

  WIKI_LINK_RE.lastIndex = 0

  const candidates = [
    candidateFromMatch('wiki', WIKI_LINK_RE.exec(remaining), cursor),
  ].filter(Boolean)

  if (candidates.length === 0) return null
  candidates.sort((a, b) => a.start - b.start || a.end - b.end)
  return candidates[0]
}

function shouldSkipTextNode(node) {
  let parent = node.parentElement
  while (parent) {
    if (SKIP_PARENT_TAGS.has(parent.tagName)) return true
    if (parent.classList?.contains('md-preview-wikilink')) return true
    parent = parent.parentElement
  }
  return false
}

function decorateInlineDraftSyntax(root) {
  const document = root.ownerDocument
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes = []

  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode)
    currentNode = walker.nextNode()
  }

  for (const node of textNodes) {
    const text = node.nodeValue || ''
    if (!text.trim()) continue
    if (shouldSkipTextNode(node)) continue

    const parts = []
    let cursor = 0
    let changed = false

    while (cursor < text.length) {
      const token = nextInlineDraftToken(text, cursor)
      if (!token) {
        parts.push(document.createTextNode(text.slice(cursor)))
        break
      }

      if (token.start > cursor) {
        parts.push(document.createTextNode(text.slice(cursor, token.start)))
      }

      if (token.type === 'wiki') {
        parts.push(createWikiLinkNode(document, token.raw))
        changed = true
      } else {
        parts.push(document.createTextNode(text.slice(token.start, token.end)))
      }

      cursor = token.end
    }

    if (!changed) continue

    const fragment = document.createDocumentFragment()
    for (const part of parts) {
      fragment.appendChild(part)
    }
    node.parentNode?.replaceChild(fragment, node)
  }
}

function sanitize(html = '') {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['semantics', 'annotation', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'munder', 'mover', 'munderover', 'mtable', 'mtr', 'mtd', 'mtext', 'mspace', 'math', 'menclose', 'msqrt', 'mroot', 'mpadded', 'mphantom', 'mstyle'],
    ADD_ATTR: ['data-target', 'data-heading', 'data-source-kind', 'data-source-start-line', 'data-source-end-line', 'data-source-start-offset', 'data-source-end-offset', 'mathvariant', 'encoding', 'xmlns', 'display', 'accent', 'accentunder', 'columnalign', 'columnlines', 'columnspacing', 'rowspacing', 'rowlines', 'frame', 'separator', 'stretchy', 'symmetric', 'movablelimits', 'fence', 'lspace', 'rspace', 'linethickness', 'scriptlevel'],
  })
}
export async function renderMarkdownDraftPreview(md) {
  const processed = await markdownPreviewProcessor.process(String(md || ''))
  const parser = new DOMParser()
  const document = parser.parseFromString(`<body>${String(processed)}</body>`, 'text/html')
  const root = document.body

  decorateInlineDraftSyntax(root)

  return sanitize(root.innerHTML)
}
