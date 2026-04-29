import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import DOMPurify from 'dompurify'
import { createLowlight } from 'lowlight'
import { visit } from 'unist-util-visit'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import latex from 'highlight.js/lib/languages/latex'
import markdown from 'highlight.js/lib/languages/markdown'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import shell from 'highlight.js/lib/languages/shell'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'

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
const markdownPreviewLanguages = {
  bash,
  css,
  javascript,
  json,
  latex,
  markdown,
  python,
  rust,
  shell,
  typescript,
  xml,
}
const markdownPreviewLanguageNames = Object.keys(markdownPreviewLanguages)
const markdownPreviewHighlighter = createLowlight(markdownPreviewLanguages)

markdownPreviewHighlighter.registerAlias({
  bash: ['sh', 'zsh'],
  javascript: ['js', 'jsx'],
  latex: ['tex'],
  markdown: ['md'],
  shell: ['console', 'terminal'],
  typescript: ['ts', 'tsx'],
  xml: ['html', 'svg', 'vue'],
})

function textFromHastNode(node) {
  if (!node) return ''
  if (typeof node.value === 'string') return node.value
  if (!Array.isArray(node.children)) return ''
  return node.children.map((child) => textFromHastNode(child)).join('')
}

function codeLanguage(node) {
  const classNames = Array.isArray(node?.properties?.className)
    ? node.properties.className
    : []

  for (const className of classNames) {
    const value = String(className || '')
    if (value === 'no-highlight' || value === 'nohighlight') return false
    if (value.startsWith('language-')) return value.slice(9)
    if (value.startsWith('lang-')) return value.slice(5)
  }

  return undefined
}

function rehypePreviewHighlight() {
  return (tree) => {
    visit(tree, 'element', (node, _, parent) => {
      if (
        node?.tagName !== 'code' ||
        parent?.type !== 'element' ||
        parent?.tagName !== 'pre'
      ) {
        return
      }

      const language = codeLanguage(node)
      if (language === false) return

      let result = null
      const text = textFromHastNode(node)
      try {
        result = language && markdownPreviewHighlighter.registered(language)
          ? markdownPreviewHighlighter.highlight(language, text)
          : markdownPreviewHighlighter.highlightAuto(text, { subset: markdownPreviewLanguageNames })
      } catch {
        return
      }

      if (!Array.isArray(node.properties.className)) {
        node.properties.className = []
      }
      if (!node.properties.className.includes('hljs')) {
        node.properties.className.unshift('hljs')
      }
      if (!language && result?.data?.language) {
        node.properties.className.push(`language-${result.data.language}`)
      }
      if (Array.isArray(result?.children) && result.children.length > 0) {
        node.children = result.children
      }
    })
  }
}

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
  .use(rehypePreviewHighlight)
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
