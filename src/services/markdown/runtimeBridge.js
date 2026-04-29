import { invoke } from '@tauri-apps/api/core'

export async function extractMarkdownHeadingItems(content = '') {
  return invoke('markdown_extract_headings', {
    content: String(content || ''),
  })
}

export async function extractMarkdownDraftProblems(content = '', sourcePath = '') {
  return invoke('markdown_extract_diagnostics', {
    content: String(content || ''),
    sourcePath: String(sourcePath || ''),
  })
}

export async function extractMarkdownWikiLinks(content = '') {
  const links = await invoke('markdown_extract_wiki_links', {
    content: String(content || ''),
  })
  return Array.isArray(links) ? links : []
}
