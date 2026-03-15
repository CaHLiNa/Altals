import { invoke } from '@tauri-apps/api/core'
import { DEFAULT_PROJECT_INSTRUCTIONS } from '../constants/instructionsTemplate.js'

const DEFAULT_INSTRUCTIONS_TEMPLATE = DEFAULT_PROJECT_INSTRUCTIONS.replace(/\r\n/g, '\n').trim()

function normalizeFileContent(value = '') {
  return String(value).replace(/\r\n/g, '\n')
}

export function stripInstructionComments(raw = '') {
  return normalizeFileContent(raw).split('\n')
    .filter(line => !(line.trim().startsWith('<!--') && line.trim().endsWith('-->')))
    .join('\n')
    .trim()
}

export function isDefaultInstructionsTemplate(raw = '') {
  return normalizeFileContent(raw).trim() === DEFAULT_INSTRUCTIONS_TEMPLATE
}

export async function ensureInternalInstructionsFile(filePath, seedContent = DEFAULT_PROJECT_INSTRUCTIONS) {
  if (!filePath) return
  const exists = await invoke('path_exists', { path: filePath })
  if (exists) return

  await invoke('write_file', {
    path: filePath,
    content: seedContent,
  })
}

export async function migrateAutoInstructionsFile({
  rootPath,
  internalPath,
  seedContent = DEFAULT_PROJECT_INSTRUCTIONS,
}) {
  if (!rootPath || !internalPath) return

  const rootExists = await invoke('path_exists', { path: rootPath })
  if (!rootExists) return

  const raw = await invoke('read_file', { path: rootPath })
  if (!isDefaultInstructionsTemplate(raw)) return

  await ensureInternalInstructionsFile(internalPath, seedContent || raw)
  await invoke('delete_path', { path: rootPath })
}

export async function loadWorkspaceInstructions({ rootPath, internalPath }) {
  if (!rootPath || !internalPath) return ''

  try {
    let rootRaw = null
    let internalRaw = null

    try {
      rootRaw = await invoke('read_file', { path: rootPath })
    } catch {
      // No manual root instructions.
    }

    if (rootRaw !== null && !isDefaultInstructionsTemplate(rootRaw)) {
      return stripInstructionComments(rootRaw)
    }

    try {
      internalRaw = await invoke('read_file', { path: internalPath })
    } catch {
      // No internal instructions yet.
    }

    if (internalRaw !== null) {
      return stripInstructionComments(internalRaw)
    }

    return rootRaw !== null ? stripInstructionComments(rootRaw) : ''
  } catch {
    return ''
  }
}

export async function resolveInstructionsFileToOpen({
  rootPath,
  internalPath,
  seedContent = DEFAULT_PROJECT_INSTRUCTIONS,
}) {
  if (!rootPath || !internalPath) return null

  let filePath = internalPath
  const rootExists = await invoke('path_exists', { path: rootPath })

  if (rootExists) {
    try {
      const rootRaw = await invoke('read_file', { path: rootPath })
      if (!isDefaultInstructionsTemplate(rootRaw)) {
        filePath = rootPath
      } else {
        await migrateAutoInstructionsFile({ rootPath, internalPath, seedContent })
      }
    } catch {
      // Fall back to internal instructions.
    }
  }

  if (filePath === internalPath) {
    await ensureInternalInstructionsFile(internalPath, seedContent)
  }

  return filePath
}
