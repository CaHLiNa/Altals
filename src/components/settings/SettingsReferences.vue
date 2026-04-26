<template>
  <div class="settings-page">
    <h3 class="settings-section-title">{{ t('References') }}</h3>

    <section class="settings-group">
      <h4 class="settings-group-title">{{ t('Library') }}</h4>
      <div class="settings-group-body">
        <div class="settings-inline-message">
          {{ t('ScribeFlow keeps references local to the workspace. Import BibTeX or PDF from the reference library panel when you need new material.') }}
        </div>
      </div>
    </section>

    <section class="settings-group">
      <h4 class="settings-group-title">{{ t('Citations') }}</h4>
      <div class="settings-group-body">
        <div class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">{{ t('Citation style') }}</div>
          </div>
          <div class="settings-row-control">
            <UiSelect
              :model-value="citationStyle"
              :options="citationStyleOptions"
              size="sm"
              @update:model-value="handleCitationStyleChange"
            />
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">{{ t('Markdown citation format') }}</div>
          </div>
          <div class="settings-row-control">
            <UiSelect
              :model-value="workspace.markdownCitationFormat"
              :options="markdownCitationFormatOptions"
              size="sm"
              @update:model-value="workspace.setMarkdownCitationFormat"
            />
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">{{ t('LaTeX citation command') }}</div>
          </div>
          <div class="settings-row-control">
            <UiSelect
              :model-value="workspace.latexCitationCommand"
              :options="latexCitationCommandOptions"
              size="sm"
              @update:model-value="workspace.setLatexCitationCommand"
            />
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">{{ t('Insert a space before citations') }}</div>
          </div>
          <div class="settings-row-control compact">
            <UiSwitch
              :model-value="workspace.citationInsertAddsSpace"
              @update:model-value="workspace.setCitationInsertAddsSpace($event)"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { useReferencesStore } from '../../stores/references'
import { useWorkspaceStore } from '../../stores/workspace'
import UiSelect from '../shared/ui/UiSelect.vue'
import UiSwitch from '../shared/ui/UiSwitch.vue'

const { t } = useI18n()
const referencesStore = useReferencesStore()
const workspace = useWorkspaceStore()

const citationStyle = computed(() => referencesStore.citationStyle || 'apa')
const citationStyleOptions = computed(() =>
  (referencesStore.availableCitationStyles || []).map((style) => ({
    value: style.id,
    label: style.name,
  }))
)

const markdownCitationFormatOptions = computed(() => [
  { value: 'bracketed', label: '[@key]' },
  { value: 'bare', label: '@key' },
])

const latexCitationCommandOptions = computed(() => [
  { value: 'cite', label: '\\cite{}' },
  { value: 'citep', label: '\\citep{}' },
  { value: 'citet', label: '\\citet{}' },
  { value: 'parencite', label: '\\parencite{}' },
  { value: 'textcite', label: '\\textcite{}' },
  { value: 'autocite', label: '\\autocite{}' },
])

async function handleCitationStyleChange(value) {
  if (citationStyle.value === value) return
  referencesStore.setCitationStyle(value)
  const globalConfigDir = workspace.globalConfigDir || await workspace.ensureGlobalConfigDir()
  await referencesStore.persistLibrarySnapshot(globalConfigDir)
}
</script>

<style scoped>
.settings-inline-message {
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-muted);
}
</style>
