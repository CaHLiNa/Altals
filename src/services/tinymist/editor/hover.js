import { hoverTooltip } from '@codemirror/view'
import { requestTinymistHover } from '../session.js'
import {
  offsetToTinymistPosition,
  tinymistRangeToOffsets,
} from '../textEdits.js'
import { renderMarkdown } from '../../../utils/chatMarkdown.js'

function normalizeHoverText(contents) {
  if (!contents) return ''
  if (typeof contents === 'string') return contents
  if (Array.isArray(contents)) {
    return contents
      .map(item => normalizeHoverText(item))
      .filter(Boolean)
      .join('\n\n')
  }
  if (typeof contents.value === 'string') return contents.value
  if (typeof contents.language === 'string' && typeof contents.value === 'string') {
    return `\`\`\`${contents.language}\n${contents.value}\n\`\`\``
  }
  return ''
}

function compactHoverText(text) {
  const source = String(text || '').trim()
  if (!source) return ''

  const lines = source.split(/\r?\n/)
  const cutAt = lines.findIndex((line, index) => {
    if (index === 0) return false
    return /^(#{1,6}\s*)?(examples?|example|see also)\b/i.test(line.trim())
  })
  const trimmed = cutAt > 0 ? lines.slice(0, cutAt).join('\n') : source

  const blocks = trimmed
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)

  if (blocks.length === 0) return ''

  const kept = []
  let proseCount = 0
  let truncated = cutAt > 0

  for (const block of blocks) {
    const isCodeFence = /^```/.test(block)
    if (isCodeFence) {
      if (kept.length === 0) {
        kept.push(block)
      } else {
        truncated = true
      }
      continue
    }

    if (/^(#{1,6}\s*)?[A-Z][A-Za-z0-9 _-]{0,32}$/.test(block) && block.length < 40) {
      truncated = true
      break
    }

    if (proseCount < 2) {
      kept.push(block)
      proseCount += 1
    } else {
      truncated = true
      break
    }
  }

  const compact = kept.join('\n\n').trim()
  if (!compact) return ''
  return truncated ? `${compact}\n\n...` : compact
}

function createHoverDom(text) {
  const dom = document.createElement('div')
  dom.className = 'cm-tinymist-hover__body'
  const rendered = renderMarkdown(compactHoverText(text))

  if (rendered) {
    dom.innerHTML = rendered
  } else {
    dom.textContent = compactHoverText(text)
  }

  return dom
}

export function createTinymistTypstHoverExtension(options = {}) {
  const { filePath } = options
  if (!filePath) return []

  return [
    hoverTooltip(async (view, pos) => {
      const result = await requestTinymistHover(filePath, offsetToTinymistPosition(view.state, pos))
      if (!result) return null

      const text = normalizeHoverText(result.contents)
      if (!text.trim()) return null

      const offsets = tinymistRangeToOffsets(view.state, result.range || null)
      return {
        pos: offsets?.from ?? pos,
        end: offsets?.to ?? pos,
        above: false,
        clip: false,
        class: 'cm-tinymist-hover',
        create() {
          const dom = createHoverDom(text)
          return { dom }
        },
      }
    }, {
      hoverTime: 250,
      hideOnChange: 'touch',
    }),
  ]
}
