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

export function rehypePreviewHighlight() {
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
