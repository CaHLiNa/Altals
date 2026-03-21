<template>
  <div class="artifact-card" :class="{ 'artifact-card-compact': compact }">
    <div class="artifact-card-header">
      <span class="artifact-card-type">{{ artifactTypeLabel }}</span>
      <span v-if="artifact.sourceFile" class="artifact-card-source" :title="artifact.sourceFile">
        {{ t('Source file') }}: {{ shortSourceFile }}
      </span>
    </div>

    <div class="artifact-card-title">{{ translatedTitle }}</div>
    <div v-if="translatedSummary" class="artifact-card-summary">{{ translatedSummary }}</div>

    <div v-if="showBody" class="artifact-card-body">{{ artifact.body }}</div>

    <div v-if="artifact.type === 'translation_block' && artifact.translation" class="artifact-translation">
      <div v-if="artifact.sourceText" class="artifact-translation-block">
        <div class="artifact-translation-label">{{ t('Source') }}</div>
        <div class="artifact-translation-text">{{ artifact.sourceText }}</div>
      </div>
      <div class="artifact-translation-block">
        <div class="artifact-translation-label">{{ t('Translation') }}</div>
        <div class="artifact-translation-text">{{ artifact.translation }}</div>
      </div>
    </div>

    <div v-if="artifact.items?.length" class="artifact-list">
      <div v-for="(item, index) in artifact.items" :key="`${artifact.id}-item-${index}`" class="artifact-list-item">
        {{ item }}
      </div>
    </div>

    <div v-if="artifact.changes?.length" class="artifact-list">
      <div v-for="(change, index) in artifact.changes" :key="`${artifact.id}-change-${index}`" class="artifact-list-item">
        <span class="artifact-change-path">{{ change.filePath || artifact.sourceFile || t('Patch') }}</span>
        <span v-if="change.summary" class="artifact-change-summary">{{ change.summary }}</span>
      </div>
    </div>

    <div v-if="artifact.type === 'compile_diagnosis' && artifact.problems?.length" class="artifact-list">
      <div
        v-for="(problem, index) in artifact.problems"
        :key="`${artifact.id}-problem-${index}`"
        class="artifact-list-item"
        :class="problem.severity === 'error' ? 'artifact-problem-error' : 'artifact-problem-warning'"
      >
        <span class="artifact-change-path">
          {{ problem.severity === 'error' ? t('Error') : t('Warning') }}
          <template v-if="problem.line"> · {{ t('Line {line}', { line: problem.line }) }}</template>
        </span>
        <span class="artifact-change-summary">{{ problem.message }}</span>
      </div>
    </div>

    <div v-if="artifact.options?.length" class="artifact-options">
      <div v-for="(option, index) in artifact.options" :key="`${artifact.id}-option-${index}`" class="artifact-option">
        <div class="artifact-option-title">{{ option.title }}</div>
        <div v-if="option.description" class="artifact-option-desc">{{ option.description }}</div>
        <button
          v-if="option.url || option.doi"
          class="artifact-option-link"
          @click="openUrl(option.url || `https://doi.org/${option.doi}`)"
        >
          {{ t('Open') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'

const props = defineProps({
  artifact: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})

const { t } = useI18n()

const TYPE_LABELS = {
  proposal: 'Proposal',
  review: 'Review artifact',
  citation_set: 'Citation set',
  patch: 'Patch',
  compile_diagnosis: 'Compile diagnosis',
  translation_block: 'Translation block',
  note_bundle: 'Note bundle',
}

const artifactTypeLabel = computed(() => t(TYPE_LABELS[props.artifact?.type] || 'Artifact'))
const translatedTitle = computed(() => t(props.artifact?.title || ''))
const translatedSummary = computed(() => (
  props.artifact?.summary ? t(props.artifact.summary) : ''
))

const shortSourceFile = computed(() => (
  String(props.artifact?.sourceFile || '').split('/').pop() || props.artifact?.sourceFile || ''
))

const showBody = computed(() => (
  !!props.artifact?.body
  && props.artifact.type !== 'translation_block'
  && (!props.artifact.items?.length || !props.compact)
))

async function openUrl(url) {
  const { open } = await import('@tauri-apps/plugin-shell')
  open(url).catch(() => {})
}
</script>

<style scoped>
.artifact-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-secondary) 70%, var(--bg-primary));
  padding: 10px 12px;
}

.artifact-card-compact {
  margin-top: 8px;
}

.artifact-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.artifact-card-type {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: calc(var(--ui-font-size) - 2px);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}

.artifact-card-source {
  font-size: calc(var(--ui-font-size) - 2px);
  color: var(--fg-muted);
}

.artifact-card-title {
  font-size: var(--ui-font-size);
  font-weight: 600;
  color: var(--fg-primary);
}

.artifact-card-summary {
  margin-top: 4px;
  font-size: calc(var(--ui-font-size) - 1px);
  color: var(--fg-secondary);
  line-height: 1.45;
}

.artifact-card-body {
  margin-top: 8px;
  font-size: calc(var(--ui-font-size) - 1px);
  line-height: 1.55;
  white-space: pre-wrap;
  color: var(--fg-secondary);
}

.artifact-list,
.artifact-options,
.artifact-translation {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.artifact-list-item,
.artifact-option,
.artifact-translation-block {
  border-radius: 8px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--bg-primary) 78%, transparent);
}

.artifact-problem-error {
  border: 1px solid color-mix(in srgb, var(--error) 28%, transparent);
}

.artifact-problem-warning {
  border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
}

.artifact-change-path,
.artifact-option-title,
.artifact-translation-label {
  display: block;
  font-size: calc(var(--ui-font-size) - 1px);
  font-weight: 600;
  color: var(--fg-primary);
}

.artifact-change-summary,
.artifact-option-desc,
.artifact-translation-text {
  display: block;
  margin-top: 3px;
  font-size: calc(var(--ui-font-size) - 1px);
  line-height: 1.45;
  color: var(--fg-secondary);
  white-space: pre-wrap;
}

.artifact-option-link {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font-size: calc(var(--ui-font-size) - 2px);
  padding: 4px 8px;
  cursor: pointer;
}

.artifact-option-link:hover {
  border-color: var(--accent);
}
</style>
