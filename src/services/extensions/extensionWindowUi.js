import { invoke } from '@tauri-apps/api/core'

export async function respondExtensionWindowUiRequest(payload = {}) {
  return invoke('extension_host_respond_ui_request', {
    params: {
      requestId: String(payload.requestId || ''),
      cancelled: Boolean(payload.cancelled),
      result: payload.result,
    },
  })
}
