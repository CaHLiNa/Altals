import { invoke } from '@tauri-apps/api/core'

export async function renderImagePreview(path, maxSize = 1600) {
  return invoke('render_image_preview', {
    path,
    maxSize,
  })
}
