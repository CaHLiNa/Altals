import { invoke } from '@tauri-apps/api/core'
import { relativePath } from '../utils/fileTypes'
import { extractPrimaryArtifact, htmlTableToMarkdown, serializeResultProvenanceComment } from './resultProvenance'

function fileBasename(path = '') {
  return String(path || '').split('/').pop() || ''
}

function fileDirname(path = '') {
  const value = String(path || '')
  const slash = value.lastIndexOf('/')
  return slash > 0 ? value.slice(0, slash) : '.'
}

function fileStem(path = '') {
  const name = fileBasename(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function escapeMarkdownAlt(text = '') {
  return String(text || '').replace(/[\[\]]/g, '')
}

function targetMode(path = '') {
  if (/\.te?x$/i.test(path) || /\.latex$/i.test(path)) return 'latex'
  if (/\.typ$/i.test(path)) return 'typst'
  return 'markdown'
}

function scalarSnippet(content = '', mode = 'markdown') {
  if (mode !== 'markdown') {
    return `Result: ${String(content || '').trim()}`
  }
  return `**Result:** \`${String(content || '').trim()}\``
}

function textSnippet(content = '', mode = 'markdown') {
  const value = String(content || '').trim()
  if (!value) return ''
  if (mode !== 'markdown') return value
  if (value.includes('\n')) {
    return ['```text', value, '```'].join('\n')
  }
  return value
}

async function ensureAssetDirectory(targetPath) {
  const assetDir = `${fileDirname(targetPath)}/.altals-results/${fileStem(targetPath)}`
  await invoke('create_dir', { path: assetDir })
  return assetDir
}

async function materializeImageArtifact(targetPath, artifact, provenance = {}) {
  const assetDir = await ensureAssetDirectory(targetPath)
  const timestamp = Date.now()
  const producer = String(provenance.producerId || provenance.producerLabel || 'result').replace(/[^\w.-]+/g, '-')
  const filename = `${producer || 'result'}-${timestamp}.${artifact.extension || 'png'}`
  const assetPath = `${assetDir}/${filename}`

  if (artifact.mimeType === 'image/svg+xml') {
    await invoke('write_file', { path: assetPath, content: artifact.content || '' })
  } else {
    await invoke('write_file_base64', { path: assetPath, data: String(artifact.content || '').replace(/\s/g, '') })
  }

  return {
    assetPath,
    relativeAssetPath: relativePath(targetPath, assetPath),
  }
}

export async function buildExecutionResultSnippet(targetPath, outputs = [], provenance = {}) {
  const artifact = extractPrimaryArtifact(outputs)
  if (!artifact) {
    return {
      ok: false,
      reason: 'no-artifact',
    }
  }

  const mode = targetMode(targetPath)
  let body = ''
  if (artifact.kind === 'image') {
    const image = await materializeImageArtifact(targetPath, artifact, provenance)
    const alt = escapeMarkdownAlt(provenance.producerLabel || 'Generated result')
    if (mode === 'latex') {
      body = ['\\begin{figure}[htbp]', '\\centering', `\\includegraphics[width=\\linewidth]{${image.relativeAssetPath}}`, '\\end{figure}'].join('\n')
    } else if (mode === 'typst') {
      body = `#image("${image.relativeAssetPath}", width: 100%)`
    } else {
      body = `![${alt}](${image.relativeAssetPath})`
    }
  } else if (artifact.kind === 'table') {
    body = textSnippet(htmlTableToMarkdown(artifact.content), mode)
  } else if (artifact.kind === 'scalar') {
    body = scalarSnippet(artifact.content, mode)
  } else {
    body = textSnippet(artifact.content, mode)
  }

  const provenanceComment = serializeResultProvenanceComment({
    ...provenance,
    targetFile: targetPath,
  })
  const snippet = `\n\n${body}\n\n${provenanceComment}\n\n`

  return {
    ok: true,
    artifact,
    snippet,
  }
}
