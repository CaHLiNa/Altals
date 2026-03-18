<template>
  <div class="pdft-shell pdft-shell-compact">
    <div>
      <h3 class="settings-section-title">{{ t('PDF Translation') }}</h3>
    </div>

    <div class="pdft-stack">
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="compatibleModels.length > 0 ? 'good' : 'none'"></span>
          <span class="env-lang-name">{{ t('Model') }}</span>
          <span class="env-lang-version">{{ modelSummary }}</span>
        </div>

        <div class="pdft-form-grid pdft-section-pad">
          <label class="pdft-field">
            <span class="pdft-label">{{ t('Provider') }}</span>
            <div class="pdft-select-shell">
              <select v-model="selectedProviderId" class="pdft-select" :disabled="compatibleModelGroups.length === 0">
                <option v-if="compatibleModelGroups.length === 0" value="">{{ t('No compatible models available') }}</option>
                <option v-for="group in compatibleModelGroups" :key="group.provider" :value="group.provider">
                  {{ group.label }}
                </option>
              </select>
              <span class="pdft-caret" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1 3l4 4 4-4z" />
                </svg>
              </span>
            </div>
          </label>

          <label class="pdft-field">
            <span class="pdft-label">{{ t('Model') }}</span>
            <div class="pdft-select-shell">
              <select v-model="draft.modelId" class="pdft-select" :disabled="selectedProviderModels.length === 0">
                <option v-if="selectedProviderModels.length === 0" value="">{{ t('No compatible models available') }}</option>
                <option v-for="model in selectedProviderModels" :key="model.id" :value="model.id">
                  {{ model.name }}
                </option>
              </select>
              <span class="pdft-caret" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1 3l4 4 4-4z" />
                </svg>
              </span>
            </div>
          </label>
        </div>

        <p v-if="compatibleModels.length === 0" class="pdft-inline-warning pdft-section-pad">
          {{ t('PDF translation currently supports Google and OpenAI-compatible models. Configure one in Settings > Models first.') }}
        </p>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot good"></span>
          <span class="env-lang-name">{{ t('Languages') }}</span>
          <span class="env-lang-version">{{ languageSummary }}</span>
        </div>

        <div class="pdft-form-grid pdft-section-pad">
          <label class="pdft-field">
            <span class="pdft-label">{{ t('Source language') }}</span>
            <div class="pdft-select-shell">
              <select v-model="draft.langIn" class="pdft-select">
                <option v-for="option in sourceLanguages" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="pdft-caret" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1 3l4 4 4-4z" />
                </svg>
              </span>
            </div>
          </label>

          <label class="pdft-field">
            <span class="pdft-label">{{ t('Target language') }}</span>
            <div class="pdft-select-shell">
              <select v-model="draft.langOut" class="pdft-select">
                <option v-for="option in targetLanguages" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
              <span class="pdft-caret" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path d="M1 3l4 4 4-4z" />
                </svg>
              </span>
            </div>
          </label>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="pdft-card-head">
          <div class="env-lang-header pdft-card-header-row">
            <span class="env-lang-dot good"></span>
            <span class="env-lang-name">{{ t('Output mode') }}</span>
            <span class="pdft-summary-badge">{{ outputModeLabel }}</span>
          </div>
        </div>

        <div class="pdft-choice-grid pdft-section-pad" role="radiogroup" :aria-label="t('Output mode')">
          <button
            v-for="option in outputModes"
            :key="option.value"
            type="button"
            class="pdft-choice-btn"
            :class="{ active: draft.mode === option.value }"
            @click="draft.mode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="draft.autoMapPoolMaxWorkers ? 'good' : 'warn'"></span>
          <span class="env-lang-name">{{ t('Throughput') }}</span>
          <span class="env-lang-version">{{ throughputSummary }}</span>
        </div>

        <div class="pdft-form-grid pdft-section-pad">
          <label class="pdft-field">
            <span class="pdft-label">{{ t('QPS') }}</span>
            <input v-model.number="draft.qps" type="number" min="1" max="32" class="pdft-input" />
          </label>

          <label class="pdft-field">
            <span class="pdft-label">{{ t('Worker pool') }}</span>
            <input v-model.number="draft.poolMaxWorkers" type="number" min="0" max="1000" class="pdft-input" />
          </label>
        </div>

        <div class="pdft-inline-setting pdft-section-pad">
          <div class="pdft-inline-label">{{ t('Auto-map worker pool from QPS') }}</div>
          <button
            class="tool-toggle-switch"
            :class="{ on: draft.autoMapPoolMaxWorkers }"
            @click="draft.autoMapPoolMaxWorkers = !draft.autoMapPoolMaxWorkers"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="draft.translateTableText ? 'good' : 'none'"></span>
          <span class="env-lang-name">{{ t('Translate table text') }}</span>
          <span class="env-lang-version">{{ draft.translateTableText ? t('Enabled') : t('Disabled') }}</span>
          <div class="pdft-card-spacer"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: draft.translateTableText }"
            @click="draft.translateTableText = !draft.translateTableText"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="pdft-card-head">
          <div class="env-lang-header pdft-card-header-row">
            <span class="env-lang-dot" :class="ocrMode === 'off' ? 'none' : 'warn'"></span>
            <span class="env-lang-name">{{ t('OCR fallback') }}</span>
            <span class="pdft-summary-badge">{{ ocrModeLabel }}</span>
          </div>
        </div>

        <div class="pdft-choice-grid pdft-section-pad" role="radiogroup" :aria-label="t('OCR fallback')">
          <button
            type="button"
            class="pdft-choice-btn"
            :class="{ active: ocrMode === 'off' }"
            @click="setOcrMode('off')"
          >
            {{ t('Off') }}
          </button>
          <button
            type="button"
            class="pdft-choice-btn"
            :class="{ active: ocrMode === 'manual' }"
            @click="setOcrMode('manual')"
          >
            {{ t('Manual') }}
          </button>
          <button
            type="button"
            class="pdft-choice-btn"
            :class="{ active: ocrMode === 'auto' }"
            @click="setOcrMode('auto')"
          >
            {{ t('Automatic') }}
          </button>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="draft.noWatermarkMode ? 'good' : 'none'"></span>
          <span class="env-lang-name">{{ t('Prefer no-watermark outputs when available') }}</span>
          <span class="env-lang-version">{{ draft.noWatermarkMode ? t('Enabled') : t('Disabled') }}</span>
          <div class="pdft-card-spacer"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: draft.noWatermarkMode }"
            @click="draft.noWatermarkMode = !draft.noWatermarkMode"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="draft.saveAutoExtractedGlossary ? 'warn' : 'none'"></span>
          <span class="env-lang-name">{{ t('Save automatically extracted glossary (CSV)') }}</span>
          <span class="env-lang-version">{{ draft.saveAutoExtractedGlossary ? t('Enabled') : t('Disabled') }}</span>
          <div class="pdft-card-spacer"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: draft.saveAutoExtractedGlossary }"
            @click="draft.saveAutoExtractedGlossary = !draft.saveAutoExtractedGlossary"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
      </div>

      <div class="env-lang-card">
        <div class="pdft-card-head">
          <div class="env-lang-header pdft-card-header-row pdft-card-header-main">
            <span class="env-lang-dot" :class="runtimeDotClass"></span>
            <span class="env-lang-name">{{ t('Runtime') }}</span>
            <span class="pdft-summary-badge" :class="[`tone-${runtimeDotClass}`]">{{ pdfTranslateStore.runtimeLabel }}</span>
          </div>
          <button
            class="pdft-toolbar-btn"
            :disabled="pdfTranslateStore.runtimeRefreshing"
            @click="refreshRuntimeStatus(true)"
          >
            {{ pdfTranslateStore.runtimeRefreshing ? t('Checking...') : t('Refresh') }}
          </button>
        </div>

        <div class="pdft-runtime-actions pdft-section-pad">
          <button
            class="key-save-btn pdft-action-btn pdft-action-btn--primary"
            :disabled="runtimeBusy"
            @click="prepareRuntime"
          >
            {{ pdfTranslateStore.setupInProgress ? t('Preparing...') : t('Prepare Runtime') }}
          </button>
          <button
            class="pdft-action-btn pdft-action-btn--secondary"
            :disabled="runtimeBusy || !runtimeReady"
            @click="warmupRuntime"
          >
            {{ pdfTranslateStore.warmupInProgress ? t('Warming up...') : t('Warm Up Runtime') }}
          </button>
        </div>

        <div v-if="runtimeBusy" class="pdft-progress-meta pdft-section-pad">
          {{ runtimeProgressLabel }}
          <span v-if="pdfTranslateStore.setupProgress > 0">· {{ pdfTranslateStore.setupProgress }}%</span>
        </div>

        <div v-if="runtimeBusy" class="pdft-progress-track">
          <div class="pdft-progress-fill" :style="{ width: `${pdfTranslateStore.setupProgress}%` }"></div>
        </div>

        <div v-if="runtimeError" class="pdft-runtime-error pdft-section-pad">
          {{ runtimeError }}
        </div>

        <div v-if="pdfTranslateStore.setupLogs.length > 0" class="pdft-log-shell pdft-section-pad">
          <div class="pdft-inline-label">{{ t('Runtime log') }}</div>
          <pre class="pdft-log">{{ pdfTranslateStore.setupLogs.join('\n') }}</pre>
        </div>
      </div>
    </div>

    <div class="keys-actions pdft-save-row">
      <span v-if="saved" class="pdft-save-hint">{{ t('Saved') }}</span>
      <button
        class="key-save-btn pdft-action-btn pdft-action-btn--save"
        :class="{ saved }"
        :disabled="pdfTranslateStore.saving || !isDirty"
        @click="saveSettings"
      >
        {{ pdfTranslateStore.saving ? t('Saving...') : saved ? t('Saved') : t('Save Settings') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { usePdfTranslateStore } from '../../stores/pdfTranslate'
import { useEnvironmentStore } from '../../stores/environment'
import { useI18n } from '../../i18n'
import { findModelById, getFirstModelForProvider, groupModelsByProvider } from '../../services/modelCatalog'

const { t } = useI18n()
const pdfTranslateStore = usePdfTranslateStore()
const envStore = useEnvironmentStore()
const saved = ref(false)
const selectedProviderId = ref('')

const draft = reactive({
  modelId: '',
  langIn: 'en',
  langOut: 'zh',
  mode: 'dual',
  qps: 8,
  poolMaxWorkers: 0,
  autoMapPoolMaxWorkers: true,
  ocrWorkaround: false,
  autoEnableOcrWorkaround: false,
  noWatermarkMode: false,
  translateTableText: true,
  saveAutoExtractedGlossary: false,
})

const sourceLanguages = computed(() => ([
  { value: 'auto', label: t('Auto detect (auto)') },
  { value: 'zh', label: t('Chinese (zh)') },
  { value: 'zh-TW', label: t('Traditional Chinese (zh-TW)') },
  { value: 'en', label: t('English (en)') },
  { value: 'ja', label: t('Japanese (ja)') },
  { value: 'ko', label: t('Korean (ko)') },
  { value: 'fr', label: t('French (fr)') },
  { value: 'de', label: t('German (de)') },
  { value: 'es', label: t('Spanish (es)') },
  { value: 'it', label: t('Italian (it)') },
  { value: 'ru', label: t('Russian (ru)') },
  { value: 'pt', label: t('Portuguese (pt)') },
]))

const outputModes = computed(() => ([
  { value: 'mono', label: t('Translated only') },
  { value: 'dual', label: t('Bilingual PDF') },
  { value: 'both', label: t('Create both') },
]))

const targetLanguages = computed(() => sourceLanguages.value.filter(item => item.value !== 'auto'))
const compatibleModels = computed(() => pdfTranslateStore.compatibleModels)
const compatibleModelGroups = computed(() => groupModelsByProvider(compatibleModels.value))
const selectedProviderGroup = computed(() => (
  compatibleModelGroups.value.find(group => group.provider === selectedProviderId.value)
  || compatibleModelGroups.value[0]
  || null
))
const selectedProviderModels = computed(() => selectedProviderGroup.value?.models || [])
const selectedProviderLabel = computed(() => selectedProviderGroup.value?.label || t('Not configured'))
const selectedModelLabel = computed(() => (
  selectedProviderModels.value.find(model => model.id === draft.modelId)?.name || t('Not configured')
))

const runtimeDotClass = computed(() => {
  const status = pdfTranslateStore.runtimeStatus?.status
  if (status === 'Ready') return 'good'
  if (status === 'Error' || status === 'PythonMissing') return 'bad'
  return 'warn'
})

const runtimeError = computed(() => (
  pdfTranslateStore.runtimeStatus?.status === 'Error' ? pdfTranslateStore.runtimeStatus.data : ''
))
const runtimeBusy = computed(() => pdfTranslateStore.setupInProgress || pdfTranslateStore.warmupInProgress)
const runtimeReady = computed(() => pdfTranslateStore.runtimeStatus?.status === 'Ready')
const runtimeProgressLabel = computed(() => (
  pdfTranslateStore.setupMessage
  || (pdfTranslateStore.warmupInProgress ? t('Warming up translation runtime') : t('Preparing translation runtime'))
))

function optionLabel(options, value, fallback = '') {
  return options.find(option => option.value === value)?.label || fallback
}

const modelSummary = computed(() => (
  compatibleModels.value.length === 0
    ? t('Not configured')
    : `${selectedProviderLabel.value} · ${selectedModelLabel.value}`
))

const languageSummary = computed(() => (
  `${optionLabel(sourceLanguages.value, draft.langIn, draft.langIn)} -> ${optionLabel(targetLanguages.value, draft.langOut, draft.langOut)}`
))

const outputModeLabel = computed(() => optionLabel(outputModes.value, draft.mode, draft.mode))
const throughputSummary = computed(() => `${draft.qps} QPS`)
const ocrMode = computed(() => (
  draft.autoEnableOcrWorkaround ? 'auto' : draft.ocrWorkaround ? 'manual' : 'off'
))
const ocrModeLabel = computed(() => {
  if (ocrMode.value === 'auto') return t('Automatic')
  if (ocrMode.value === 'manual') return t('Manual')
  return t('Off')
})

function draftSnapshot() {
  return {
    modelId: draft.modelId,
    langIn: draft.langIn,
    langOut: draft.langOut,
    mode: draft.mode,
    qps: draft.qps,
    poolMaxWorkers: draft.poolMaxWorkers,
    autoMapPoolMaxWorkers: draft.autoMapPoolMaxWorkers,
    ocrWorkaround: draft.ocrWorkaround,
    autoEnableOcrWorkaround: draft.autoEnableOcrWorkaround,
    noWatermarkMode: draft.noWatermarkMode,
    translateTableText: draft.translateTableText,
    saveAutoExtractedGlossary: draft.saveAutoExtractedGlossary,
  }
}

const isDirty = computed(() => JSON.stringify(draftSnapshot()) !== JSON.stringify(pdfTranslateStore.settings))

function syncDraft() {
  Object.assign(draft, pdfTranslateStore.settings)
}

function preferredProviderId() {
  return findModelById(compatibleModels.value, draft.modelId)?.provider
    || compatibleModelGroups.value[0]?.provider
    || ''
}

function ensureProviderSelection(preferCurrent = false) {
  if (compatibleModelGroups.value.length === 0) {
    selectedProviderId.value = ''
    if (draft.modelId) draft.modelId = ''
    return
  }

  const hasSelected = compatibleModelGroups.value.some(group => group.provider === selectedProviderId.value)
  if (preferCurrent || !hasSelected) {
    selectedProviderId.value = preferredProviderId()
  }

  const currentModel = findModelById(compatibleModels.value, draft.modelId)
  if (!currentModel || currentModel.provider !== selectedProviderId.value) {
    draft.modelId = getFirstModelForProvider(compatibleModels.value, selectedProviderId.value)?.id || ''
  }
}

function setOcrMode(mode) {
  draft.ocrWorkaround = mode === 'manual'
  draft.autoEnableOcrWorkaround = mode === 'auto'
}

function markSaved() {
  saved.value = true
  setTimeout(() => {
    saved.value = false
  }, 2000)
}

async function saveSettings() {
  await pdfTranslateStore.saveSettings({ ...draftSnapshot() })
  syncDraft()
  markSaved()
}

async function refreshRuntimeStatus(force = false) {
  await pdfTranslateStore.refreshRuntimeStatus({ force })
}

async function prepareRuntime() {
  await saveSettings()
  await pdfTranslateStore.setupRuntime()
}

async function warmupRuntime() {
  await saveSettings()
  await pdfTranslateStore.warmupRuntime()
}

function scheduleAfterFirstPaint(task) {
  const run = () => {
    Promise.resolve(task()).catch(() => {})
  }

  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 600 })
      } else {
        window.setTimeout(run, 80)
      }
    })
    return
  }

  run()
}

function warmPdfTranslatePanel() {
  scheduleAfterFirstPaint(async () => {
    if (!envStore.detected && !envStore.detecting) {
      await envStore.detect()
    }
    await pdfTranslateStore.refreshRuntimeStatus({ force: true })
  })
}

watch(() => pdfTranslateStore.settings, syncDraft, { deep: true })
watch(() => draft.modelId, () => {
  ensureProviderSelection(true)
})
watch(selectedProviderId, (providerId, previousProviderId) => {
  if (!providerId || providerId === previousProviderId) return
  const currentModel = findModelById(compatibleModels.value, draft.modelId)
  if (currentModel?.provider === providerId) return
  draft.modelId = getFirstModelForProvider(compatibleModels.value, providerId)?.id || ''
})
watch(compatibleModelGroups, () => {
  ensureProviderSelection()
}, { immediate: true, deep: true })

onMounted(async () => {
  await pdfTranslateStore.loadSettings()
  syncDraft()
  warmPdfTranslatePanel()
})
</script>

<style scoped>
.pdft-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pdft-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pdft-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.pdft-card-header-row {
  flex-wrap: wrap;
}

.pdft-card-header-main {
  flex: 1;
  min-width: 0;
}

.pdft-card-spacer {
  flex: 1;
}

.pdft-section-pad {
  padding-left: 14px;
}

.pdft-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.pdft-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pdft-label,
.pdft-inline-label {
  font-size: var(--ui-font-caption);
  color: var(--fg-secondary);
}

.pdft-progress-meta,
.pdft-save-hint {
  font-size: var(--ui-font-micro);
  line-height: 1.45;
  color: var(--fg-muted);
}

.pdft-select-shell {
  position: relative;
}

.pdft-select,
.pdft-input {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  min-width: 0;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--fg-primary);
  font-size: var(--ui-font-caption);
  line-height: 1.2;
  padding: 7px 30px 7px 9px;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.pdft-input {
  padding-right: 9px;
}

.pdft-select:hover,
.pdft-input:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.pdft-select:focus,
.pdft-input:focus {
  outline: none;
  border-color: var(--accent);
}

.pdft-caret {
  position: absolute;
  top: 50%;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fg-muted);
  pointer-events: none;
  transform: translateY(-50%);
}

.pdft-summary-badge {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: color-mix(in srgb, var(--bg-secondary) 88%, white 12%);
  color: var(--fg-secondary);
  font-size: var(--ui-font-micro);
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.pdft-summary-badge.tone-good {
  color: var(--success, #4ade80);
  background: rgba(158, 206, 106, 0.12);
  border-color: rgba(158, 206, 106, 0.18);
}

.pdft-summary-badge.tone-warn {
  color: var(--warning, #e0af68);
  background: rgba(224, 175, 104, 0.12);
  border-color: rgba(224, 175, 104, 0.18);
}

.pdft-summary-badge.tone-bad {
  color: var(--error);
  background: rgba(247, 118, 142, 0.12);
  border-color: rgba(247, 118, 142, 0.18);
}

.pdft-choice-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.pdft-choice-btn {
  min-height: 32px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
    var(--bg-primary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  font-size: var(--ui-font-label);
  font-family: inherit;
  color: var(--fg-secondary);
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  transition: background 150ms, color 150ms, border-color 150ms;
}

.pdft-choice-btn:hover {
  border-color: rgba(255, 255, 255, 0.18);
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.pdft-choice-btn.active {
  background: linear-gradient(180deg, rgba(122, 162, 247, 0.95), rgba(122, 162, 247, 0.82));
  border-color: var(--accent);
  color: #fff;
  box-shadow:
    0 0 0 1px rgba(122, 162, 247, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.pdft-inline-setting {
  margin-top: 8px;
}

.pdft-inline-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pdft-inline-warning {
  margin: 8px 0 0;
  font-size: var(--ui-font-micro);
  line-height: 1.45;
  color: var(--warning, #e0af68);
}

.pdft-runtime-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
  max-width: 320px;
}

.pdft-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 26px;
  padding: 4px 9px;
  font-size: var(--ui-font-caption);
  white-space: nowrap;
}

.pdft-action-btn--primary {
  min-height: 28px;
  font-weight: 600;
}

.pdft-action-btn--secondary {
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01)),
    var(--bg-primary);
  color: var(--fg-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s, box-shadow 0.15s;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.pdft-action-btn--secondary:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--fg-primary);
  background: var(--bg-hover);
}

.pdft-action-btn--secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pdft-toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 4px 9px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--bg-primary);
  color: var(--fg-secondary);
  font-size: var(--ui-font-caption);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: flex-start;
}

.pdft-toolbar-btn:hover {
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--fg-primary);
  background: var(--bg-hover);
}

.pdft-toolbar-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.pdft-action-btn--save {
  width: auto;
}

.pdft-progress-track {
  margin: 8px 14px 0;
  height: 4px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  overflow: hidden;
}

.pdft-progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s ease;
}

.pdft-runtime-error {
  margin-top: 8px;
  color: var(--error);
  font-size: var(--ui-font-micro);
  line-height: 1.45;
}

.pdft-log-shell {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.pdft-log {
  margin: 4px 0 0;
  max-height: 180px;
  overflow: auto;
  border-radius: 6px;
  background: var(--bg-secondary);
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: var(--ui-font-micro);
  line-height: 1.5;
  color: var(--fg-muted);
}

.pdft-save-row {
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.env-lang-dot.bad {
  background: var(--error);
}

.pdft-shell-compact :deep(.settings-section-title) {
  margin-bottom: 10px;
}

.pdft-shell-compact :deep(.env-lang-card) {
  padding: 8px 10px;
  border-radius: 6px;
}

.pdft-shell-compact :deep(.env-lang-header) {
  gap: 6px;
  min-height: 20px;
}

.pdft-shell-compact :deep(.env-lang-name) {
  font-size: var(--ui-font-caption);
  font-weight: 600;
}

.pdft-shell-compact :deep(.env-lang-version) {
  font-size: var(--ui-font-micro);
}

@media (max-width: 640px) {
  .pdft-form-grid,
  .pdft-runtime-actions {
    grid-template-columns: 1fr;
  }

  .pdft-inline-setting,
  .pdft-save-row {
    flex-direction: column;
    align-items: stretch;
  }

  .pdft-choice-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .pdft-choice-grid {
    grid-template-columns: 1fr;
  }
}
</style>
