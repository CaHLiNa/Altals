<template>
  <div class="settings-page plugins-page">
    <h3 class="settings-section-title">{{ t('Plugins') }}</h3>

    <section class="settings-group">
      <div class="settings-group-title">{{ t('Installed Plugins') }}</div>
      <div class="settings-group-body">
        <div v-if="pluginsStore.loadingRegistry" class="plugin-empty-row">
          {{ t('Loading plugins...') }}
        </div>
        <div v-else-if="plugins.length === 0" class="plugin-empty-row">
          {{ t('No plugins found') }}
        </div>
        <div v-for="plugin in plugins" v-else :key="plugin.id" class="plugin-row">
          <div class="plugin-copy">
            <div class="plugin-title-line">
              <span class="plugin-name">{{ plugin.name || plugin.id }}</span>
              <span class="plugin-status" :class="`is-${displayStatus(plugin)}`">{{ displayStatus(plugin) }}</span>
              <span class="plugin-scope">{{ plugin.scope }}</span>
            </div>
            <div class="plugin-description">{{ plugin.description || plugin.id }}</div>
            <div class="plugin-runtime">
              {{ t('Command') }}: {{ plugin.runtime?.command || t('Not configured') }}
            </div>
            <div class="plugin-chip-row">
              <span v-for="capability in plugin.capabilities" :key="capability" class="plugin-chip">
                {{ capability }}
              </span>
            </div>
            <div class="plugin-permissions">
              {{ permissionSummary(plugin) }}
            </div>
            <div v-if="plugin.errors.length" class="plugin-message is-error">
              {{ plugin.errors.join('; ') }}
            </div>
            <div v-else-if="plugin.warnings.length" class="plugin-message">
              {{ plugin.warnings.join('; ') }}
            </div>
          </div>
          <div class="plugin-controls">
            <UiSwitch
              :model-value="isEnabled(plugin.id)"
              :disabled="plugin.status === 'invalid' || plugin.status === 'blocked'"
              :title="t('Enable plugin')"
              @update:model-value="(value) => pluginsStore.setPluginEnabled(plugin.id, value)"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-title">{{ t('Default Providers') }}</div>
      <div class="settings-group-body">
        <div v-for="capability in visibleCapabilities" :key="capability" class="settings-row">
          <div class="settings-row-copy">
            <div class="settings-row-title">{{ capability }}</div>
            <div class="settings-row-hint">{{ t('Choose the plugin used by this capability.') }}</div>
          </div>
          <div class="settings-row-control">
            <UiSelect
              :model-value="pluginsStore.defaultProviderForCapability(capability)?.id || ''"
              :options="providerOptions(capability)"
              :disabled="providerOptions(capability).length === 0"
              :placeholder="t('No provider')"
              @update:model-value="(value) => pluginsStore.setDefaultProvider(capability, value)"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-title">{{ t('Recent Plugin Jobs') }}</div>
      <div class="settings-group-body">
        <PluginJobPanel />
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from '../../i18n'
import { usePluginsStore } from '../../stores/plugins'
import UiSelect from '../shared/ui/UiSelect.vue'
import UiSwitch from '../shared/ui/UiSwitch.vue'
import PluginJobPanel from '../plugins/PluginJobPanel.vue'

const { t } = useI18n()
const pluginsStore = usePluginsStore()
const plugins = computed(() => pluginsStore.registry)
const visibleCapabilities = computed(() => {
  const capabilities = new Set()
  for (const plugin of plugins.value) {
    for (const capability of plugin.capabilities || []) {
      capabilities.add(capability)
    }
  }
  return [...capabilities].sort()
})

function isEnabled(pluginId = '') {
  return pluginsStore.enabledPluginIds.includes(String(pluginId || '').trim().toLowerCase())
}

function displayStatus(plugin = {}) {
  if (plugin.status === 'invalid' || plugin.status === 'blocked') return plugin.status
  return isEnabled(plugin.id) ? plugin.status : 'disabled'
}

function permissionSummary(plugin = {}) {
  const permissions = plugin.permissions || {}
  const labels = []
  if (permissions.readWorkspaceFiles) labels.push(t('workspace files'))
  if (permissions.readReferenceLibrary) labels.push(t('reference library'))
  if (permissions.writeArtifacts) labels.push(t('artifact output'))
  if (permissions.writeReferenceMetadata) labels.push(t('reference metadata'))
  if (permissions.spawnProcess) labels.push(t('local process'))
  const network = String(permissions.network || 'none')
  labels.push(network === 'none' ? t('no network') : t('{value} network', { value: network }))
  return labels.join(' · ')
}

function providerOptions(capability = '') {
  return pluginsStore.providersForCapability(capability).map((plugin) => ({
    value: plugin.id,
    label: plugin.name || plugin.id,
  }))
}

onMounted(async () => {
  await pluginsStore.refreshRegistry().catch(() => {})
  await pluginsStore.refreshJobs().catch(() => {})
})
</script>

<style scoped>
.plugins-page {
  gap: 32px;
}

.plugin-empty-row {
  padding: 16px;
  color: var(--text-muted);
  font-size: 12px;
}

.plugin-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}

.plugin-row:last-child {
  border-bottom: none;
}

.plugin-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plugin-title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.plugin-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.plugin-status,
.plugin-scope,
.plugin-chip {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1;
}

.plugin-status.is-available {
  color: var(--success);
}

.plugin-status.is-invalid,
.plugin-status.is-blocked {
  color: var(--error);
}

.plugin-status.is-missingRuntime {
  color: var(--warning, #a56a00);
}

.plugin-status.is-disabled {
  color: var(--text-muted);
}

.plugin-description,
.plugin-runtime,
.plugin-permissions,
.plugin-message {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.plugin-message.is-error {
  color: var(--error);
}

.plugin-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-controls {
  flex: 0 0 auto;
}
</style>
