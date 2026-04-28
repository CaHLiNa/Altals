import { homeDir } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'

export async function pickWorkspaceDirectory(title = 'Open Workspace') {
  const home = await homeDir()
  return open({
    directory: true,
    multiple: false,
    title,
    defaultPath: home,
  })
}
