import { LogicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauriDesktopRuntime } from '../../platform'

const MIN_APP_WINDOW_WIDTH = 1120
const MIN_APP_WINDOW_HEIGHT = 720

export async function applyAppWindowConstraints() {
  if (!isTauriDesktopRuntime) return

  try {
    const appWindow = getCurrentWindow()
    await appWindow.setMinSize(new LogicalSize(MIN_APP_WINDOW_WIDTH, MIN_APP_WINDOW_HEIGHT))
  } catch (error) {
    console.warn('[window] failed to apply runtime min size constraints:', error)
  }
}
