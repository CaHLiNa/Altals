<template>
  <div class="pdf-artifact-preview" :style="surfaceStyle">
    <div v-if="surfaceLoading" class="pdf-artifact-preview__state">
      {{ t('Loading PDF...') }}
    </div>

    <div v-else-if="surfaceError" class="pdf-artifact-preview__state">
      <div class="pdf-artifact-preview__error-title">{{ t('Preview failed') }}</div>
      <div class="pdf-artifact-preview__error-message">{{ surfaceError }}</div>
      <div class="pdf-artifact-preview__error-actions">
        <UiButton variant="secondary" size="sm" @click="reloadPdf">
          {{ t('Retry') }}
        </UiButton>
        <UiButton variant="secondary" size="sm" @click="$emit('open-external')">
          {{ t('Open PDF') }}
        </UiButton>
      </div>
    </div>

    <div v-else-if="engine && documentBuffer" class="pdf-artifact-preview__viewer-shell">
      <EmbedPDF :key="embedViewerKey" :engine="engine" :plugins="plugins">
        <template #default="{ activeDocumentId }">
          <div v-if="!activeDocumentId" class="pdf-artifact-preview__state">
            {{ t('Loading PDF...') }}
          </div>

          <DocumentContent
            v-else
            :document-id="activeDocumentId"
            v-slot="{ documentState, isLoading, isError, isLoaded }"
          >
            <div v-if="isLoading" class="pdf-artifact-preview__state">
              {{ t('Loading PDF...') }}
            </div>

            <div v-else-if="isError" class="pdf-artifact-preview__state">
              <div class="pdf-artifact-preview__error-title">{{ t('Preview failed') }}</div>
              <div class="pdf-artifact-preview__error-message">
                {{ documentState?.error?.message || t('Could not load PDF') }}
              </div>
            </div>

            <PdfEmbedDocumentSurface
              v-else-if="isLoaded"
              :document-id="activeDocumentId"
              :pdfViewerZoomMode="pdfViewerZoomMode"
              :pdfViewerSpreadMode="pdfViewerSpreadMode"
              :pdfViewerLastScale="pdfViewerLastScale"
              :restore-state="pendingRestoreState"
              @view-state-change="handleViewStateChange"
              @restore-state-consumed="handleRestoreStateConsumed"
            />
          </DocumentContent>
        </template>
      </EmbedPDF>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import { EmbedPDF } from '@embedpdf/core/vue'
import { usePdfiumEngine } from '@embedpdf/engines/vue'
import { DocumentContent } from '@embedpdf/plugin-document-manager/vue'

import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'
import { readPdfArtifactBase64 } from '../../services/pdf/artifactPreview.js'
import {
  buildEmbedPdfPluginRegistrations,
  decodePdfBase64ToArrayBuffer,
} from '../../services/pdf/embedPdfAdapter.js'
import {
  createPdfPreviewSessionState,
  resolvePdfPreviewSessionTransition,
  snapshotPdfPreviewViewState,
} from '../../domains/document/pdfPreviewSessionRuntime.js'
import { basenamePath } from '../../utils/path.js'
import PdfEmbedDocumentSurface from './PdfEmbedDocumentSurface.vue'

const props = defineProps({
  sourcePath: { type: String, required: true },
  artifactPath: { type: String, required: true },
  previewRevision: { type: Object, default: null },
  themeTokens: { type: Object, default: () => ({}) },
  pdfViewerZoomMode: { type: String, default: 'page-width' },
  pdfViewerSpreadMode: { type: String, default: 'single' },
  pdfViewerLastScale: { type: String, default: '' },
})

defineEmits(['open-external'])

const { t } = useI18n()
const { engine, isLoading: engineLoading, error: engineError } = usePdfiumEngine()

const documentBuffer = ref(null)
const documentName = ref('')
const latestViewState = ref(null)
const pendingRestoreState = ref(null)
const previewLoadPending = ref(true)
const previewLoadError = ref('')
const embedViewerKey = ref(0)
const previewSessionState = createPdfPreviewSessionState()

const plugins = computed(() =>
  buildEmbedPdfPluginRegistrations({
    documentBuffer: documentBuffer.value,
    documentName: documentName.value,
    pdfViewerZoomMode: props.pdfViewerZoomMode,
    pdfViewerSpreadMode: props.pdfViewerSpreadMode,
    pdfViewerLastScale: props.pdfViewerLastScale,
  })
)

const surfaceStyle = computed(() => ({
  '--embedpdf-surface': String(
    props.themeTokens?.['--shell-preview-surface']
      || props.themeTokens?.['--shell-editor-surface']
      || '#141311'
  ).trim(),
  '--embedpdf-page': String(props.themeTokens?.['--surface-base'] || '#ffffff').trim(),
}))

const surfaceLoading = computed(() => previewLoadPending.value || engineLoading.value)
const surfaceError = computed(() => {
  if (previewLoadError.value) return previewLoadError.value
  return engineError.value?.message || ''
})

let loadToken = 0

function syncPreviewSession(nextSession = {}) {
  previewSessionState.sessionKey = nextSession.sessionKey || ''
  previewSessionState.sourcePath = nextSession.sourcePath || ''
  previewSessionState.artifactPath = nextSession.artifactPath || ''
  previewSessionState.buildId = nextSession.buildId || ''
  previewSessionState.revisionKey = nextSession.revisionKey || ''
  previewSessionState.synctexPath = nextSession.synctexPath || ''
  previewSessionState.sourceFingerprint = nextSession.sourceFingerprint || ''
  previewSessionState.viewBookmark = nextSession.viewBookmark || null
}

function captureCurrentViewState() {
  return snapshotPdfPreviewViewState(latestViewState.value)
}

async function loadPdfDocument(options = {}) {
  const artifactPath = String(props.artifactPath || '').trim()
  loadToken += 1
  const currentToken = loadToken
  previewLoadPending.value = true
  previewLoadError.value = ''
  documentBuffer.value = null
  documentName.value = basenamePath(artifactPath) || 'document.pdf'

  if (!artifactPath) {
    previewLoadPending.value = false
    previewLoadError.value = t('Could not load PDF')
    pendingRestoreState.value = null
    return
  }

  try {
    const base64 = await readPdfArtifactBase64(artifactPath)
    if (currentToken !== loadToken) return

    documentBuffer.value = decodePdfBase64ToArrayBuffer(base64)
    pendingRestoreState.value = options.restoreState ? { ...options.restoreState } : null
    embedViewerKey.value += 1
    previewLoadPending.value = false
  } catch (error) {
    if (currentToken !== loadToken) return
    previewLoadPending.value = false
    previewLoadError.value = error?.message || String(error || t('Could not load PDF'))
  }
}

function reloadPdf() {
  void loadPdfDocument({ restoreState: captureCurrentViewState() })
}

function handleViewStateChange(nextState) {
  latestViewState.value = nextState ? { ...nextState } : null
}

function handleRestoreStateConsumed() {
  pendingRestoreState.value = null
}

async function handlePreviewRevisionChange(nextRevision, previousRevision, options = {}) {
  const transition = resolvePdfPreviewSessionTransition(previewSessionState, nextRevision, {
    viewBookmark: captureCurrentViewState(),
  })
  syncPreviewSession(transition.nextSession)

  const forceInitialLoad = options.forceInitialLoad === true
  if (!nextRevision?.artifactPath) {
    if (!documentBuffer.value) return
    latestViewState.value = null
    pendingRestoreState.value = null
    void loadPdfDocument()
    return
  }

  if (transition.action === 'noop') {
    if (forceInitialLoad && !documentBuffer.value) {
      void loadPdfDocument({ restoreState: transition.nextSession.viewBookmark })
    }
    return
  }

  const previousRevisionKey = previousRevision?.revisionKey || ''
  const nextRevisionKey = nextRevision?.revisionKey || ''
  if (!nextRevisionKey || (nextRevisionKey === previousRevisionKey && !forceInitialLoad)) return

  latestViewState.value = transition.nextSession.viewBookmark || null
  void loadPdfDocument({ restoreState: transition.nextSession.viewBookmark })
}

watch(
  () => props.previewRevision,
  (nextRevision, previousRevision) => {
    void handlePreviewRevisionChange(nextRevision, previousRevision, { forceInitialLoad: true })
  },
  { immediate: true }
)
</script>

<style scoped>
.pdf-artifact-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--embedpdf-surface);
}

.pdf-artifact-preview__viewer-shell {
  width: 100%;
  height: 100%;
}

.pdf-artifact-preview__state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--embedpdf-surface);
}

.pdf-artifact-preview__error-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.pdf-artifact-preview__error-message {
  max-width: min(420px, 100%);
  line-height: 1.5;
}

.pdf-artifact-preview__error-actions {
  display: flex;
  gap: 8px;
}
</style>
