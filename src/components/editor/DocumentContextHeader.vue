<template>
  <section class="document-context-header">
    <div class="document-context-main">
      <div class="document-context-kicker-row">
        <span class="document-context-mode">{{ modeLabel }}</span>
        <span class="document-context-divider">•</span>
        <span class="document-context-kind">{{ kindLabel }}</span>
        <span
          v-if="buildSummaryLabel"
          class="document-context-pill"
          :class="`is-${buildSummaryTone}`"
        >
          {{ buildSummaryLabel }}
        </span>
      </div>

      <div class="document-context-title-row">
        <h2 class="document-context-title">{{ title }}</h2>
        <span
          class="document-context-pill"
          :class="dirty ? 'is-accent' : 'is-neutral'"
        >
          {{ dirty ? t('Unsaved edits') : t('Saved') }}
        </span>
        <span
          v-if="issueSummaryLabel"
          class="document-context-pill"
          :class="`is-${issueSummaryTone}`"
        >
          {{ issueSummaryLabel }}
        </span>
      </div>

      <div class="document-context-meta">
        <span class="document-context-path">{{ relativePath }}</span>
        <span v-if="workspaceName" class="document-context-meta-item">{{ workspaceName }}</span>
        <span v-if="pendingReviewCount > 0" class="document-context-meta-item">
          {{ t('{count} pending proposal(s)', { count: pendingReviewCount }) }}
        </span>
        <span v-if="unresolvedCommentCount > 0" class="document-context-meta-item">
          {{ t('{count} open comment(s)', { count: unresolvedCommentCount }) }}
        </span>
        <span v-if="projectReferenceCount > 0 && showEvidenceMeta" class="document-context-meta-item">
          {{ t('{count} project reference(s)', { count: projectReferenceCount }) }}
        </span>
      </div>
    </div>

    <div class="document-context-actions">
      <button
        v-if="showPrimaryAction"
        type="button"
        class="document-action-button is-primary"
        @click="$emit('primary-action')"
      >
        <component :is="primaryIcon" :size="14" :stroke-width="1.8" />
        <span>{{ primaryLabel }}</span>
      </button>

      <button
        v-if="showPreviewButton"
        type="button"
        class="document-action-button"
        @click="$emit('reveal-preview')"
      >
        <IconEye :size="14" :stroke-width="1.8" />
        <span>{{ t('Preview') }}</span>
      </button>

      <button
        v-if="showPdfButton"
        type="button"
        class="document-action-button"
        @click="$emit('reveal-pdf')"
      >
        <IconFileTypePdf :size="14" :stroke-width="1.8" />
        <span>PDF</span>
      </button>

      <button
        v-if="showRunButtons"
        type="button"
        class="document-action-button"
        @click="$emit('run-code')"
      >
        <IconPlayerPlay :size="14" :stroke-width="1.8" />
        <span>{{ t('Run line') }}</span>
      </button>

      <button
        v-if="showRunButtons"
        type="button"
        class="document-action-button"
        @click="$emit('run-file')"
      >
        <IconPlayerTrackNext :size="14" :stroke-width="1.8" />
        <span>{{ t('Run file') }}</span>
      </button>

      <button
        v-if="showCommentToggle"
        type="button"
        class="document-action-button"
        :class="{ 'is-active': commentActive }"
        @click="$emit('toggle-comments')"
      >
        <IconMessageCircle :size="14" :stroke-width="1.8" />
        <span>{{ t('Comments') }}</span>
        <span v-if="commentBadgeCount > 0" class="document-action-badge">
          {{ commentBadgeCount > 9 ? '9+' : commentBadgeCount }}
        </span>
      </button>

      <button
        type="button"
        class="document-action-button"
        @click="$emit('open-version-history')"
      >
        <IconHistory :size="14" :stroke-width="1.8" />
        <span>{{ t('Versions') }}</span>
      </button>

      <button
        type="button"
        class="document-action-button"
        @click="$emit('create-save-point')"
      >
        <IconBookmarkPlus :size="14" :stroke-width="1.8" />
        <span>{{ t('Save point') }}</span>
      </button>

      <button
        type="button"
        class="document-action-button"
        @click="$emit('open-assist')"
      >
        <IconSparkles :size="14" :stroke-width="1.8" />
        <span>{{ t('Assist') }}</span>
      </button>

      <button
        v-if="showAiDiagnoseButton"
        type="button"
        class="document-action-button"
        @click="$emit('diagnose-with-ai')"
      >
        <IconSearch :size="14" :stroke-width="1.8" />
        <span>{{ t('Explain build') }}</span>
      </button>

      <button
        v-if="showAiFixButton"
        type="button"
        class="document-action-button"
        @click="$emit('fix-with-ai')"
      >
        <IconSparkles :size="14" :stroke-width="1.8" />
        <span>{{ t('Fix with AI') }}</span>
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import {
  IconBookmarkPlus,
  IconEye,
  IconFileTypePdf,
  IconHistory,
  IconMessageCircle,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-vue'
import { useI18n } from '../../i18n'

const props = defineProps({
  activePath: { type: String, required: true },
  sourcePath: { type: String, default: '' },
  workspacePath: { type: String, default: '' },
  viewerType: { type: String, default: '' },
  uiState: { type: Object, default: null },
  statusText: { type: String, default: '' },
  statusTone: { type: String, default: 'neutral' },
  problems: { type: Array, default: () => [] },
  dirty: { type: Boolean, default: false },
  pendingReviewCount: { type: Number, default: 0 },
  unresolvedCommentCount: { type: Number, default: 0 },
  projectReferenceCount: { type: Number, default: 0 },
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
  'open-version-history',
  'create-save-point',
  'open-assist',
  'diagnose-with-ai',
  'fix-with-ai',
])

const { t } = useI18n()

function fileName(path = '') {
  return String(path || '').split('/').pop() || path
}

function fileExt(path = '') {
  const name = fileName(path)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function countProblemsBySeverity(problems = []) {
  const entries = Array.isArray(problems) ? problems : []
  return {
    errorCount: entries.filter((entry) => entry?.severity === 'error').length,
    warningCount: entries.filter((entry) => entry?.severity === 'warning').length,
  }
}

const displayPath = computed(() => props.sourcePath || props.activePath || '')
const title = computed(() => fileName(displayPath.value))

const workspaceName = computed(() => {
  if (!props.workspacePath) return ''
  return fileName(props.workspacePath)
})

const relativePath = computed(() => {
  if (!displayPath.value) return ''
  if (props.workspacePath && displayPath.value.startsWith(`${props.workspacePath}/`)) {
    return displayPath.value.slice(props.workspacePath.length + 1)
  }
  return displayPath.value
})

const kindLabel = computed(() => {
  if (props.uiState?.kind === 'markdown') return t('Markdown')
  if (props.uiState?.kind === 'latex') return 'LaTeX'
  if (props.uiState?.kind === 'typst') return 'Typst'
  if (props.viewerType === 'notebook') return t('Notebook')
  if (props.viewerType === 'pdf') return 'PDF'
  if (props.viewerType === 'markdown-preview' || props.viewerType === 'typst-native-preview') return t('Preview')
  if (props.viewerType === 'image') return t('Image')
  if (props.viewerType === 'csv') return t('Data')

  const ext = fileExt(displayPath.value)
  if (ext === 'md' || ext === 'rmd' || ext === 'qmd') return t('Markdown')
  if (ext === 'tex' || ext === 'latex') return 'LaTeX'
  if (ext === 'typ') return 'Typst'
  if (ext === 'ipynb') return t('Notebook')
  if (ext === 'py') return 'Python'
  if (ext === 'r') return 'R'
  if (ext === 'jl') return 'Julia'
  return t('Document')
})

const modeLabel = computed(() => {
  if (props.viewerType === 'notebook') return t('Computation')
  if (props.viewerType === 'markdown-preview' || props.viewerType === 'typst-native-preview' || props.viewerType === 'pdf') {
    return t('Output')
  }
  if (props.viewerType === 'image' || props.viewerType === 'csv') return t('Project file')
  return t('Writing')
})

const buildSummaryTone = computed(() => {
  const { errorCount, warningCount } = countProblemsBySeverity(props.problems)
  if (props.uiState?.phase === 'compiling' || props.uiState?.phase === 'rendering') return 'running'
  if (errorCount > 0) return 'error'
  if (warningCount > 0) return 'warning'
  if (props.uiState?.phase === 'ready') return 'success'
  return props.statusTone || 'neutral'
})

const buildSummaryLabel = computed(() => {
  const { errorCount, warningCount } = countProblemsBySeverity(props.problems)
  if (props.uiState?.phase === 'compiling' || props.uiState?.phase === 'rendering') return t('Building')
  if (errorCount > 0) return t('Needs attention')
  if (warningCount > 0) return t('Warnings')
  if (props.uiState?.phase === 'ready') return t('Ready')
  if (props.statusText) return props.statusText
  return ''
})

const issueSummaryTone = computed(() => {
  const { errorCount, warningCount } = countProblemsBySeverity(props.problems)
  return errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'neutral'
})

const issueSummaryLabel = computed(() => {
  const { errorCount, warningCount } = countProblemsBySeverity(props.problems)
  if (errorCount > 0) {
    return t('{count} blocker(s)', { count: errorCount })
  }
  if (warningCount > 0) {
    return t('{count} issue(s)', { count: warningCount })
  }
  return ''
})

const showEvidenceMeta = computed(() => (
  props.viewerType === 'text'
  || props.viewerType === 'notebook'
  || props.viewerType === 'markdown-preview'
  || props.viewerType === 'typst-native-preview'
  || props.uiState?.kind === 'markdown'
  || props.uiState?.kind === 'latex'
  || props.uiState?.kind === 'typst'
))

const showPrimaryAction = computed(() => (
  !!props.uiState && props.uiState.kind !== 'text'
))

const primaryLabel = computed(() => {
  if (props.uiState?.kind === 'latex' || props.uiState?.kind === 'typst') {
    return t('Compile')
  }
  return t('Preview')
})

const primaryIcon = computed(() => (
  props.uiState?.kind === 'latex' || props.uiState?.kind === 'typst'
    ? IconPlayerPlay
    : IconEye
))

const showPreviewButton = computed(() => (
  props.uiState?.kind === 'latex'
  || props.uiState?.kind === 'typst'
  || props.uiState?.previewKind === 'pdf'
))

const showPdfButton = computed(() => (
  props.uiState?.kind === 'typst'
))

const showAiFixButton = computed(() => (
  props.uiState?.kind === 'latex' || props.uiState?.kind === 'typst'
))

const showAiDiagnoseButton = computed(() => (
  props.uiState?.kind === 'latex' || props.uiState?.kind === 'typst'
))
</script>

<style scoped>
.document-context-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 86%, transparent), color-mix(in srgb, var(--bg-primary) 78%, transparent));
}

.document-context-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}

.document-context-kicker-row,
.document-context-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.document-context-mode,
.document-context-kind {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.document-context-mode {
  color: var(--fg-muted);
}

.document-context-kind {
  color: var(--fg-secondary);
}

.document-context-divider {
  color: var(--fg-muted);
  opacity: 0.6;
}

.document-context-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-wrap: wrap;
}

.document-context-title {
  margin: 0;
  min-width: 0;
  font-family: 'STIX Two Text', 'Lora', serif;
  font-size: clamp(22px, 1.8vw, 30px);
  line-height: 1.08;
  font-weight: 600;
  color: var(--fg-primary);
}

.document-context-meta {
  font-size: 12px;
  color: var(--fg-secondary);
}

.document-context-path {
  color: var(--fg-primary);
  font-weight: 600;
}

.document-context-meta-item {
  color: var(--fg-secondary);
}

.document-context-pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-primary) 58%, transparent);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-secondary);
}

.document-context-pill.is-neutral {
  color: var(--fg-secondary);
}

.document-context-pill.is-success {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.document-context-pill.is-warning {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.document-context-pill.is-error {
  color: var(--error);
  background: color-mix(in srgb, var(--error) 10%, transparent);
}

.document-context-pill.is-running,
.document-context-pill.is-accent {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.document-context-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  max-width: min(50%, 760px);
}

.document-action-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-primary) 62%, transparent);
  color: var(--fg-secondary);
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease, transform 140ms ease;
  white-space: nowrap;
}

.document-action-button:hover {
  color: var(--fg-primary);
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border));
  background: color-mix(in srgb, var(--bg-hover) 72%, transparent);
  transform: translateY(-1px);
}

.document-action-button.is-primary {
  color: var(--fg-primary);
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--bg-primary) 68%, transparent));
}

.document-action-button.is-active {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 22%, var(--border));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.document-action-button span {
  font-size: 12px;
  font-weight: 600;
}

.document-action-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  font-size: 10px;
  line-height: 18px;
  font-weight: 700;
  text-align: center;
}

@media (max-width: 1120px) {
  .document-context-header {
    flex-direction: column;
  }

  .document-context-actions {
    max-width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .document-context-header {
    padding: 12px 12px;
    gap: 14px;
  }

  .document-context-title {
    font-size: 22px;
  }

  .document-action-button span {
    display: none;
  }

  .document-action-button {
    padding: 0 10px;
  }
}
</style>
