import { invoke } from '@tauri-apps/api/core'

export async function storeReferencePdf(globalConfigDir = '', reference = {}, sourcePath = '') {
  const normalizedSource = String(sourcePath || '').trim()
  if (!globalConfigDir || !normalizedSource) return reference

  return invoke('references_asset_store', {
    params: {
      globalConfigDir,
      reference,
      sourcePath: normalizedSource,
    },
  })
}

export async function migrateReferenceAssets(globalConfigDir = '', references = []) {
  if (!globalConfigDir || !Array.isArray(references) || references.length === 0) return references
  const migrated = await invoke('references_assets_migrate', {
    params: {
      globalConfigDir,
      references,
    },
  })
  return Array.isArray(migrated) ? migrated : references
}
