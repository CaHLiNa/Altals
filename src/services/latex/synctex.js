import { workspacePathExists } from '../pathExists.js'
import { resolveLatexExistingSynctex } from './runtime.js'

export function buildLatexSynctexCandidates(pdfPath = '') {
  const normalizedPdfPath = String(pdfPath || '').trim()
  if (!normalizedPdfPath.toLowerCase().endsWith('.pdf')) return []
  const basePath = normalizedPdfPath.slice(0, -4)
  return [
    `${basePath}.synctex.gz`,
    `${basePath}.synctex`,
  ]
}

export async function resolveExistingLatexSynctexPath(pdfPath = '') {
  const resolved = await resolveLatexExistingSynctex({ pdfPath }).catch(() => null)
  const resolvedPath = String(resolved?.path || '').trim()
  if (resolvedPath) return resolvedPath

  const candidates = buildLatexSynctexCandidates(pdfPath)
  for (const candidate of candidates) {
    if (await workspacePathExists(candidate)) {
      return candidate
    }
  }
  return ''
}
