<template>
  <div>
    <h3 class="settings-section-title">{{ t('API Keys') }}</h3>
    <p class="settings-hint">{{ t('You only need a key for the provider you want to use. Keys are shared across all workspaces.') }}</p>

    <div v-if="configuredProviderDefs.length > 0" class="provider-group">
      <div class="provider-group-label">{{ t('Configured') }}</div>
      <div class="provider-grid">
        <button
          v-for="spec in configuredProviderDefs"
          :key="spec.id"
          class="provider-card"
          :class="{ active: spec.id === selectedProviderId }"
          @click="selectProvider(spec.id)"
        >
          <span class="provider-card-name">{{ spec.label }}</span>
          <span class="provider-card-status is-good">{{ t('Configured') }}</span>
        </button>
      </div>
    </div>

    <div v-if="moreProviderDefs.length > 0" class="provider-group">
      <div class="advanced-toggle" @click="showMoreProviders = !showMoreProviders">
        <svg :class="{ rotated: showMoreProviders }" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3 1l4 4-4 4z"/>
        </svg>
        {{ t('More Providers') }}
      </div>

      <div v-if="showMoreProviders || configuredProviderDefs.length === 0" class="provider-grid">
        <button
          v-for="spec in moreProviderDefs"
          :key="spec.id"
          class="provider-card"
          :class="{ active: spec.id === selectedProviderId }"
          @click="selectProvider(spec.id)"
        >
          <span class="provider-card-name">{{ spec.label }}</span>
          <span class="provider-card-status">{{ t('Not configured') }}</span>
        </button>
      </div>
    </div>

    <div v-if="activeProviderSpec" class="provider-detail-card">
      <div class="provider-detail-head">
        <div class="provider-detail-copy">
          <div class="provider-detail-title">{{ activeProviderSpec.label }}</div>
          <div class="provider-detail-meta">{{ activeProviderSpec.apiKeyEnv }}</div>
        </div>
        <span class="provider-card-status" :class="{ 'is-good': isProviderConfigured(activeProviderSpec) }">
          {{ isProviderConfigured(activeProviderSpec) ? t('Configured') : t('Not configured') }}
        </span>
      </div>

      <div class="key-field">
        <label class="key-label">
          <span class="key-provider">{{ t('API Key') }}</span>
          <span class="key-env">{{ activeProviderSpec.apiKeyEnv }}</span>
        </label>
        <div class="key-input-row">
          <input
            :type="visibilityByEnv[activeProviderSpec.apiKeyEnv] ? 'text' : 'password'"
            :value="editKeys[activeProviderSpec.apiKeyEnv]"
            @input="editKeys[activeProviderSpec.apiKeyEnv] = $event.target.value"
            class="key-input"
            :placeholder="keyPlaceholderFor(activeProviderSpec)"
            spellcheck="false"
            autocomplete="off"
          />
          <button
            class="key-toggle"
            @click="visibilityByEnv[activeProviderSpec.apiKeyEnv] = !visibilityByEnv[activeProviderSpec.apiKeyEnv]"
            :title="visibilityByEnv[activeProviderSpec.apiKeyEnv] ? t('Hide') : t('Show')"
          >
            <svg v-if="!visibilityByEnv[activeProviderSpec.apiKeyEnv]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="keys-actions">
        <button class="key-save-btn" :class="{ saved: keySaved }" @click="saveKeys">
          {{ keySaved ? t('Saved') : t('Save Keys') }}
        </button>
        <span v-if="keySaved" class="key-saved-hint">{{ t('Restart chat to use new keys') }}</span>
        <button class="key-save-btn key-secondary-btn" :disabled="syncingModels" @click="syncModels">
          {{ syncingModels ? t('Syncing models...') : t('Sync Models') }}
        </button>
      </div>
      <p v-if="syncMessage" class="settings-hint" :class="{ 'key-error-hint': syncError }">{{ syncMessage }}</p>

      <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <svg :class="{ rotated: showAdvanced }" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M3 1l4 4-4 4z"/>
        </svg>
        {{ t('Advanced') }}
      </div>

      <div v-if="showAdvanced" class="advanced-section">
        <p class="settings-hint">{{ t('Custom API endpoints for enterprise/private deployments') }}</p>
        <div class="key-field">
          <label class="key-label">
            <span class="key-provider">{{ t('API URL') }}</span>
          </label>
          <input
            type="text"
            :value="editUrls[activeProviderSpec.id]"
            @input="editUrls[activeProviderSpec.id] = $event.target.value"
            class="key-input"
            :placeholder="getProviderPlaceholder(activeProviderSpec.id)"
            spellcheck="false"
          />
        </div>
        <p class="settings-hint">{{ t('Default URL: {url}', { url: getProviderDefaultUrl(activeProviderSpec.id) }) }}</p>
        <div class="keys-actions">
          <button class="key-save-btn" :class="{ saved: urlSaved }" @click="saveUrls">
            {{ urlSaved ? t('Saved') : t('Save URLs') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Monthly Budget (conditional on having direct keys) -->
    <template v-if="hasDirectKeys && (usageStore.showCostEstimates || usageStore.monthlyLimit > 0)">
      <h3 class="settings-section-title" style="margin-top: 24px;">{{ t('Monthly Budget') }}</h3>
      <p class="settings-hint">{{ t('Soft limit on estimated API key spending for your locally configured provider keys.') }}</p>
      <div class="usage-limit-row">
        <span class="usage-limit-dollar">$</span>
        <input
          type="number"
          step="1"
          min="0"
          v-model="editMonthlyLimit"
          class="key-input usage-limit-input"
          :placeholder="t('0 (no limit)')"
          @keydown.enter="saveMonthlyLimit"
        />
        <button class="key-save-btn" :class="{ saved: limitSaved }" @click="saveMonthlyLimit">
          {{ limitSaved ? t('Saved') : t('Set Limit') }}
        </button>
      </div>

      <!-- Budget progress bar -->
      <div v-if="showBudgetBar" class="budget-progress" style="margin-top: 10px;">
        <div class="budget-progress-track">
          <div class="budget-progress-fill" :style="{ width: budgetPercent + '%', background: budgetBarColor }"></div>
        </div>
        <div class="budget-progress-label">
          <span :style="{ color: budgetBarColor }">~{{ formatCost(usageStore.directCost) }} / ${{ usageStore.monthlyLimit.toFixed(0) }}</span>
          <span v-if="usageStore.isOverBudget" style="color: var(--error);"> — {{ t('budget reached') }}</span>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useUsageStore } from '../../stores/usage'
import { formatCost } from '../../services/tokenUsage'
import { useI18n } from '../../i18n'
import {
  getDefaultModelsConfig,
  getProviderDefaultUrl,
  getProviderDefinitions,
  getProviderPlaceholder,
} from '../../services/modelCatalog'

const workspace = useWorkspaceStore()
const usageStore = useUsageStore()
const { t } = useI18n()
const keySaved = ref(false)
const showAdvanced = ref(false)
const urlSaved = ref(false)
const editMonthlyLimit = ref('')
const limitSaved = ref(false)
const selectedProviderId = ref('')
const showMoreProviders = ref(false)
const syncingModels = ref(false)
const syncMessage = ref('')
const syncError = ref(false)
const providerDefs = getProviderDefinitions()

function isProviderConfigured(spec) {
  return !!String(editKeys[spec.apiKeyEnv] || '').trim()
}

const configuredProviderDefs = computed(() => providerDefs.filter(spec => isProviderConfigured(spec)))
const moreProviderDefs = computed(() => providerDefs.filter(spec => !isProviderConfigured(spec)))
const orderedProviderDefs = computed(() => [...configuredProviderDefs.value, ...moreProviderDefs.value])
const activeProviderSpec = computed(() => (
  orderedProviderDefs.value.find(spec => spec.id === selectedProviderId.value)
  || orderedProviderDefs.value[0]
  || null
))

const hasDirectKeys = computed(() => {
  return providerDefs.some(spec => !!workspace.apiKeys?.[spec.apiKeyEnv])
})

const showBudgetBar = computed(() => {
  return usageStore.monthlyLimit > 0 && usageStore.directCost > 0
})

const budgetPercent = computed(() => {
  if (usageStore.monthlyLimit <= 0) return 0
  return Math.min(100, (usageStore.directCost / usageStore.monthlyLimit) * 100)
})

const budgetBarColor = computed(() => {
  const pct = budgetPercent.value
  if (pct >= 100) return 'var(--error)'
  if (pct >= 80) return 'var(--warning, #e0af68)'
  return 'var(--accent)'
})

async function saveMonthlyLimit() {
  const val = parseFloat(editMonthlyLimit.value) || 0
  await usageStore.setMonthlyLimit(val)
  limitSaved.value = true
  setTimeout(() => limitSaved.value = false, 2000)
}

onMounted(() => {
  editMonthlyLimit.value = usageStore.monthlyLimit > 0 ? String(usageStore.monthlyLimit) : ''
})

const editKeys = reactive({
  ...Object.fromEntries(
    providerDefs.map(spec => [spec.apiKeyEnv, workspace.apiKeys?.[spec.apiKeyEnv] || '']),
  ),
})

const visibilityByEnv = reactive(
  Object.fromEntries(
    providerDefs.map(spec => [spec.apiKeyEnv, false]),
  ),
)

const editUrls = reactive({
  ...Object.fromEntries(
    providerDefs.map(spec => [spec.id, workspace.modelsConfig?.providers?.[spec.id]?.customUrl || '']),
  ),
})

const urlFields = providerDefs.map(spec => ({
  provider: spec.id,
  label: spec.label,
  placeholder: getProviderPlaceholder(spec.id),
}))

function keyPlaceholderFor(spec) {
  if (spec.id === 'anthropic') return 'sk-ant-...'
  if (spec.id === 'google') return 'AIza...'
  return 'sk-...'
}

function selectProvider(providerId) {
  selectedProviderId.value = providerId
  if (moreProviderDefs.value.some(spec => spec.id === providerId)) {
    showMoreProviders.value = true
  }
}

watch(
  () => orderedProviderDefs.value.map(spec => spec.id).join('|'),
  () => {
    const available = orderedProviderDefs.value
    if (!available.length) {
      selectedProviderId.value = ''
      return
    }
    const hasSelected = available.some(spec => spec.id === selectedProviderId.value)
    if (!hasSelected) {
      selectedProviderId.value = configuredProviderDefs.value[0]?.id || available[0].id
    }
    if (configuredProviderDefs.value.length === 0) {
      showMoreProviders.value = true
    }
  },
  { immediate: true },
)

async function saveKeys() {
  try {
    // Merge with existing global keys (preserve keys not shown in this UI, e.g. EXA_API_KEY)
    const existing = await workspace.loadGlobalKeys()
    const merged = { ...existing }
    for (const [k, v] of Object.entries(editKeys)) {
      if (v) merged[k] = v
      else delete merged[k]
    }
    await workspace.saveGlobalKeys(merged)
    await workspace.loadSettings()
    keySaved.value = true
    setTimeout(() => keySaved.value = false, 3000)
    await syncModels({ auto: true })
  } catch (e) {
    console.error('Failed to save keys:', e)
  }
}

async function saveUrls() {
  try {
    const config = JSON.parse(JSON.stringify(workspace.modelsConfig || getDefaultModelsConfig()))

    for (const p of urlFields) {
      if (config.providers?.[p.provider]) {
        const url = editUrls[p.provider]?.trim()
        if (url) {
          config.providers[p.provider].customUrl = url
          config.providers[p.provider].url = url
        } else {
          delete config.providers[p.provider].customUrl
          config.providers[p.provider].url = getProviderDefaultUrl(p.provider)
        }
      }
    }

    await workspace.saveModelsConfig(config)
    urlSaved.value = true
    setTimeout(() => urlSaved.value = false, 3000)
  } catch (e) {
    console.error('Failed to save URLs:', e)
  }
}

async function syncModels({ auto = false } = {}) {
  syncError.value = false
  syncMessage.value = auto ? t('Syncing models...') : ''
  syncingModels.value = true

  try {
    const result = await workspace.syncProviderModels()
    if (result.failedProviders.length > 0 && result.syncedProviders.length === 0) {
      throw new Error(result.failedProviders[0].error || t('Unknown error'))
    }

    if (result.addedCount > 0) {
      syncMessage.value = t('Synced {count} new models', { count: result.addedCount })
    } else if (result.syncedProviders.length > 0) {
      syncMessage.value = t('Models are already up to date')
    } else {
      syncMessage.value = t('No syncable providers are configured yet')
    }

    if (result.failedProviders.length > 0 && result.syncedProviders.length > 0) {
      syncMessage.value = `${syncMessage.value} · ${t('Some providers failed to sync')}`
    }
  } catch (e) {
    syncError.value = true
    syncMessage.value = t('Failed to sync models: {error}', {
      error: e?.message || String(e),
    })
  } finally {
    syncingModels.value = false
  }
}
</script>

<style scoped>
/* Monthly limit */
.usage-limit-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.usage-limit-dollar {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-muted);
}

.usage-limit-input {
  width: 120px;
  flex: none;
}

/* Budget progress bar */
.budget-progress-track {
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}

.budget-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.budget-progress-label {
  margin-top: 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.advanced-toggle {
  margin-top: 20px;
  padding: 6px 0;
  font-size: 12px;
  color: var(--fg-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.advanced-toggle:hover {
  color: var(--fg-secondary);
}

.advanced-toggle svg {
  transition: transform 0.15s;
}

.advanced-toggle svg.rotated {
  transform: rotate(90deg);
}

.advanced-section {
  margin-top: 12px;
}

.advanced-section .settings-hint {
  margin: 0 0 12px;
}

.provider-group {
  margin-top: 14px;
}

.provider-group-label {
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.provider-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-primary);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  text-align: left;
}

.provider-card:hover {
  border-color: var(--fg-muted);
  transform: translateY(-1px);
}

.provider-card.active {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
}

.provider-card-name {
  font-size: 13px;
  font-weight: 600;
}

.provider-card-status {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  color: var(--fg-muted);
  background: var(--bg-tertiary);
}

.provider-card-status.is-good {
  color: var(--success);
  background: rgba(158, 206, 106, 0.12);
}

.provider-detail-card {
  margin-top: 14px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-secondary) 82%, transparent);
}

.provider-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.provider-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary);
}

.provider-detail-meta {
  margin-top: 2px;
  font-size: 11px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

.key-secondary-btn {
  margin-left: 8px;
}

.key-error-hint {
  color: var(--error);
}
</style>
