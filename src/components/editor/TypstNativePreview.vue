<template>
  <div class="typst-native-preview-shell" data-surface-context-guard="true">
    <div v-if="loadError" class="typst-native-preview-state typst-native-preview-state-error">
      <div class="text-center text-sm">
        <div>{{ t('Tinymist preview failed to start.') }}</div>
        <div class="mt-1 text-xs opacity-70">{{ loadError }}</div>
      </div>
    </div>
    <div
      v-else-if="!previewUrl"
      class="typst-native-preview-state typst-native-preview-state-pending"
    >
      <div class="text-center text-sm">
        <div>{{ t('Starting Typst preview…') }}</div>
      </div>
    </div>
    <iframe
      v-else
      class="typst-native-preview-frame"
      :src="previewUrl"
      @load="handleIframeLoad"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useTypstStore } from '../../stores/typst'
import { useWorkspaceStore } from '../../stores/workspace'
import { useDocumentWorkflowStore } from '../../stores/documentWorkflow'
import { useI18n } from '../../i18n'
import { resolveTypstNativePreviewInput } from '../../domains/document/documentWorkspacePreviewAdapters.js'
import { resolveCachedTypstRootPath, resolveTypstRootPathForSource } from '../../services/typst/root.js'
import {
  createTypstPreviewDocumentUrl,
  isManagedTypstPreviewDocumentUrl,
} from '../../services/typst/previewDocument.js'
import {
  clearPendingTypstForwardSync,
  ensureTypstNativePreviewSession,
  peekPendingTypstForwardSync,
  requestTypstNativePreviewForwardSync,
  sourceBelongsToTypstPreviewRoot,
  subscribeTypstPreviewScrollSource,
} from '../../services/typst/previewSync.js'
import { revealTypstSourceLocation } from '../../services/typst/reveal.js'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
  sourcePath: { type: String, default: '' },
  rootPath: { type: String, default: '' },
})

const editorStore = useEditorStore()
const filesStore = useFilesStore()
const typstStore = useTypstStore()
const workspace = useWorkspaceStore()
const workflowStore = useDocumentWorkflowStore()
const { t } = useI18n()

const previewRootPath = ref('')
const previewUrl = ref('')
const loadError = ref('')
const iframeLoaded = ref(false)
let previewLoadToken = 0
let unsubscribeScrollSource = null

const resolvedPreviewInput = ref({ sourcePath: '', rootPath: '' })
const resolvedSourcePath = computed(() => resolvedPreviewInput.value.sourcePath)

const preferredSourcePaneId = computed(
  () =>
    editorStore.findPaneWithTab(resolvedSourcePath.value)?.id ||
    (workflowStore.session.previewSourcePath === resolvedSourcePath.value
      ? workflowStore.session.sourcePaneId
      : null) ||
    null,
)

async function resolveRootPath() {
  const resolved = await resolveTypstNativePreviewInput(props.filePath, {
    sourcePath: props.sourcePath,
    rootPath: props.rootPath,
    workflowStore,
    typstStore,
    filesStore,
    workspacePath: workspace.path,
    resolveCachedTypstRootPathImpl: resolveCachedTypstRootPath,
  })
  resolvedPreviewInput.value = resolved
  return resolved.rootPath || ''
}

async function ensurePreviewReady() {
  const loadToken = ++previewLoadToken
  loadError.value = ''
  iframeLoaded.value = false
  const resolvedRoot = await resolveRootPath()
  if (loadToken !== previewLoadToken) return
  if (!resolvedRoot) {
    previewRootPath.value = ''
    replacePreviewUrl('')
    return
  }
  previewRootPath.value = resolvedRoot

  try {
    const session = await ensureTypstNativePreviewSession({
      rootPath: resolvedRoot,
      workspacePath: workspace.path,
    })
    if (loadToken !== previewLoadToken) return
    const nextPreviewUrl = await resolvePreviewDocumentUrl(session)
    if (loadToken !== previewLoadToken) {
      revokePreviewUrl(nextPreviewUrl)
      return
    }
    if (nextPreviewUrl && nextPreviewUrl !== previewUrl.value) {
      replacePreviewUrl(nextPreviewUrl)
    }
    flushPendingForwardSync()
  } catch (error) {
    if (loadToken !== previewLoadToken) return
    loadError.value = error?.message || String(error)
  }
}

async function resolvePreviewDocumentUrl(session) {
  if (!session?.dataPlanePort) return ''

  try {
    const patchedPreviewUrl = await createTypstPreviewDocumentUrl(session, {
      workspacePath: workspace.path,
      previewMode: 'document',
    })
    return patchedPreviewUrl || ''
  } catch {
    return ''
  }
}

function revokePreviewUrl(url) {
  const value = String(url || '')
  if (value.startsWith('blob:') && !isManagedTypstPreviewDocumentUrl(value)) {
    URL.revokeObjectURL(value)
  }
}

function replacePreviewUrl(nextUrl) {
  revokePreviewUrl(previewUrl.value)
  previewUrl.value = String(nextUrl || '')
}

async function runForwardSync(detail) {
  try {
    const ok = await requestTypstNativePreviewForwardSync({
      sourcePath: detail.sourcePath,
      rootPath: previewRootPath.value,
      workspacePath: workspace.path,
      line: detail.line,
      character: detail.character,
    })
    if (ok && iframeLoaded.value) {
      clearPendingTypstForwardSync(detail)
    }
  } catch {
    // Keep pending request so iframe load or next reveal can retry it.
  }
}

function flushPendingForwardSync() {
  if (!previewRootPath.value) return
  const detail = peekPendingTypstForwardSync(previewRootPath.value)
  if (!detail) return
  void runForwardSync(detail)
}

function handleForwardSyncRequest(event) {
  const detail = event.detail || {}
  const source = String(detail.sourcePath || '')
  if (!source || !previewRootPath.value) return
  if (
    source !== resolvedSourcePath.value &&
    !sourceBelongsToTypstPreviewRoot(source, previewRootPath.value, detail.rootPath)
  ) {
    return
  }
  if (!Number.isInteger(detail.line) || !Number.isInteger(detail.character)) return
  void runForwardSync(detail)
}

function handleIframeLoad() {
  iframeLoaded.value = true
  flushPendingForwardSync()
}

async function handleScrollSource(location) {
  const filePath = String(location?.filePath || '')
  if (!filePath || !previewRootPath.value) return
  const sourceRootPath = await resolveTypstRootPathForSource(filePath, {
    resolveCachedTypstRootPathImpl: resolveCachedTypstRootPath,
    filesStore,
    workspacePath: workspace.path,
  })
  if (!sourceBelongsToTypstPreviewRoot(filePath, previewRootPath.value, sourceRootPath)) return
  await revealTypstSourceLocation(editorStore, location, {
    center: true,
    paneId: preferredSourcePaneId.value,
    suppressPreviewSync: true,
  })
}

onMounted(() => {
  window.addEventListener('typst-forward-sync-location', handleForwardSyncRequest)
  unsubscribeScrollSource = subscribeTypstPreviewScrollSource((location) => {
    void handleScrollSource(location)
  })
  void ensurePreviewReady()
})

onUnmounted(() => {
  previewLoadToken += 1
  window.removeEventListener('typst-forward-sync-location', handleForwardSyncRequest)
  unsubscribeScrollSource?.()
  unsubscribeScrollSource = null
  replacePreviewUrl('')
})

watch(
  [() => props.filePath, () => props.sourcePath, () => props.rootPath, () => workspace.path],
  () => {
    void ensurePreviewReady()
  },
)

</script>

<style scoped>
.typst-native-preview-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: inherit;
  contain: strict;
  isolation: isolate;
}

.typst-native-preview-state {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.typst-native-preview-state-error {
  color: var(--error);
}

.typst-native-preview-state-pending {
  color: var(--text-muted);
}

.typst-native-preview-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: inherit;
}
</style>
