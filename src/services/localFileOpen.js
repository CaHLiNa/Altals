import { invoke } from '@tauri-apps/api/core'
import { useToastStore } from '../stores/toast'
import { t } from '../i18n'

export async function openLocalPath(path) {
  const targetPath = String(path || '').trim()
  if (!targetPath) return false

  try {
    await invoke('open_path_in_default_app', { path: targetPath })
    return true
  } catch (error) {
    useToastStore().showOnce(
      `open-local:${targetPath}`,
      t('Failed to open file: {error}', {
        error: error?.message || String(error || ''),
      }),
      {
        type: 'error',
        duration: 5000,
      },
      2000
    )
    return false
  }
}
