import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import DOMPurify from 'dompurify'
import { visit } from 'unist-util-visit'
import { rehypePreviewHighlight } from './highlight.js'
import { decorateInlineDraftSyntax } from './inlineDraftSyntax.js'

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
  .use(rehypePreviewHighlight)
  .use(rehypeStringify)

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
