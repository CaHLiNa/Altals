import { invoke } from '@tauri-apps/api/core'

export async function extractMarkdownHeadingItems(content = '') {
  return invoke('markdown_extract_headings', {
    content: String(content || ''),
  })
}
