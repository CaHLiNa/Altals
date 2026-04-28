import { openNativeDialog } from './nativeDialog.js'
import { getHomeDirCached } from './workspacePaths.js'

export async function pickWorkspaceDirectory(title = 'Open Workspace') {
  const home = await getHomeDirCached()
  return openNativeDialog({
    directory: true,
    multiple: false,
    title,
    defaultPath: home,
  })
}
