<template>
  <section class="settings-group">
    <div class="extensions-group-heading">
      <h4 class="settings-group-title">{{ t('Loaded Extensions') }}</h4>
      <div class="extensions-page-actions">
        <button
          type="button"
          class="extensions-page-icon-button"
          :title="t('Refresh extensions')"
          :aria-label="t('Refresh extensions')"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          <IconRefresh :size="18" :stroke-width="1.9" />
        </button>
        <button
          type="button"
          class="extensions-page-icon-button"
          :title="t('Open extension install folder')"
          :aria-label="t('Open extension install folder')"
          @click="$emit('open-install-folder')"
        >
          <IconFolder :size="19" :stroke-width="1.9" />
        </button>
      </div>
    </div>
    <div class="settings-group-body">
      <div v-if="errorMessage" class="extension-empty-row is-error">
        {{ errorMessage }}
      </div>
      <div v-if="loading" class="extension-empty-row">
        {{ t('Loading extensions...') }}
      </div>
      <div v-else-if="extensions.length === 0" class="extension-empty-row">
        {{ t('No extensions found') }}
      </div>
      <div v-for="extension in extensions" v-else :key="extension.id" class="extension-card">
        <div class="extension-header">
          <div class="extension-copy">
            <div class="extension-title-line">
              <span class="extension-name">{{ extensionDisplayName(extension) }}</span>
              <span class="extension-status" :class="`is-${displayStatus(extension)}`">{{ t(displayStatus(extension)) }}</span>
              <span class="extension-scope">{{ t(extension.scope) }}</span>
            </div>
            <div class="extension-description">{{ extensionDescription(extension) }}</div>
            <div v-if="extension.errors.length" class="extension-message is-error">
              {{ extension.errors.map((message) => t(message)).join('; ') }}
            </div>
            <div v-else-if="extension.warnings.length" class="extension-message">
              {{ extension.warnings.map((message) => t(message)).join('; ') }}
            </div>
          </div>
          <div class="extension-controls">
            <button
              type="button"
              class="extension-card-icon-button"
              :title="t('Extension options')"
              :aria-label="t('Extension options')"
              :disabled="!hasOptions(extension)"
              @click="$emit('open-options', extension.id)"
            >
              <IconSettings :size="18" :stroke-width="1.85" />
            </button>
            <UiSwitch
              :model-value="isEnabled(extension.id)"
              :disabled="extension.status === 'invalid' || extension.status === 'blocked'"
              :title="t('Enable extension')"
              @update:model-value="(value) => $emit('toggle-enabled', extension.id, value)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { IconFolder, IconRefresh, IconSettings } from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { buildExtensionSettingGroups } from '../../domains/extensions/extensionSettingsGroups'
import UiSwitch from '../shared/ui/UiSwitch.vue'

defineEmits(['refresh', 'open-install-folder', 'open-options', 'toggle-enabled'])

const props = defineProps({
  extensions: {
    type: Array,
    default: () => [],
  },
  enabledExtensionIds: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  errorMessage: {
    type: String,
    default: '',
  },
})

const { t } = useI18n()

function isEnabled(extensionId = '') {
  return props.enabledExtensionIds.includes(String(extensionId || '').trim().toLowerCase())
}

function displayStatus(extension = {}) {
  if (extension.status !== 'available') return extension.status
  return isEnabled(extension.id) ? extension.status : 'disabled'
}

function extensionDisplayName(extension = {}) {
  return String(extension.name || extension.id || '').trim()
}

function extensionDescription(extension = {}) {
  const description = String(extension.description || '').trim()
  return description || t('No description provided')
}

function hasOptions(extension = {}) {
  return buildExtensionSettingGroups(extension).length > 0
}
</script>

<style scoped>
.extension-empty-row {
  padding: 16px;
  color: var(--text-muted);
  font-size: 12px;
}

.extension-empty-row.is-error {
  color: var(--error);
}
</style>
