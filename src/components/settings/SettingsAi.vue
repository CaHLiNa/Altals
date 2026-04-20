<template>
  <div class="settings-agent-subpage">
    <h3 class="settings-section-title">Codex ACP</h3>

    <section class="settings-group">
      <h4 class="settings-group-title">Codex ACP</h4>
      <div class="settings-group-body">
        <div class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">{{ t('Runtime status') }}</div>
            <div class="settings-row-hint">{{ runtimeSummary }}</div>
          </div>
          <div class="settings-row-control compact">
            <span
              class="settings-ai-runtime-status__badge"
              :class="{ 'is-ready': runtimeState.installed }"
            >
              {{ runtimeState.installed ? t('Configured') : t('Codex CLI missing') }}
            </span>
          </div>
        </div>

        <div class="settings-row settings-ai-actions-row">
          <div class="settings-row-control settings-ai-runtime-actions">
            <UiButton variant="secondary" size="sm" :disabled="runtimeStateLoading" @click="refreshRuntimeState">
              {{ runtimeStateLoading ? t('Refreshing...') : t('Refresh runtime') }}
            </UiButton>
          </div>
        </div>

        <div v-if="inlineMessage" class="settings-inline-message">{{ inlineMessage }}</div>
        <div v-if="runtimeState.error" class="settings-inline-message settings-inline-message-error">
          {{ runtimeState.error }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from '../../i18n'
import { useAiStore } from '../../stores/ai'
import UiButton from '../shared/ui/UiButton.vue'

const { t } = useI18n()
const aiStore = useAiStore()

async function loadAiConfig() {
  return invoke('ai_config_load')
}

async function resolveCodexCliState(config = {}) {
  return invoke('codex_cli_state_resolve', {
    params: {
      config,
    },
  })
}

function normalizeErrorMessage(error, fallback = '') {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

const runtimeStateLoading = ref(false)
const runtimeState = ref({
  installed: false,
  ready: false,
  commandPath: 'codex',
  version: '',
  error: '',
  model: '',
})

const runtimeSummary = computed(() => {
  if (!runtimeState.value.installed) {
    return t('ScribeFlow could not launch the configured Codex CLI command for the ACP bridge.')
  }

  const bits = [runtimeState.value.version, runtimeState.value.model || t('Using Codex defaults')].filter(Boolean)
  return bits.join(' · ')
})

async function refreshRuntimeState() {
  runtimeStateLoading.value = true
  try {
    const config = await loadAiConfig()
    runtimeState.value = await resolveCodexCliState(config?.codexCli || {})
  } catch (error) {
    runtimeState.value = {
      ...runtimeState.value,
      installed: false,
      ready: false,
      error: normalizeErrorMessage(error, t('Failed to load Codex runtime state.')),
    }
  } finally {
    runtimeStateLoading.value = false
  }
}

async function loadState() {
  try {
    await refreshRuntimeState()
    await aiStore.refreshProviderState()
  } catch (error) {
    runtimeState.value = {
      ...runtimeState.value,
      installed: false,
      ready: false,
      error: normalizeErrorMessage(error, t('Failed to load AI settings.')),
    }
  }
}

onMounted(() => {
  void loadState()
})
</script>

<style scoped>
.settings-ai-runtime-status__badge {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  background: color-mix(in srgb, var(--surface-hover) 20%, transparent);
  color: var(--text-secondary);
  font-size: 11px;
}

.settings-ai-runtime-status__badge.is-ready {
  border-color: color-mix(in srgb, var(--success) 45%, transparent);
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
}

.settings-ai-runtime-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}

.settings-ai-actions-row {
  justify-content: flex-end;
}

.settings-inline-message {
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-muted);
}

.settings-inline-message-error {
  color: var(--error);
  padding-top: 0;
}
</style>
