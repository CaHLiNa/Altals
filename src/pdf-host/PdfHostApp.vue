<template>
  <PdfIframeSurface
    v-if="surfaceState.artifactPath"
    :sourcePath="surfaceState.sourcePath"
    :artifactPath="surfaceState.artifactPath"
    :kind="surfaceState.kind"
    :workspacePath="surfaceState.workspacePath"
    :compileState="surfaceState.compileState"
    :documentVersion="surfaceState.documentVersion"
    :forwardSyncRequest="surfaceState.forwardSyncRequest"
    :resolvedTheme="surfaceState.resolvedTheme"
    :pdfThemedPages="surfaceState.pdfThemedPages"
    :themeRevision="surfaceState.themeRevision"
    :themeTokens="surfaceState.themeTokens"
    @backward-sync="handleBackwardSync"
    @forward-sync-handled="handleForwardSyncHandled"
    @open-external="handleOpenExternal"
  />
</template>

<script setup>
import { onMounted, onUnmounted, reactive, watch } from 'vue'
import { getCurrentWebview } from '@tauri-apps/api/webview'

import PdfIframeSurface from '../components/editor/PdfIframeSurface.vue'
import { openLocalPath } from '../services/localFileOpen.js'
import {
  PDF_PREVIEW_HOST_BACKWARD_SYNC_EVENT,
  PDF_PREVIEW_HOST_FORWARD_SYNC_HANDLED_EVENT,
  PDF_PREVIEW_HOST_READY_EVENT,
  PDF_PREVIEW_HOST_UPDATE_EVENT,
  createPdfPreviewHostPayload,
} from '../services/pdf/pdfPreviewWebview.js'

const searchParams = new URLSearchParams(window.location.search)
const currentWebview = getCurrentWebview()
const ownLabel = String(currentWebview?.label || searchParams.get('label') || '').trim()
const parentLabel = String(searchParams.get('parentLabel') || '').trim()

const surfaceState = reactive(createPdfPreviewHostPayload({
  label: ownLabel,
}))

let cleanupUpdateListener = null

function applyHostThemeClass(theme = 'dark') {
  if (typeof document === 'undefined') return
  const resolvedTheme = String(theme || '').trim().toLowerCase() === 'light' ? 'light' : 'dark'
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark', 'theme-system')
  root.classList.add(`theme-${resolvedTheme}`)
  root.dataset.themeResolved = resolvedTheme
  root.dataset.themePreference = resolvedTheme
}

function assignSurfaceState(payload = {}) {
  const next = createPdfPreviewHostPayload({
    ...surfaceState,
    ...payload,
    label: ownLabel,
  })
  for (const key of Object.keys(next)) {
    surfaceState[key] = next[key]
  }
}

async function emitToParent(eventName, payload = {}) {
  if (!parentLabel) return
  await currentWebview.emitTo(parentLabel, eventName, {
    label: ownLabel,
    ...payload,
  }).catch(() => {})
}

function handleBackwardSync(detail) {
  void emitToParent(PDF_PREVIEW_HOST_BACKWARD_SYNC_EVENT, { detail })
}

function handleForwardSyncHandled(detail) {
  void emitToParent(PDF_PREVIEW_HOST_FORWARD_SYNC_HANDLED_EVENT, detail || {})
}

function handleOpenExternal() {
  void openLocalPath(surfaceState.artifactPath)
}

onMounted(async () => {
  applyHostThemeClass(surfaceState.resolvedTheme)
  cleanupUpdateListener = await currentWebview.listen(PDF_PREVIEW_HOST_UPDATE_EVENT, (event) => {
    if (String(event.payload?.label || '') !== ownLabel) return
    assignSurfaceState(event.payload)
  })
  await emitToParent(PDF_PREVIEW_HOST_READY_EVENT)
})

onUnmounted(() => {
  cleanupUpdateListener?.()
  cleanupUpdateListener = null
})

watch(
  () => surfaceState.resolvedTheme,
  (theme) => {
    applyHostThemeClass(theme)
  },
  { immediate: true }
)
</script>
