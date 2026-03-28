<template>
  <div class="workflow-bar" :class="{ 'workflow-bar-split': showSplitLayout }">
    <div class="workflow-left">
      <div class="workflow-doc-tools">
        <template v-if="showPrimaryAction && uiState?.kind !== 'markdown'">
          <UiButton
            class="workflow-primary-btn"
            variant="ghost"
            size="icon-sm"
            icon-only
            :title="primaryLabel"
            :aria-label="primaryLabel"
            @click="$emit('primary-action')"
          >
            <component :is="primaryIcon" :size="14" :stroke-width="1.8" />
          </UiButton>
        </template>
        <UiButton
          v-if="showRunButtons"
          class="workflow-primary-btn"
          variant="ghost"
          size="icon-sm"
          icon-only
          :title="t('Run selection or line ({shortcut})', { shortcut: `${modKey}+Enter` })"
          :aria-label="t('Run selection or line ({shortcut})', { shortcut: `${modKey}+Enter` })"
          @click="$emit('run-code')"
        >
          <IconPlayerPlay :size="14" :stroke-width="1.8" />
        </UiButton>
        <UiButton
          v-if="showRunButtons"
          class="workflow-primary-btn"
          variant="ghost"
          size="icon-sm"
          icon-only
          :title="t('Run entire file ({shortcut})', { shortcut: `Shift+${modKey}+Enter` })"
          :aria-label="t('Run entire file ({shortcut})', { shortcut: `Shift+${modKey}+Enter` })"
          @click="$emit('run-file')"
        >
          <IconPlayerTrackNext :size="14" :stroke-width="1.8" />
        </UiButton>
        <UiButton
          v-if="showCommentToggle"
          class="workflow-secondary-btn workflow-comment-btn"
          variant="ghost"
          size="icon-sm"
          icon-only
          :active="commentActive"
          :title="t('Toggle comments')"
          :aria-label="t('Toggle comments')"
          @click="$emit('toggle-comments')"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              d="M3 2.5h10a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H9.414l-2.707 2.707a.5.5 0 01-.854-.354V11.5H3A1.5 1.5 0 011.5 10V4A1.5 1.5 0 013 2.5z"
            />
          </svg>
          <span v-if="commentBadgeCount > 0" class="workflow-comment-badge">
            {{ commentBadgeCount > 9 ? '9+' : commentBadgeCount }}
          </span>
        </UiButton>
      </div>

      <div v-if="showMeta" class="workflow-meta">
        <span class="workflow-kind">{{ kindLabel }}</span>
        <template v-if="phaseLabel">
          <span class="workflow-separator">·</span>
          <span class="workflow-phase">{{ phaseLabel }}</span>
        </template>
        <span v-if="statusText" class="workflow-status" :class="statusClass">
          <span class="workflow-status-dot"></span>
          {{ statusText }}
        </span>
      </div>
    </div>

    <div v-if="showPreviewSection" class="workflow-right">
      <div class="workflow-preview-tools">
        <UiButton
          v-if="showPreviewButton"
          class="workflow-secondary-btn"
          variant="ghost"
          size="icon-sm"
          icon-only
          :active="isPreviewButtonActive"
          :title="previewButtonLabel"
          :aria-label="previewButtonLabel"
          @click="$emit('reveal-preview')"
        >
          <IconEye :size="14" :stroke-width="1.8" />
        </UiButton>
        <UiButton
          v-if="showPdfButton"
          class="workflow-secondary-btn"
          variant="ghost"
          size="icon-sm"
          icon-only
          :active="isPdfButtonActive"
          title="PDF"
          aria-label="PDF"
          @click="$emit('reveal-pdf')"
        >
          <IconFileTypePdf :size="14" :stroke-width="1.8" />
        </UiButton>
      </div>

      <div
        v-if="showPdfToolbarSlot"
        :id="pdfToolbarTargetId"
        class="workflow-preview-slot workflow-preview-slot-pdf"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { IconEye, IconFileTypePdf, IconPlayerPlay, IconPlayerTrackNext } from '@tabler/icons-vue'
import UiButton from '../shared/ui/UiButton.vue'
import { modKey } from '../../platform'
import { useI18n } from '../../i18n'

const props = defineProps({
  uiState: { type: Object, default: null },
  previewState: { type: Object, default: null },
  pdfToolbarTargetId: { type: String, default: '' },
  statusText: { type: String, default: '' },
  statusTone: { type: String, default: 'muted' },
  showRunButtons: { type: Boolean, default: false },
  showCommentToggle: { type: Boolean, default: false },
  commentActive: { type: Boolean, default: false },
  commentBadgeCount: { type: Number, default: 0 },
})

defineEmits([
  'primary-action',
  'reveal-preview',
  'reveal-pdf',
  'run-code',
  'run-file',
  'toggle-comments',
])

const { t } = useI18n()

const kindLabel = computed(() => {
  if (!props.uiState || props.uiState.kind === 'text') return ''
  if (props.uiState.kind === 'markdown') return t('Markdown')
  if (props.uiState.kind === 'latex') return t('LaTeX')
  if (props.uiState.kind === 'typst') return t('Typst')
  return ''
})

const phaseLabel = computed(() => {
  if (!props.uiState || props.uiState.kind === 'text') return ''
  if (props.uiState.phase === 'compiling') return t('Compiling...')
  if (props.uiState.phase === 'queued') return t('Queued')
  if (props.uiState.phase === 'rendering') return t('Rendering...')
  if (props.uiState.phase === 'error') return ''
  if (props.uiState.phase === 'ready') return t('Ready')
  return t('Idle')
})

const showMeta = computed(() => !!kindLabel.value || !!phaseLabel.value || !!props.statusText)

const showPrimaryAction = computed(() => !!props.uiState && props.uiState.kind !== 'text')

const primaryLabel = computed(() => {
  if (props.uiState?.kind === 'latex' || props.uiState?.kind === 'typst') {
    return t('Compile')
  }
  return t('Preview')
})

const primaryIcon = computed(() => {
  if (props.uiState?.kind === 'latex' || props.uiState?.kind === 'typst') {
    return IconPlayerPlay
  }
  return IconEye
})

const showPreviewButton = computed(() => !!props.uiState?.kind && props.uiState.kind !== 'text')

const previewButtonLabel = computed(() =>
  props.uiState?.kind === 'markdown' ? t('Toggle preview') : t('Preview')
)

const showPdfButton = computed(() => props.uiState?.kind === 'typst')

const activePreviewMode = computed(() => props.previewState?.previewMode || null)

const isPreviewButtonActive = computed(
  () => activePreviewMode.value === 'markdown' || activePreviewMode.value === 'typst-native'
)

const isPdfButtonActive = computed(() => activePreviewMode.value === 'pdf')

const showPreviewSection = computed(
  () => showPreviewButton.value || showPdfButton.value || !!props.previewState?.previewVisible
)

const showSplitLayout = computed(() => !!props.previewState?.previewVisible)

const showPdfToolbarSlot = computed(
  () =>
    props.previewState?.previewVisible &&
    props.previewState?.previewMode === 'pdf' &&
    !!props.pdfToolbarTargetId
)

const statusClass = computed(() => ({
  'workflow-status-success': props.statusTone === 'success',
  'workflow-status-warning': props.statusTone === 'warning',
  'workflow-status-error': props.statusTone === 'error',
  'workflow-status-running': props.statusTone === 'running',
}))
</script>

<style scoped>
.workflow-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: var(--document-header-row-height, 28px);
  min-width: 0;
  box-sizing: border-box;
  padding: 0 6px;
}

.workflow-bar-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  padding: 0;
}

.workflow-left,
.workflow-right {
  display: flex;
  align-items: center;
  min-width: 0;
  box-sizing: border-box;
}

.workflow-left {
  flex: 1 1 auto;
  gap: 8px;
  padding: 0 8px 0 6px;
}

.workflow-right {
  flex: 0 0 auto;
  gap: 6px;
  margin-left: auto;
  padding: 0 6px 0 8px;
}

.workflow-bar-split .workflow-left,
.workflow-bar-split .workflow-right {
  min-width: 0;
  width: 100%;
  height: 100%;
}

.workflow-bar-split .workflow-left {
  margin-left: 0;
}

.workflow-bar-split .workflow-right {
  margin-left: 0;
  justify-content: flex-start;
  border-left: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
}

.workflow-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  font-size: var(--ui-font-caption);
  color: var(--fg-muted);
  white-space: nowrap;
}

.workflow-kind {
  color: var(--fg-primary);
  font-weight: 600;
}

.workflow-separator {
  opacity: 0.45;
}

.workflow-doc-tools,
.workflow-preview-tools {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-secondary) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
}

.workflow-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  height: auto;
  color: var(--fg-muted);
}

.workflow-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.workflow-status-success {
  color: var(--success, #4ade80);
}

.workflow-status-warning {
  color: var(--warning);
}

.workflow-status-error {
  color: var(--error);
}

.workflow-status-running {
  color: var(--fg-muted);
}

.workflow-primary-btn,
.workflow-secondary-btn {
  flex: 0 0 auto;
  height: 22px;
  width: 24px;
  white-space: nowrap;
  color: var(--text-muted);
  border-radius: 6px;
}

.workflow-primary-btn {
  color: var(--success);
}

.workflow-primary-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--success, #4ade80) 10%, transparent);
  border-color: color-mix(in srgb, var(--success, #4ade80) 28%, var(--border));
}

.workflow-secondary-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
}

.workflow-secondary-btn {
  color: var(--accent);
}

.workflow-secondary-btn.is-active {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.workflow-secondary-btn-accent {
  color: var(--accent);
}

.workflow-ai-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 2px;
}

.workflow-comment-btn {
  position: relative;
  color: var(--text-muted);
}

.workflow-comment-btn.is-active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 26%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.workflow-comment-badge {
  position: absolute;
  top: -3px;
  right: -4px;
  min-width: 12px;
  height: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 0 2px;
  color: white;
  background: var(--accent);
  font-size: var(--ui-font-tiny);
  font-weight: 600;
  line-height: 1;
}

.workflow-preview-slot {
  display: flex;
  align-items: center;
  min-width: 0;
}

.workflow-preview-slot-pdf {
  margin-left: 2px;
  padding-left: 8px;
  border-left: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
}

.workflow-preview-slot-pdf :deep(.pdf-toolbar-wrap-embedded) {
  width: auto;
  background: transparent;
  border: 0;
}

.workflow-preview-slot-pdf :deep(.pdf-toolbar) {
  width: auto;
  justify-content: flex-start;
  gap: 8px;
  padding: 0;
  overflow: visible;
}

.workflow-preview-slot-pdf :deep(.pdf-toolbar-left),
.workflow-preview-slot-pdf :deep(.pdf-toolbar-right) {
  flex: none;
  gap: 4px;
}

.workflow-preview-slot-pdf :deep(.pdf-toolbar-center) {
  position: static;
  inset: auto;
  transform: none;
  flex: none;
}

.workflow-preview-slot-pdf :deep(.pdf-toolbar-group) {
  gap: 3px;
}

.workflow-preview-slot-pdf :deep(.pdf-page-indicator) {
  padding-right: 2px;
}
</style>
