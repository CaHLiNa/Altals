import { invoke } from '@tauri-apps/api/core'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  import.meta.url,
).href

export async function readPdfBinary(path) {
  const rawBytes = await invoke('read_file_binary', { path })
  return rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes)
}

export function createPdfLoadingTask(bytes) {
  return pdfjsLib.getDocument({ data: bytes })
}

export async function openPdfExternalUrl(url) {
  const { open } = await import('@tauri-apps/plugin-shell')
  return open(url)
}
