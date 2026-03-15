import { useCommentsStore } from '../stores/comments'

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getLineNumber(content, position) {
  if (typeof content !== 'string' || !content) return '?'
  const offset = Number.isFinite(position)
    ? Math.max(0, Math.min(position, content.length))
    : 0
  return content.substring(0, offset).split('\n').length
}

export function buildDocumentCommentsBlock(comments, content = '', options = {}) {
  const {
    includeReplies = false,
    includeAnchorText = false,
    escapeText = false,
  } = options

  if (!Array.isArray(comments) || comments.length === 0) return ''

  let block = '\n\n<document-comments>\n'
  for (const comment of comments) {
    const attrs = [
      `id="${escapeXml(comment.id)}"`,
      `line="${getLineNumber(content, Number(comment?.range?.from))}"`,
      `author="${escapeXml(comment.author)}"`,
    ]
    if (includeAnchorText) {
      attrs.push(`anchor-text="${escapeXml(comment.anchorText)}"`)
    }

    block += `  <comment ${attrs.join(' ')}>`
    block += escapeText ? escapeXml(comment.text) : (comment.text || '')

    if (includeReplies) {
      for (const reply of comment.replies || []) {
        const replyText = escapeText ? escapeXml(reply.text) : (reply.text || '')
        block += `\n    <reply author="${escapeXml(reply.author)}">${replyText}</reply>`
      }
    }

    block += '</comment>\n'
  }
  block += '</document-comments>'
  return block
}

export function appendDocumentComments(content, comments, options = {}) {
  if (typeof content !== 'string') return content
  if (content.includes('<document-comments>')) return content

  const block = buildDocumentCommentsBlock(comments, content, options)
  return block ? content + block : content
}

export function appendUnresolvedCommentsToContent(filePath, content, options = {}) {
  const commentsStore = useCommentsStore()
  return appendDocumentComments(content, commentsStore.unresolvedForFile(filePath), options)
}
