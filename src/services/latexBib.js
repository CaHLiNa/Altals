import { invoke } from '@tauri-apps/api/core'
import { useReferencesStore } from '../stores/references'
import { planBibFileSync } from './latexBibliography.js'

async function readIfExists(path) {
  try {
    const exists = await invoke('path_exists', { path })
    if (!exists) return null
    return await invoke('read_file', { path })
  } catch {
    return null
  }
}

/**
 * Synchronize `references.bib` beside a source document.
 * LaTeX compile uses conditional syncing; Markdown PDF export can force it.
 *
 * @param {string} sourcePath
 * @param {{ sourceContent?: string, force?: boolean }} [options]
 * @returns {Promise<string|null>} Path to the synchronized .bib file, or null when sync is skipped.
 */
export async function ensureBibFile(sourcePath, options = {}) {
  const referencesStore = useReferencesStore()
  const sourceContent = options.sourceContent ?? await invoke('read_file', { path: sourcePath }).catch(() => '')

  const initialPlan = planBibFileSync({
    sourcePath,
    sourceContent,
    existingBibContent: null,
    referencesStore,
    force: options.force === true,
  })
  const existingBibContent = await readIfExists(initialPlan.bibPath)
  const plan = planBibFileSync({
    sourcePath,
    sourceContent,
    existingBibContent,
    referencesStore,
    force: options.force === true,
  })

  if (!plan.shouldSync) {
    return null
  }

  if (plan.shouldWrite) {
    await invoke('write_file', {
      path: plan.bibPath,
      content: plan.nextContent,
    })
  }

  return plan.bibPath
}
