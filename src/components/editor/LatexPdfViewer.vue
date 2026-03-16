<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- PDF viewer -->
    <div class="flex-1 overflow-hidden">
      <PdfViewer
        v-if="hasPdf"
        ref="pdfViewerRef"
        :key="pdfReloadKey"
        :filePath="pdfPath"
        :paneId="paneId"
        :toolbar-target-selector="toolbarTargetSelector"
        @dblclick-page="handleBackwardSync"
      />
      <div v-else class="flex items-center justify-center h-full" style="color: var(--fg-muted);">
        <div class="text-center text-sm">
          <div v-if="compileStatus === 'compiling'">
            {{ t('Compiling…') }}
          </div>
          <div v-else-if="compileStatus === 'error'">
            <div>{{ t('Compilation failed — see Terminal.') }}</div>
            <div class="mt-1 text-xs">{{ t('Diagnostics are shown in Terminal.') }}</div>
          </div>
          <div v-else-if="!latexStore.hasAvailableCompiler">
            {{ t('No LaTeX compiler configured. Choose one in Settings > System.') }}
          </div>
          <div v-else>
            {{ t('No PDF yet — click Compile in the .tex tab') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useLatexStore } from '../../stores/latex'
import { useDocumentWorkflowStore } from '../../stores/documentWorkflow'
import { useI18n } from '../../i18n'
import PdfViewer from './PdfViewer.vue'

const props = defineProps({
  filePath: { type: String, required: true }, // The .pdf path
  paneId: { type: String, required: true },
  toolbarTargetSelector: { type: String, default: '' },
})

const latexStore = useLatexStore()
const workflowStore = useDocumentWorkflowStore()
const { t } = useI18n()

function inferLatexSourcePath(pdfPath) {
  return String(pdfPath || '').replace(/\.pdf$/i, '.tex')
}

function inferSyncTexPath(latexPath) {
  return String(latexPath || '').replace(/\.(tex|latex)$/i, '.synctex.gz')
}

const texPath = computed(() => (
  workflowStore.getSourcePathForPreview(props.filePath) || inferLatexSourcePath(props.filePath)
))

const state = computed(() => latexStore.stateForFile(texPath.value))
const synctexPath = computed(() => state.value?.synctexPath || inferSyncTexPath(texPath.value))
const forwardSyncRequest = computed(() => latexStore.forwardSyncRequestFor(texPath.value))
const compileStatus = computed(() => state.value?.status || null)
const pdfPath = computed(() => state.value?.pdfPath || props.filePath)
const hasPdf = ref(false)

const pdfViewerRef = ref(null)
const pdfReloadKey = ref(0)
let activeForwardSyncRequestId = null

function handleBackwardSync({ page, x, y }) {
  if (!synctexPath.value || !page) return

  invoke('synctex_backward', { synctexPath: synctexPath.value, page, x, y })
    .then(result => {
      if (result?.line) {
        window.dispatchEvent(new CustomEvent('latex-backward-sync', {
          detail: { file: result.file, line: result.line },
        }))
      }
    })
    .catch(() => {})
}

function handleCompileDone(e) {
  if (e.detail?.texPath === texPath.value) {
    pdfReloadKey.value++
    void checkPdfExists()
    void maybeRunForwardSync()
  }
}

async function checkPdfExists() {
  try {
    hasPdf.value = await invoke('path_exists', { path: pdfPath.value })
  } catch {
    hasPdf.value = false
  }
}

async function maybeRunForwardSync() {
  const request = forwardSyncRequest.value
  if (!request?.id || request.texPath !== texPath.value) return
  if (!synctexPath.value || !hasPdf.value) return
  if (!pdfViewerRef.value?.scrollToLocation) return
  if (activeForwardSyncRequestId === request.id) return

  const syncTexExists = await invoke('path_exists', { path: synctexPath.value }).catch(() => false)
  if (!syncTexExists) return

  activeForwardSyncRequestId = request.id
  try {
    const result = await invoke('synctex_forward', {
      synctexPath: synctexPath.value,
      texPath: texPath.value,
      line: request.line,
      column: request.column ?? 0,
    })
    if (forwardSyncRequest.value?.id !== request.id) return
    if (result?.page) {
      pdfViewerRef.value?.scrollToLocation(result.page, result.x, result.y)
    }
    latexStore.clearForwardSync(texPath.value, request.id)
  } catch {
    if (forwardSyncRequest.value?.id === request.id) {
      latexStore.clearForwardSync(texPath.value, request.id)
    }
  } finally {
    if (activeForwardSyncRequestId === request.id) {
      activeForwardSyncRequestId = null
    }
  }
}

onMounted(() => {
  latexStore.checkCompilers()
  window.addEventListener('latex-compile-done', handleCompileDone)
  void checkPdfExists().then(() => maybeRunForwardSync())
})

onUnmounted(() => {
  window.removeEventListener('latex-compile-done', handleCompileDone)
})

watch(pdfPath, () => {
  void checkPdfExists()
})

watch(pdfViewerRef, () => {
  void maybeRunForwardSync()
})

watch(
  () => [forwardSyncRequest.value?.id, synctexPath.value, hasPdf.value],
  () => {
    void maybeRunForwardSync()
  },
  { immediate: true },
)
</script>
