<template>
  <section v-if="entry" class="extension-result-preview">
    <div class="extension-result-preview__header">
      <div class="extension-result-preview__title-wrap">
        <div class="extension-result-preview__eyebrow">{{ t('Preview') }}</div>
        <div class="extension-result-preview__title">
          {{ previewTitle }}
        </div>
      </div>
      <div v-if="toolbarActions.length > 0" class="extension-result-preview__actions">
        <UiButton
          v-for="action in toolbarActions"
          :key="action.id"
          variant="secondary"
          size="sm"
          @click="$emit('run-action', action.entry)"
        >
          {{ action.label }}
        </UiButton>
      </div>
    </div>

    <div v-if="isPdfPreview" class="extension-result-preview__body">
      <PdfArtifactPreview
        pane-id="extension-preview"
        :source-path="previewPath"
        :artifact-path="previewPath"
        kind="pdf"
        compact-toolbar
      />
    </div>

    <div v-else-if="isImagePreview" class="extension-result-preview__body">
      <ImagePreviewPane :file-path="previewPath" />
    </div>

    <div v-else-if="isHtmlPreview" class="extension-result-preview__body">
      <iframe
        v-if="htmlPreviewContent"
        class="extension-result-preview__html-frame"
        :srcdoc="htmlPreviewContent"
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
        referrerpolicy="no-referrer"
      ></iframe>
      <HtmlPreviewPane v-else :file-path="previewPath" />
    </div>

    <div v-else-if="isTextPreview" class="extension-result-preview__body extension-result-preview__body--text">
      <div v-if="textPreviewLoading" class="extension-result-preview__empty">
        {{ t('Loading text preview...') }}
      </div>
      <pre v-else class="extension-result-preview__text">{{ textPreviewContent }}</pre>
    </div>

    <div v-else class="extension-result-preview__empty">
      {{ t('Preview unavailable for this result entry.') }}
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'
import { readWorkspaceTextFile } from '../../services/fileStoreIO'

const PdfArtifactPreview = defineAsyncComponent(() => import('../editor/PdfArtifactPreview.vue'))
const ImagePreviewPane = defineAsyncComponent(() => import('../editor/ImagePreviewPane.vue'))
const HtmlPreviewPane = defineAsyncComponent(() => import('../editor/HtmlPreviewPane.vue'))

const props = defineProps({
  entry: { type: Object, default: null },
})

defineEmits(['run-action'])

const { t } = useI18n()

const previewMode = computed(() => String(props.entry?.previewMode || '').trim().toLowerCase())
const previewPath = computed(() => String(props.entry?.previewPath || props.entry?.path || '').trim())
const previewTitle = computed(() =>
  String(props.entry?.previewTitle || props.entry?.label || t('Result Preview'))
)
const textPreviewLoading = ref(false)
const textPreviewContent = ref('')
const htmlPreviewContent = computed(() => String(props.entry?.payload?.html || '').trim())
const toolbarActions = computed(() => {
  const actions = []
  const baseEntry = props.entry || {}
  const primaryAction = String(baseEntry.action || '').trim().toLowerCase()
  if (baseEntry.path || baseEntry.previewPath || ['copy-text', 'copy-path', 'execute-command', 'open-reference'].includes(primaryAction)) {
    actions.push({
      id: 'primary',
      label: labelForAction(baseEntry),
      entry: baseEntry,
    })
  }
  if (primaryAction !== 'reveal' && baseEntry.path) {
    actions.push({
      id: 'reveal',
      label: t('Reveal'),
      entry: { ...baseEntry, action: 'reveal' },
    })
  }
  if (primaryAction !== 'copy-path' && baseEntry.path) {
    actions.push({
      id: 'copy-path',
      label: t('Copy Path'),
      entry: { ...baseEntry, action: 'copy-path' },
    })
  }
  if (String(baseEntry.referenceId || baseEntry.reference_id || '').trim()) {
    actions.push({
      id: 'open-reference',
      label: t('Open Reference'),
      entry: { ...baseEntry, action: 'open-reference' },
    })
  }
  return actions
})

const isPdfPreview = computed(() =>
  previewMode.value === 'pdf' ||
  String(props.entry?.mediaType || '').toLowerCase() === 'application/pdf' ||
  previewPath.value.toLowerCase().endsWith('.pdf')
)

const isImagePreview = computed(() =>
  previewMode.value === 'image' ||
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(previewPath.value)
)

const isHtmlPreview = computed(() =>
  previewMode.value === 'html' ||
  /\.html?$/i.test(previewPath.value)
)

const isTextPreview = computed(() =>
  previewMode.value === 'text' ||
  /\.(txt|md|markdown|json|log|csv|tex|py|bib)$/i.test(previewPath.value)
)

async function loadTextPreview() {
  textPreviewContent.value = String(props.entry?.payload?.text || '')
  if (!isTextPreview.value) return
  if (textPreviewContent.value) return
  if (!previewPath.value) return
  textPreviewLoading.value = true
  try {
    textPreviewContent.value = await readWorkspaceTextFile(previewPath.value, 4000)
  } catch (error) {
    textPreviewContent.value = error?.message || String(error || 'Preview failed.')
  } finally {
    textPreviewLoading.value = false
  }
}

onMounted(() => {
  void loadTextPreview()
})

watch([previewPath, previewMode], () => {
  void loadTextPreview()
})

function labelForAction(entry = {}) {
  switch (String(entry?.action || '').trim().toLowerCase()) {
    case 'copy-text':
      return t('Copy')
    case 'copy-path':
      return t('Copy Path')
    case 'execute-command':
      return t('Run')
    case 'open-tab':
      return t('Open Tab')
    case 'open-reference':
      return t('Open Reference')
    case 'reveal':
      return t('Reveal')
    default:
      return t('Open')
  }
}
</script>

<style scoped>
.extension-result-preview {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-base) 86%, transparent);
  padding: 10px;
}

.extension-result-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.extension-result-preview__actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
}

.extension-result-preview__title-wrap {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.extension-result-preview__eyebrow {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.extension-result-preview__title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.extension-result-preview__body {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  border-radius: 8px;
}

.extension-result-preview__body--text {
  border: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
  background: color-mix(in srgb, var(--surface-base) 90%, transparent);
}

.extension-result-preview__body :deep(.pdf-artifact-preview-host),
.extension-result-preview__body :deep(.image-preview-root),
.extension-result-preview__body :deep(.html-preview-root) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.extension-result-preview__html-frame {
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  border: 0;
  background: white;
}

.extension-result-preview__text {
  margin: 0;
  width: 100%;
  min-height: 0;
  padding: 12px;
  overflow: auto;
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.extension-result-preview__empty {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
