import { marked } from 'marked'
import DOMPurify from 'dompurify'

const renderer = new marked.Renderer()

renderer.code = function ({ text, lang }) {
  const label = lang ? `<span class="chat-code-lang">${lang}</span>` : ''
  return `<pre class="chat-code-block">${label}<code>${text}</code></pre>`
}

renderer.link = function ({ href, text }) {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`
}

marked.setOptions({
  renderer,
  gfm: true,
  breaks: true,
})

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'IMG') {
    const src = node.getAttribute('src') || ''
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      node.remove()
    }
  }
})

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
    'div', 'span', 'button', 'svg', 'rect', 'path', 'img',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'class', 'title',
    'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width',
    'x', 'y', 'rx', 'd', 'src', 'alt',
  ],
  ALLOW_DATA_ATTR: false,
}

export function renderMarkdown(content) {
  if (!content) return ''
  const text = String(content)
    .replace(/<file-ref[\s\S]*?<\/file-ref>/g, '')
    .replace(/<context[\s\S]*?<\/context>/g, '')
    .replace(/<selection[\s\S]*?<\/selection>/g, '')
    .trim()
  if (!text) return ''
  const html = marked.parse(text)
  return DOMPurify.sanitize(html, PURIFY_CONFIG)
}
