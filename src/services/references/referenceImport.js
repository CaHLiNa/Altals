import { invoke } from '@tauri-apps/api/core'

function requireTauriInvoke() {
  if (typeof window === 'undefined' || typeof window.__TAURI_INTERNALS__?.invoke !== 'function') {
    throw new Error('Tauri invoke is required for reference import.')
  }
}

export async function parseBibTeXText(content = '') {
  requireTauriInvoke()
  const parsed = await invoke('references_import_parse_text', {
    params: {
      content,
      format: 'bibtex',
    },
  })
  return Array.isArray(parsed) ? parsed : []
}

export async function parseRisText(content = '') {
  requireTauriInvoke()
  const parsed = await invoke('references_import_parse_text', {
    params: {
      content,
      format: 'ris',
    },
  })
  return Array.isArray(parsed) ? parsed : []
}

export async function parseCSLJSONText(content = '') {
  requireTauriInvoke()
  const parsed = await invoke('references_import_parse_text', {
    params: {
      content,
      format: 'csl-json',
    },
  })
  return Array.isArray(parsed) ? parsed : []
}

export async function detectReferenceImportFormat(content = '') {
  requireTauriInvoke()
  return invoke('references_import_detect_format', {
    params: {
      content,
    },
  })
}

export async function parseReferenceImportText(content = '', format = 'auto') {
  requireTauriInvoke()
  const parsed = await invoke('references_import_parse_text', {
    params: {
      content,
      format,
    },
  })
  return Array.isArray(parsed) ? parsed : []
}

export async function importReferencesFromText(content = '') {
  const trimmed = String(content || '').trim()
  if (!trimmed) return []
  const imported = await invoke('references_import_from_text', {
    params: {
      content: trimmed,
      format: 'auto',
    },
  })
  return Array.isArray(imported) ? imported : []
}

export async function importReferenceFromPdf(filePath = '') {
  requireTauriInvoke()
  const imported = await invoke('references_import_pdf', {
    params: {
      filePath,
    },
  })
  return imported && typeof imported === 'object' ? imported : null
}

export async function findDuplicateReference(existing = [], candidate = {}) {
  requireTauriInvoke()
  const duplicate = await invoke('references_find_duplicate', {
    params: {
      existing,
      candidate,
    },
  })
  return duplicate && typeof duplicate === 'object' ? duplicate : null
}

export async function mergeImportedReferences(existing = [], imported = []) {
  requireTauriInvoke()
  const merged = await invoke('references_merge_imported', {
    params: {
      existing,
      imported,
    },
  })
  return Array.isArray(merged) ? merged : []
}
