<template>
  <section v-if="entry" class="extension-result-preview">
    <div class="extension-result-preview__header">
      <div class="extension-result-preview__title-wrap">
        <div class="extension-result-preview__eyebrow">{{ t('Preview') }}</div>
        <div class="extension-result-preview__title">
          {{ previewTitle }}
        </div>
      </div>
      <UiButton
        v-if="hasOpenAction"
        variant="secondary"
        size="sm"
        @click="$emit('open-entry', entry)"
      >
        {{ t('Open') }}
      </UiButton>
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

    <div v-else class="extension-result-preview__empty">
      {{ t('Preview unavailable for this result entry.') }}
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from '../../i18n'
import UiButton from '../shared/ui/UiButton.vue'

const PdfArtifactPreview = defineAsyncComponent(() => import('../editor/PdfArtifactPreview.vue'))
const ImagePreviewPane = defineAsyncComponent(() => import('../editor/ImagePreviewPane.vue'))

const props = defineProps({
  entry: { type: Object, default: null },
})

defineEmits(['open-entry'])

const { t } = useI18n()

const previewMode = computed(() => String(props.entry?.previewMode || '').trim().toLowerCase())
const previewPath = computed(() => String(props.entry?.previewPath || props.entry?.path || '').trim())
const previewTitle = computed(() =>
  String(props.entry?.previewTitle || props.entry?.label || t('Result Preview'))
)
const hasOpenAction = computed(() => Boolean(props.entry?.path || props.entry?.previewPath))

const isPdfPreview = computed(() =>
  previewMode.value === 'pdf' ||
  String(props.entry?.mediaType || '').toLowerCase() === 'application/pdf' ||
  previewPath.value.toLowerCase().endsWith('.pdf')
)

const isImagePreview = computed(() =>
  previewMode.value === 'image' ||
  /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(previewPath.value)
)
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

.extension-result-preview__body :deep(.pdf-artifact-preview-host),
.extension-result-preview__body :deep(.image-preview-root) {
  width: 100%;
  height: 100%;
  min-height: 0;
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
