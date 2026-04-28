import { invoke } from '@tauri-apps/api/core'

export async function createWorkspaceFile(dirPath, name, options = {}) {
  return invoke('workspace_create_file', {
    dirPath,
    name,
    initialContent: typeof options.initialContent === 'string' ? options.initialContent : '',
  })
}

export async function createWorkspaceDocumentFile(dirPath, options = {}) {
  return invoke('workspace_create_document_file', {
    params: {
      dirPath,
      ext: typeof options.ext === 'string' ? options.ext : '',
      templateId: typeof options.templateId === 'string' ? options.templateId : '',
      suggestedName: typeof options.suggestedName === 'string' ? options.suggestedName : '',
    },
  })
}

export async function resolveWorkspaceDocumentTemplateContent(templateId = '', name = '') {
  return invoke('workspace_document_template_content', {
    params: {
      templateId: String(templateId || ''),
      name: String(name || ''),
    },
  })
}

export async function duplicateWorkspacePath(path) {
  return invoke('workspace_duplicate_path', { path })
}

export async function createWorkspaceFolder(dirPath, name) {
  const result = await invoke('workspace_create_dir', { dirPath, name })
  return result?.path || ''
}

export async function renameWorkspacePath(oldPath, newPath) {
  return invoke('workspace_rename_path', { oldPath, newPath })
}

export async function moveWorkspacePath(srcPath, destDir) {
  return invoke('workspace_move_path', { srcPath, destDir })
}

export async function copyExternalWorkspaceFile(srcPath, destDir) {
  return invoke('workspace_copy_external_path', { srcPath, destDir })
}

export async function deleteWorkspacePath(path) {
  await invoke('delete_path', { path })
}
