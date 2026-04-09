export async function renderPreview(...args) {
  const { renderMarkdownDraftPreview } = await import('../services/markdown/preview.js')
  return renderMarkdownDraftPreview(...args)
}
