import { invoke } from '@tauri-apps/api/core'

export function getHomeDir() {
  return invoke('get_home_dir')
}
