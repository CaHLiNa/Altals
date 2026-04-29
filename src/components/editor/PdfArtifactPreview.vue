<template>
  <div ref="previewHostRef" class="pdf-artifact-preview-host">
    <div class="pdf-plugin-actions">
      <PluginCapabilityButton
        capability="pdf.translate"
        :target="pdfTranslateTarget"
        :settings="pdfTranslateSettings"
        :disabled="!artifactPath"
        :label="t('Translate')"
      />
    </div>
    <component
      :is="PdfEmbedSurface"
      :sourcePath="sourcePath"
      :artifactPath="artifactPath"
      :previewRevision="previewRevision"
      :resolvedTheme="resolvedTheme"
      :themeTokens="themeTokens"
      :kind="kind"
      :workspacePath="workspace.path || ''"
      :compileState="compileState"
      :pdfViewerZoomMode="effectivePdfViewerZoomMode"
      :pdfViewerSpreadMode="effectivePdfViewerSpreadMode"
      :pdfViewerLastScale="effectivePdfViewerLastScale"
      :pdfViewerPageThemeMode="workspace.pdfViewerPageThemeMode"
      :compact-toolbar="compactToolbar"
      :defer-compact-resize-fit="deferCompactResizeFit"
      @open-external="$emit('open-external')"
      @backward-sync="handleBackwardSync"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import { useLatexStore } from '../../stores/latex.js'
import { useDocumentWorkflowStore } from '../../stores/documentWorkflow.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { usePluginsStore } from '../../stores/plugins.js'
import { useI18n } from '../../i18n'
import { dispatchLatexBackwardSync } from '../../services/latex/pdfPreviewSync.js'
import { resolvePdfPreviewRevision } from '../../domains/document/pdfPreviewSessionRuntime.js'
import PdfEmbedSurface from './PdfEmbedSurface.vue'
import PluginCapabilityButton from '../plugins/PluginCapabilityButton.vue'

const PDF_PREVIEW_THEME_TOKEN_NAMES = [
  '--surface-base',
  '--surface-raised',
  '--surface-hover',
  '--border-subtle',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--shell-preview-surface',
  '--shell-editor-surface',
  '--workspace-ink',
  '--focus-ring',
  '--error',
]

const props = defineProps({
  paneId: { type: String, default: 'pane-root' },
  sourcePath: { type: String, required: true },
  artifactPath: { type: String, required: true },
  kind: { type: String, required: true },
  compactToolbar: { type: Boolean, default: false },
  deferCompactResizeFit: { type: Boolean, default: false },
})

defineEmits(['open-external'])

const workspace = useWorkspaceStore()
const latexStore = useLatexStore()
const workflowStore = useDocumentWorkflowStore()
const pluginsStore = usePluginsStore()
const { t } = useI18n()
const previewHostRef = ref(null)
const resolvedTheme = ref(readResolvedTheme())
const themeTokens = ref(capturePdfPreviewThemeTokens())

const compileState = computed(() => {
  if (props.kind !== 'latex') return null

  const liveState = latexStore.stateForFile(props.sourcePath) || null
  const persistedState = workflowStore.getLatexPreviewStateForFile(props.sourcePath) || null
  if (liveState && persistedState) {
    return {
      ...persistedState,
      ...liveState,
    }
  }

  return liveState || persistedState || null
})

const previewRevision = computed(() =>
  resolvePdfPreviewRevision({
    paneId: props.paneId,
    sourcePath: props.sourcePath,
    artifactPath: props.artifactPath,
    kind: props.kind,
    compileState: compileState.value,
  })
)
const effectivePdfViewerZoomMode = computed(() =>
  props.compactToolbar ? 'page-width' : workspace.pdfViewerZoomMode
)
const effectivePdfViewerSpreadMode = computed(() =>
  props.compactToolbar ? 'single' : workspace.pdfViewerSpreadMode
)
const effectivePdfViewerLastScale = computed(() =>
  props.compactToolbar ? '' : workspace.pdfViewerLastScale
)
const pdfTranslateTarget = computed(() => ({
  kind: props.kind === 'latex' ? 'documentPdf' : 'pdf',
  referenceId: '',
  path: props.artifactPath,
}))
const pdfTranslateSettings = computed(() => ({
  targetLanguage: 'zh',
  bilingual: true,
}))

function refreshThemeTokens() {
  themeTokens.value = capturePdfPreviewThemeTokens()
}

function refreshResolvedTheme() {
  resolvedTheme.value = readResolvedTheme()
}

function readThemeTokenValue(name) {
  if (typeof document === 'undefined') return ''

  const hostElement = previewHostRef.value
  if (hostElement) {
    const hostValue = String(getComputedStyle(hostElement).getPropertyValue(name) || '').trim()
    if (hostValue) return hostValue
  }

  return String(getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim()
}

function capturePdfPreviewThemeTokens() {
  if (typeof document === 'undefined') return {}
  const tokens = {}
  for (const name of PDF_PREVIEW_THEME_TOKEN_NAMES) {
    const value = readThemeTokenValue(name)
    if (value) {
      tokens[name] = value
    }
  }
  return tokens
}

function readResolvedTheme() {
  if (typeof document === 'undefined') return 'dark'

  const root = document.documentElement
  const theme = String(root?.dataset?.themeResolved || '').trim().toLowerCase()
  if (theme === 'light' || theme === 'dark') return theme
  return root?.classList?.contains('theme-light') ? 'light' : 'dark'
}

let themeSnapshotFrame = 0

function commitThemeSnapshot() {
  refreshResolvedTheme()
  refreshThemeTokens()
}

async function scheduleThemeSnapshot() {
  await nextTick()
  if (typeof window === 'undefined') {
    commitThemeSnapshot()
    return
  }
  if (themeSnapshotFrame) return
  themeSnapshotFrame = window.requestAnimationFrame(() => {
    themeSnapshotFrame = 0
    commitThemeSnapshot()
  })
}

function handleBackwardSync(detail) {
  if (!detail) return
  dispatchLatexBackwardSync(window, detail)
}

function handleWorkspaceThemeUpdated() {
  void scheduleThemeSnapshot()
}

onMounted(() => {
  void pluginsStore.refreshRegistry().catch(() => {})
  void pluginsStore.refreshJobs().catch(() => {})
  window.addEventListener('workspace-theme-updated', handleWorkspaceThemeUpdated)
  void scheduleThemeSnapshot()
})

onUnmounted(() => {
  window.removeEventListener('workspace-theme-updated', handleWorkspaceThemeUpdated)
  if (themeSnapshotFrame) {
    window.cancelAnimationFrame(themeSnapshotFrame)
    themeSnapshotFrame = 0
  }
})
</script>

<style scoped>
.pdf-artifact-preview-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.pdf-plugin-actions {
  position: absolute;
  top: 10px;
  right: 12px;
  z-index: 5;
  display: flex;
  align-items: center;
}
</style>
