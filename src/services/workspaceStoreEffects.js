import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'
import { loadUsageSummary } from './usageAccess'

export function loadWorkspaceUsage(isStale = () => false) {
  if (isStale()) return
  loadUsageSummary()
}

export function openWorkspaceFileInEditor(filePath) {
  useEditorStore().openFile(filePath)
}

export async function reloadOpenFilesAfterPull() {
  const filesStore = useFilesStore()
  const editorStore = useEditorStore()

  for (const filePath of editorStore.allOpenFiles) {
    if (!filePath || filesStore.fileContents[filePath] === undefined) continue
    try {
      const content = await invoke('read_file', { path: filePath })
      filesStore.fileContents[filePath] = content
    } catch {}
  }
}
