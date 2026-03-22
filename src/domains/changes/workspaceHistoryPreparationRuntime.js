import {
  isAiLauncher,
  isChatTab,
  isLibraryPath,
  isNewTab,
  isPreviewPath,
  isReferencePath,
} from '../../utils/fileTypes.js'

export function createWorkspaceHistoryPreparationRuntime({
  isAiLauncherImpl = isAiLauncher,
  isChatTabImpl = isChatTab,
  isLibraryPathImpl = isLibraryPath,
  isNewTabImpl = isNewTab,
  isPreviewPathImpl = isPreviewPath,
  isReferencePathImpl = isReferencePath,
} = {}) {
  function isPersistableHistoryPath(filePath = '') {
    return !!filePath
      && !isReferencePathImpl(filePath)
      && !isChatTabImpl(filePath)
      && !isPreviewPathImpl(filePath)
      && !isNewTabImpl(filePath)
      && !isAiLauncherImpl(filePath)
      && !isLibraryPathImpl(filePath)
  }

  async function prepareWorkspaceHistoryFiles({
    editorStore,
    filesStore,
  } = {}) {
    const allOpenFiles = [...(editorStore?.allOpenFiles || [])]
    const dirtyPaths = editorStore?.getDirtyFiles?.(allOpenFiles) || []

    if (dirtyPaths.length > 0) {
      const savedDirtyPaths = await editorStore?.persistPaths?.(dirtyPaths)
      if (!savedDirtyPaths) {
        return {
          ok: false,
          reason: 'dirty-persist-failed',
          dirtyPaths,
        }
      }
    }

    const persistedFiles = []
    for (const filePath of allOpenFiles) {
      if (!isPersistableHistoryPath(filePath)) continue

      const content = filesStore?.fileContents?.[filePath]
      if (content === undefined) continue

      const saved = await filesStore?.saveFile?.(filePath, content)
      if (!saved) {
        return {
          ok: false,
          reason: 'file-save-failed',
          filePath,
          dirtyPaths,
          persistedFiles,
        }
      }
      persistedFiles.push(filePath)
    }

    return {
      ok: true,
      dirtyPaths,
      persistedFiles,
    }
  }

  return {
    isPersistableHistoryPath,
    prepareWorkspaceHistoryFiles,
  }
}
