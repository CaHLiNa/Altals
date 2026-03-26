<template>
  <UiModalShell
    visible
    close-on-backdrop
    :body-padding="false"
    overlay-class="add-ref-dialog-overlay"
    surface-class="add-ref-dialog-surface"
    :surface-style="{ width: 'min(480px, calc(100vw - 32px))', maxHeight: '70vh' }"
    @close="$emit('close')"
  >
    <template #header>
      <div class="add-ref-dialog-header">
        <span class="add-ref-dialog-title">{{ t('Add Reference') }}</span>
        <div class="ui-flex-spacer"></div>
        <UiButton
          variant="ghost"
          size="icon-sm"
          icon-only
          :title="t('Close')"
          :aria-label="t('Close')"
          @click="$emit('close')"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </UiButton>
      </div>
    </template>

    <div class="add-ref-dialog-body" data-ref-dialog>
      <div class="add-ref-dialog-input-area">
        <UiTextarea
          ref="inputEl"
          v-model="inputText"
          rows="4"
          shell-class="add-ref-dialog-textarea"
          :placeholder="t('Paste DOI / BibTeX / RIS / citation...')"
          @keydown.meta.enter="lookup"
          @keydown.ctrl.enter="lookup"
        />

        <div v-if="dropActive" class="add-ref-dialog-drop-overlay">
          <span class="ui-text-xs">{{ t('Drop files to import') }}</span>
        </div>
      </div>

      <div class="add-ref-dialog-actions">
        <span v-if="statusText" class="ui-field-hint">{{ statusText }}</span>
        <div class="ui-flex-spacer"></div>
        <UiButton
          variant="primary"
          size="sm"
          :disabled="!inputText.trim()"
          :loading="loading"
          @click="lookup"
        >
          {{ loading ? t('Looking up...') : t('Look up') }}
        </UiButton>
      </div>

      <div v-if="errors.length > 0" class="add-ref-dialog-errors">
        <div v-for="(err, idx) in errors" :key="idx" class="add-ref-dialog-error">{{ err }}</div>
      </div>
    </div>
  </UiModalShell>

  <ReferenceImportPreviewDialog
    v-if="previewOpen && previewItems.length > 0"
    :items="previewItems"
    @close="previewOpen = false"
    @add-item="addPreviewItem"
    @merge-item="openMergeDialog"
    @keep-existing="keepExistingItem"
    @view-existing="viewExisting"
    @add-all-new="addAllNewItems"
  />

  <ReferenceMergeDialog
    v-if="mergeItem"
    :item="mergeItem"
    :existing-ref="mergeExistingRef"
    @close="closeMergeDialog"
    @view-existing="viewExisting"
    @confirm="confirmMerge"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useReferencesStore } from '../../stores/references'
import { useWorkspaceStore } from '../../stores/workspace'
import { importFromText, importFromPdf } from '../../services/referenceImport'
import { useI18n } from '../../i18n'
import ReferenceImportPreviewDialog from './ReferenceImportPreviewDialog.vue'
import ReferenceMergeDialog from './ReferenceMergeDialog.vue'
import UiButton from '../shared/ui/UiButton.vue'
import UiModalShell from '../shared/ui/UiModalShell.vue'
import UiTextarea from '../shared/ui/UiTextarea.vue'

const emit = defineEmits(['close'])

const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()
const { t } = useI18n()

const inputEl = ref(null)
const inputText = ref('')
const loading = ref(false)
const dropActive = ref(false)
const statusText = ref('')
const errors = ref([])
const previewItems = ref([])
const previewOpen = ref(false)
const mergeItemId = ref(null)
let previewIdSeed = 0

const mergeItem = computed(
  () => previewItems.value.find((item) => item.id === mergeItemId.value) || null
)
const mergeExistingRef = computed(() => {
  const key = mergeItem.value?.existingKey
  return key ? referencesStore.getByKey(key) : null
})

function nextPreviewId() {
  previewIdSeed += 1
  return `ref-import-${Date.now()}-${previewIdSeed}`
}

function decorateImportResults(importResults, sourceLabel = '') {
  return importResults.map((result) => {
    const audit = referencesStore.auditImportCandidate(result.csl)
    const existingRef = audit.existingKey ? referencesStore.getByKey(audit.existingKey) : null
    return {
      id: nextPreviewId(),
      csl: result.csl,
      confidence: result.confidence,
      status: result.status,
      sourceLabel,
      existingKey: audit.existingKey,
      existingTitle: existingRef?.title || '',
      matchType: audit.matchType,
      matchReason: audit.reason,
      resolution: audit.existingKey ? 'pending-duplicate' : 'pending-add',
    }
  })
}

function openPreview(items) {
  previewItems.value = items
  previewOpen.value = items.length > 0
}

// --- PDF drop via custom events (routed by FileTree) ---

async function onRefFileDrop(event) {
  dropActive.value = false
  const { paths } = event.detail
  if (!paths?.length) return

  const TEXT_EXTS = ['.bib', '.ris', '.json', '.nbib', '.enw', '.txt']
  const pdfPaths = paths.filter((p) => p.toLowerCase().endsWith('.pdf'))
  const textPaths = paths.filter((p) => TEXT_EXTS.some((ext) => p.toLowerCase().endsWith(ext)))
  const collectedItems = []

  errors.value = []

  // Handle text format files
  for (const filePath of textPaths) {
    loading.value = true
    statusText.value = t('Importing {name}...', { name: filePath.split('/').pop() })
    try {
      const content = await invoke('read_file', { path: filePath })
      const { results: importResults, errors: importErrors } = await importFromText(
        content,
        workspace
      )
      collectedItems.push(...decorateImportResults(importResults, filePath.split('/').pop()))
      errors.value.push(...importErrors.map(translateImportError))
      if (importResults.length > 0) {
        statusText.value = t('Prepared {count} references for review', {
          count: importResults.length,
        })
      }
    } catch (e) {
      errors.value.push(
        t('Failed: {name} - {error}', { name: filePath.split('/').pop(), error: e.message })
      )
    }
    loading.value = false
  }

  if (collectedItems.length > 0) {
    openPreview(collectedItems)
  }

  if (pdfPaths.length === 0) return

  loading.value = true
  statusText.value = t('Importing PDF...')

  for (const filePath of pdfPaths) {
    const result = await importFromPdf(filePath, workspace, referencesStore)
    if (result?.status === 'error') {
      errors.value.push(t('Failed to import PDF: {error}', { error: result.error }))
      statusText.value = t('PDF import failed')
    } else if (result) {
      if (result.status === 'duplicate' && result.pdfAttached) {
        statusText.value = t('Attached PDF to @{key}', { key: result.key })
      } else if (result.status === 'duplicate') {
        statusText.value = t('PDF already linked to @{key}', { key: result.key })
      } else {
        statusText.value = t('Imported: @{key}', { key: result.key })
      }
    }
  }

  loading.value = false
}

function onRefDragOver() {
  dropActive.value = true
}

function onRefDragLeave() {
  dropActive.value = false
}

onMounted(() => {
  nextTick(() => inputEl.value?.focus())
  window.addEventListener('ref-file-drop', onRefFileDrop)
  window.addEventListener('ref-drag-over', onRefDragOver)
  window.addEventListener('ref-drag-leave', onRefDragLeave)
})

onUnmounted(() => {
  window.removeEventListener('ref-file-drop', onRefFileDrop)
  window.removeEventListener('ref-drag-over', onRefDragOver)
  window.removeEventListener('ref-drag-leave', onRefDragLeave)
})

// --- Text lookup ---

async function lookup() {
  if (!inputText.value.trim() || loading.value) return

  loading.value = true
  statusText.value = t('Looking up...')
  previewItems.value = []
  previewOpen.value = false
  mergeItemId.value = null
  errors.value = []

  try {
    const { results: importResults, errors: importErrors } = await importFromText(
      inputText.value,
      workspace
    )
    const nextItems = decorateImportResults(importResults)
    openPreview(nextItems)
    errors.value = importErrors.map(translateImportError)

    if (importResults.length > 0) {
      statusText.value = t('Prepared {count} references for review', {
        count: importResults.length,
      })
    } else if (importErrors.length > 0) {
      statusText.value = t('Lookup failed')
    } else {
      statusText.value = t('No results found')
    }
  } catch (e) {
    errors.value = [e.message]
    statusText.value = t('Error')
  }

  loading.value = false
}

function viewExisting(existingKey) {
  if (!existingKey) return
  emit('close')
  referencesStore.focusReferenceInLibrary(existingKey, { mode: 'edit' })
}

function addPreviewItem(itemId) {
  const item = previewItems.value.find((entry) => entry.id === itemId)
  if (!item || item.resolution !== 'pending-add') return

  const result = referencesStore.addReference({
    ...item.csl,
    _addedAt: item.csl._addedAt || new Date().toISOString(),
  })

  if (result.status === 'duplicate') {
    item.existingKey = result.existingKey
    item.existingTitle = referencesStore.getByKey(result.existingKey)?.title || ''
    item.matchType = result.matchType
    item.resolution = 'pending-duplicate'
    previewOpen.value = true
    return
  }

  item.csl._key = result.key
  item.resolution = 'added'
}

function addAllNewItems() {
  for (const item of previewItems.value) {
    if (item.resolution === 'pending-add') {
      addPreviewItem(item.id)
    }
  }
}

function openMergeDialog(itemId) {
  mergeItemId.value = itemId
}

function closeMergeDialog() {
  mergeItemId.value = null
}

function keepExistingItem(itemId) {
  const item = previewItems.value.find((entry) => entry.id === itemId)
  if (!item) return
  item.resolution = 'kept'
}

function confirmMerge(fieldSelections) {
  const item = mergeItem.value
  if (!item?.existingKey) return
  const result = referencesStore.mergeReference(item.existingKey, item.csl, fieldSelections || {})
  if (result.status === 'merged') {
    item.resolution = 'merged'
  }
  closeMergeDialog()
}

function translateImportError(message) {
  const text = String(message || '')
  if (text === 'Empty input') return t('Please paste a DOI, BibTeX, RIS, or citation text first.')
  if (text === 'No valid BibTeX entries found') return t('No valid BibTeX entries found')
  if (text === 'No valid RIS entries found') return t('No valid RIS entries found')
  if (text === 'No valid CSL-JSON entries found') return t('No valid CSL-JSON entries found')
  if (text === 'Could not extract references from text')
    return t('Could not extract references from text')
  if (text === 'PDF import failed') return t('PDF import failed')

  const doiMatch = text.match(/^DOI not found: (.+)$/)
  if (doiMatch) {
    return t('DOI not found: {doi}', { doi: doiMatch[1] })
  }

  const failedMatch = text.match(/^Failed: (.+) - (.+)$/)
  if (failedMatch) {
    return t('Failed: {name} - {error}', { name: failedMatch[1], error: failedMatch[2] })
  }

  return text
}
</script>

<style scoped>
.add-ref-dialog-overlay {
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.add-ref-dialog-surface {
  position: relative;
}

.add-ref-dialog-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 46px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.add-ref-dialog-title {
  font-size: var(--ui-font-body);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.add-ref-dialog-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
}

.add-ref-dialog-input-area {
  position: relative;
}

.add-ref-dialog-textarea {
  min-height: 96px;
}

.add-ref-dialog-drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--accent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  pointer-events: none;
}

.add-ref-dialog-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.add-ref-dialog-errors {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.add-ref-dialog-error {
  font-size: var(--ui-font-caption);
  color: var(--error);
  line-height: var(--line-height-regular);
}
</style>
