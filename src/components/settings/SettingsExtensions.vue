<template>
  <div class="settings-page extensions-page" :class="{ 'is-options-view': selectedExtension }">
    <h3 class="settings-section-title">{{ t('Extensions') }}</h3>

    <section v-if="showHostRuntimeNotice" class="settings-group">
      <div class="settings-group-title">{{ t('Extension Runtime') }}</div>
      <div class="settings-group-body">
        <ExtensionHostStatusSurface
          :title="hostRuntimeTitle"
          :badge="hostRuntimeBadge"
          :description="hostRuntimeDescription"
          :tone-class="hostRuntimeCardToneClass"
          :recovery-action="hostRecoveryAction"
          @recover="void triggerHostRecoveryAction()"
        >
          <template #actions-before>
            <UiButton
              v-if="showHostRuntimeRestartAction"
              variant="ghost"
              size="sm"
              :disabled="hostRuntimeRestartBusy"
              @click="void restartHostRuntime()"
            >
              {{ hostRuntimeRestartBusy ? t('Restarting...') : t('Restart Runtime') }}
            </UiButton>
          </template>
        </ExtensionHostStatusSurface>
      </div>
    </section>

    <section v-if="!selectedExtension" class="settings-group">
      <div class="extensions-group-heading">
        <h4 class="settings-group-title">{{ t('Loaded Extensions') }}</h4>
        <div class="extensions-page-actions">
          <button
            type="button"
            class="extensions-page-icon-button"
            :title="t('Refresh extensions')"
            :aria-label="t('Refresh extensions')"
            :disabled="extensionsStore.loadingRegistry"
            @click="refreshExtensionRegistry"
          >
            <IconRefresh :size="18" :stroke-width="1.9" />
          </button>
          <button
            type="button"
            class="extensions-page-icon-button"
            :title="t('Open extension install folder')"
            :aria-label="t('Open extension install folder')"
            @click="openExtensionInstallFolder"
          >
            <IconFolder :size="19" :stroke-width="1.9" />
          </button>
        </div>
      </div>
      <div class="settings-group-body">
        <div v-if="extensionsStore.loadingRegistry" class="extension-empty-row">
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
                :disabled="settingGroups(extension).length === 0"
                @click="openExtensionOptions(extension.id)"
              >
                <IconSettings :size="18" :stroke-width="1.85" />
              </button>
              <UiSwitch
                :model-value="isEnabled(extension.id)"
                :disabled="extension.status === 'invalid' || extension.status === 'blocked'"
                :title="t('Enable extension')"
                @update:model-value="(value) => extensionsStore.setExtensionEnabled(extension.id, value)"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <template v-else>
      <section class="settings-group extension-options-navigation">
        <div class="extensions-group-heading">
          <div class="extension-options-title">
            <button
              type="button"
              class="extension-card-icon-button"
              :title="t('Back to loaded extensions')"
              :aria-label="t('Back to loaded extensions')"
              @click="closeExtensionOptions"
            >
              <IconChevronLeft :size="18" :stroke-width="1.9" />
            </button>
          </div>
        </div>
      </section>

      <section v-if="selectedSettingGroups.length === 0 && selectedActionGroups.length === 0" class="settings-group">
        <h4 class="settings-group-title">{{ t('Extension options') }}</h4>
        <div class="settings-group-body">
          <div class="extension-empty-row">
            {{ t('This extension has no configurable options.') }}
          </div>
        </div>
      </section>

      <template v-else>
        <section
          v-for="group in selectedActionGroups"
          :key="`${selectedExtension.id}:action-group:${group.id}`"
          class="settings-group extension-options-settings-group"
        >
          <h4 class="settings-group-title">{{ t(group.title) }}</h4>
          <div class="settings-group-body extension-options-actions-list">
            <div
              v-for="action in group.actions"
              :key="`${selectedExtension.id}:action:${action.id}`"
              class="extension-options-actions-group"
            >
              <div class="extension-options-actions-copy">
                <div class="settings-row-title extension-setting-label-row">
                  <span>{{ t(action.title) }}</span>
                </div>
                <div class="extension-action-hint">
                  {{ actionMessage(action.id, action.description) }}
                </div>
              </div>
              <div class="extension-options-actions-bar">
                <UiButton
                  variant="secondary"
                  size="sm"
                  :disabled="isActionBusy(action.id)"
                  @click="void runExtensionSettingsAction(action)"
                >
                  {{ actionButtonLabel(action.id, action.title) }}
                </UiButton>
              </div>
            </div>
          </div>
        </section>

        <section
          v-for="group in selectedSettingGroups"
          :key="`${selectedExtension.id}:${group.id}`"
          class="settings-group extension-options-settings-group"
        >
          <h4 class="settings-group-title">{{ t(group.titleKey) }}</h4>
          <div class="settings-group-body">
            <div
              v-for="[key, setting] in group.entries"
              :key="`${selectedExtension.id}:${key}`"
              class="settings-row extension-setting-row"
            >
              <div class="settings-row-copy extension-setting-copy">
                <div class="settings-row-title extension-setting-label-row">
                  <span>{{ t(setting.label || humanizeSettingKey(key)) }}</span>
                </div>
              </div>
              <div class="settings-row-control extension-setting-control" :class="{ 'is-wide': isLongTextSetting(key, setting) }">
                <UiSwitch
                  v-if="setting.type === 'boolean'"
                  :model-value="Boolean(settingValue(selectedExtension, key))"
                  size="sm"
                  :title="t(setting.label || humanizeSettingKey(key))"
                  @update:model-value="(value) => updateSettingNow(selectedExtension.id, key, value)"
                />
                <UiSelect
                  v-else-if="settingOptions(setting).length"
                  :model-value="settingValue(selectedExtension, key)"
                  :options="settingOptions(setting)"
                  :placeholder="t(setting.label || humanizeSettingKey(key))"
                  @update:model-value="(value) => updateSettingNow(selectedExtension.id, key, value)"
                />
                <textarea
                  v-else-if="isLongTextSetting(key, setting)"
                  class="extension-setting-textarea"
                  :value="settingDraftValue(selectedExtension, key)"
                  spellcheck="false"
                  rows="4"
                  @input="(event) => updateSettingDraft(selectedExtension.id, key, event.target.value)"
                  @blur="() => flushSettingDraft(selectedExtension.id, key)"
                ></textarea>
                <UiInput
                  v-else
                  :model-value="settingDraftValue(selectedExtension, key)"
                  :type="inputTypeForSetting(key, setting)"
                  :placeholder="hasPersistedSecureSetting(selectedExtension, key) ? t('Saved') : ''"
                  :monospace="isTechnicalSetting(key)"
                  size="sm"
                  @update:model-value="(value) => updateSettingDraft(selectedExtension.id, key, coerceSettingValue(setting, value))"
                  @blur="() => flushSettingDraft(selectedExtension.id, key)"
                />
              </div>
            </div>
          </div>
        </section>
      </template>
    </template>

  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { IconChevronLeft, IconFolder, IconRefresh, IconSettings } from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'
import { useWorkspaceStore } from '../../stores/workspace'
import { useToastStore } from '../../stores/toast'
import { revealPathInFileManager } from '../../services/fileTreeSystem'
import UiButton from '../shared/ui/UiButton.vue'
import UiInput from '../shared/ui/UiInput.vue'
import UiSelect from '../shared/ui/UiSelect.vue'
import UiSwitch from '../shared/ui/UiSwitch.vue'
import ExtensionHostStatusSurface from '../extensions/ExtensionHostStatusSurface.vue'
import { useExtensionHostStatusPresentation } from '../../composables/useExtensionHostStatusPresentation'
import { buildExtensionHostStatusSurface } from '../../domains/extensions/extensionHostStatusSurface'
import {
  secureSettingInputType,
  shortExtensionSettingKey,
} from '../../domains/extensions/extensionSettingPresentation'

const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const workspaceStore = useWorkspaceStore()
const toastStore = useToastStore()
const extensions = computed(() => extensionsStore.registry)
const hostRuntimeRestartBusyKey = ref('')
const selectedExtensionId = ref('')
const settingDrafts = reactive({})
const savedSecureSettingDrafts = reactive({})
const settingSaveTimers = new Map()
const SETTING_SAVE_DELAY_MS = 360
const selectedExtension = computed(() =>
  extensions.value.find((extension) => extension.id === selectedExtensionId.value) || null
)
const selectedExtensionActionBusy = reactive({})
const selectedExtensionActionMessages = reactive({})
const selectedSettingGroups = computed(() =>
  selectedExtension.value ? settingGroups(selectedExtension.value) : []
)
function isEnabled(extensionId = '') {
  return extensionsStore.enabledExtensionIds.includes(String(extensionId || '').trim().toLowerCase())
}

function hostStatus() {
  return extensionsStore.hostStatus
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

function shortSettingKey(key = '') {
  return shortExtensionSettingKey(key)
}

const settingGroupDefinitions = [
  {
    id: 'basic',
    titleKey: 'Basic',
    hintKey: 'Host-managed plugin defaults.',
    keys: ['engine', 'service', 'sourceLang', 'targetLang'],
    match: (key) => ['engine', 'service', 'sourceLang', 'targetLang', 'targetLanguage'].includes(shortSettingKey(key)),
  },
  {
    id: 'model',
    titleKey: 'Model Access',
    hintKey: 'Host-managed model, endpoint, and secure credential values.',
    keys: [
      'modelBaseUrl',
      'apiUrl',
      'baseUrl',
      'endpoint',
      'modelApiKey',
      'apiKey',
      'model',
      'modelName',
      'mineruToken',
      'mineru',
      'paddleToken',
      'paddleOcrToken',
      'paddleocrToken',
      'paddleOcr',
      'paddleocr',
    ],
    match: (key) => {
      const normalized = shortSettingKey(key).toLowerCase()
      return normalized.includes('api') ||
        normalized.includes('model') ||
        normalized.includes('extension') ||
        normalized.includes('token') ||
        normalized.includes('secret')
    },
  },
  {
    id: 'output',
    titleKey: 'Output',
    hintKey: 'Generated PDF type and layout behavior.',
    keys: ['outputMode', 'translationMode', 'dualMode', 'noWatermark', 'ocr', 'autoOcr'],
    match: (key) => ['outputMode', 'translationMode', 'dualMode', 'noWatermark', 'ocr', 'autoOcr'].includes(shortSettingKey(key)),
  },
  {
    id: 'runtime',
    titleKey: 'Runtime',
    hintKey: 'Plugin runtime environment and local execution options.',
    keys: ['serverPort', 'pythonPath', 'enableVenv', 'envTool', 'enableMirror', 'skipInstall'],
    match: (key) => {
      const normalized = shortSettingKey(key).toLowerCase()
      return normalized.includes('server') ||
        normalized.includes('python') ||
        normalized.includes('venv') ||
        normalized.includes('env') ||
        normalized.includes('mirror') ||
        normalized.includes('install') ||
        normalized.includes('port')
    },
  },
  {
    id: 'performance',
    titleKey: 'Performance',
    hintKey: 'Plugin execution throughput controls.',
    keys: ['qps', 'poolSize', 'threadNum'],
    match: (key) => ['qps', 'poolSize', 'threadNum', 'chunkSize'].includes(shortSettingKey(key)),
  },
]

function settingEntries(extension = {}) {
  return Object.entries(extension.settingsSchema || {})
}

function settingsActions(extension = {}) {
  return Array.isArray(extension.settingsActions) ? extension.settingsActions : []
}

function settingSortAliases(key = '') {
  const shortKey = shortSettingKey(key)
  const normalized = shortKey.toLowerCase()
  const aliases = [String(key || ''), shortKey]
  if (normalized.includes('baseurl') || normalized.includes('apiurl') || normalized.includes('endpoint')) {
    aliases.push('modelBaseUrl')
  }
  if ((normalized.includes('apikey') || normalized.includes('api_key')) &&
    !normalized.includes('mineru') &&
    !normalized.includes('paddle')) {
    aliases.push('apiKey')
  }
  if (normalized === 'model' || normalized.includes('modelname')) aliases.push('model')
  if (normalized.includes('mineru')) aliases.push('mineru')
  if (normalized.includes('paddleocr') || normalized.includes('paddle')) aliases.push('paddleocr')
  return aliases
}

function sortSettingEntries(entries = [], orderedKeys = []) {
  const order = new Map(orderedKeys.map((key, index) => [key, index]))
  const sourceOrder = new Map(entries.map(([key], index) => [key, index]))
  const orderFor = (key = '') => {
    for (const alias of settingSortAliases(key)) {
      if (order.has(alias)) return order.get(alias)
    }
    return Number.MAX_SAFE_INTEGER
  }
  return [...entries].sort(([left], [right]) => {
    const normalizedLeftOrder = orderFor(left)
    const normalizedRightOrder = orderFor(right)
    if (normalizedLeftOrder !== normalizedRightOrder) return normalizedLeftOrder - normalizedRightOrder
    return (sourceOrder.get(left) ?? 0) - (sourceOrder.get(right) ?? 0)
  })
}

function settingGroups(extension = {}) {
  const remaining = new Map(settingEntries(extension))
  const groups = []
  for (const definition of settingGroupDefinitions) {
    const entries = []
    for (const [key, setting] of [...remaining.entries()]) {
      if (definition.match(key, setting)) {
        entries.push([key, setting])
        remaining.delete(key)
      }
    }
    if (entries.length) {
      groups.push({
        ...definition,
        entries: sortSettingEntries(entries, definition.keys),
      })
    }
  }
  if (remaining.size) {
    groups.push({
      id: 'advanced',
      titleKey: 'Advanced',
      hintKey: 'Less common plugin-specific options.',
      entries: sortSettingEntries([...remaining.entries()]),
    })
  }
  return groups
}

function settingValue(extension = {}, key = '') {
  return extensionsStore.configForExtension(extension)?.[key]
}

function settingDraftKey(extensionId = '', key = '') {
  return `${String(extensionId || '').trim().toLowerCase()}::${String(key || '').trim()}`
}

function settingDraftValue(extension = {}, key = '') {
  const draftKey = settingDraftKey(extension.id, key)
  if (Object.prototype.hasOwnProperty.call(settingDrafts, draftKey)) {
    return settingDrafts[draftKey]
  }
  if (Object.prototype.hasOwnProperty.call(savedSecureSettingDrafts, draftKey)) {
    return savedSecureSettingDrafts[draftKey]
  }
  return settingValue(extension, key)
}

function hasPersistedSecureSetting(extension = {}, key = '') {
  const setting = extension?.settingsSchema?.[key]
  if (setting?.secureStorage !== true) return false
  return String(settingValue(extension, key) ?? '').trim().length > 0
}

function settingOptions(setting = {}) {
  return Array.isArray(setting.options)
    ? setting.options.map((option) => ({
        value: option?.value,
        label: t(option?.label || String(option?.value ?? '')),
      }))
    : []
}

function coerceSettingValue(setting = {}, value = '') {
  if (setting.type === 'integer') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? value : parsed
  }
  if (setting.type === 'number') {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  return value
}

function inputTypeForSetting(key = '', setting = {}) {
  return secureSettingInputType(key, setting)
}

function isLongTextSetting(key = '', setting = {}) {
  const normalized = shortSettingKey(key).toLowerCase()
  return normalized.includes('json') ||
    normalized.includes('extradata') ||
    String(setting.default ?? '').length > 80
}

function isTechnicalSetting(key = '') {
  const normalized = shortSettingKey(key).toLowerCase()
  return normalized.includes('url') ||
    normalized.includes('path') ||
    normalized.includes('json') ||
    normalized.includes('model')
}

function humanizeSettingKey(key = '') {
  return (String(key || '')
    .split('.')
    .pop() || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

async function persistSettingDraft(extensionId = '', key = '') {
  const normalizedExtensionId = String(extensionId || '').trim().toLowerCase()
  const normalizedKey = String(key || '').trim()
  const draftKey = settingDraftKey(normalizedExtensionId, normalizedKey)
  if (!normalizedExtensionId || !normalizedKey) return
  if (settingSaveTimers.has(draftKey)) {
    clearTimeout(settingSaveTimers.get(draftKey))
    settingSaveTimers.delete(draftKey)
  }
  if (!Object.prototype.hasOwnProperty.call(settingDrafts, draftKey)) return
  const value = settingDrafts[draftKey]
  try {
    const extension = extensions.value.find((entry) => entry.id === normalizedExtensionId)
    const setting = extension?.settingsSchema?.[normalizedKey]
    await extensionsStore.setExtensionConfigValue(normalizedExtensionId, normalizedKey, value)
    if (setting?.secureStorage === true) {
      savedSecureSettingDrafts[draftKey] = value
      delete settingDrafts[draftKey]
      return
    }
    const savedValue = extension ? settingValue(extension, normalizedKey) : value
    if (String(savedValue ?? '') === String(value ?? '')) {
      delete settingDrafts[draftKey]
      return
    }
    throw new Error(t('Extension setting was not saved'))
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to save extension setting')), {
      type: 'error',
      duration: 4200,
    })
  }
}

function updateSettingDraft(extensionId = '', key = '', value = '') {
  const normalizedExtensionId = String(extensionId || '').trim().toLowerCase()
  const normalizedKey = String(key || '').trim()
  const draftKey = settingDraftKey(normalizedExtensionId, normalizedKey)
  if (!normalizedExtensionId || !normalizedKey) return
  delete savedSecureSettingDrafts[draftKey]
  settingDrafts[draftKey] = value
  if (settingSaveTimers.has(draftKey)) {
    clearTimeout(settingSaveTimers.get(draftKey))
  }
  settingSaveTimers.set(draftKey, setTimeout(() => {
    void persistSettingDraft(normalizedExtensionId, normalizedKey)
  }, SETTING_SAVE_DELAY_MS))
}

function flushSettingDraft(extensionId = '', key = '') {
  void persistSettingDraft(extensionId, key)
}

function updateSettingNow(extensionId = '', key = '', value = '') {
  const normalizedExtensionId = String(extensionId || '').trim().toLowerCase()
  const normalizedKey = String(key || '').trim()
  if (!normalizedExtensionId || !normalizedKey) return
  extensionsStore.setExtensionConfigValue(normalizedExtensionId, normalizedKey, value).catch((error) => {
    toastStore.show(error?.message || String(error || t('Failed to save extension setting')), {
      type: 'error',
      duration: 4200,
    })
  })
}

function openExtensionOptions(extensionId = '') {
  const normalized = String(extensionId || '').trim()
  if (!normalized) return
  selectedExtensionId.value = normalized
}

function closeExtensionOptions() {
  selectedExtensionId.value = ''
}

const selectedActionGroups = computed(() => {
  const extension = selectedExtension.value
  if (!extension) return []
  const groups = new Map()
  for (const action of settingsActions(extension)) {
    const groupId = String(action.group || 'actions').trim() || 'actions'
    const groupTitle = String(action.groupTitle || action.group || 'Actions').trim() || 'Actions'
    if (!groups.has(groupId)) {
      groups.set(groupId, { id: groupId, title: groupTitle, actions: [] })
    }
    groups.get(groupId).actions.push(action)
  }
  return [...groups.values()]
})

function actionBusyKey(actionId = '') {
  const extensionId = String(selectedExtension.value?.id || '').trim().toLowerCase()
  return `${extensionId}:${String(actionId || '').trim()}`
}

function isActionBusy(actionId = '') {
  return Boolean(selectedExtensionActionBusy[actionBusyKey(actionId)])
}

function actionMessage(actionId = '', fallback = '') {
  const key = actionBusyKey(actionId)
  return selectedExtensionActionMessages[key] || t(fallback || '')
}

function actionButtonLabel(actionId = '', fallback = '') {
  if (isActionBusy(actionId)) return t('Running...')
  return t(fallback || '')
}

async function runExtensionSettingsAction(action = {}) {
  const extensionId = String(selectedExtension.value?.id || '').trim().toLowerCase()
  const commandId = String(action.commandId || '').trim()
  const busyKey = actionBusyKey(action.id)
  if (!extensionId || !commandId || selectedExtensionActionBusy[busyKey]) return
  selectedExtensionActionBusy[busyKey] = true
  try {
    const task = await extensionsStore.executeCommand({
      extensionId,
      commandId,
    }, {
      kind: 'workspace',
      referenceId: '',
      path: workspaceStore.path || '',
    })
    const isFailed = String(task?.state || '').trim().toLowerCase() === 'failed'
    if (isFailed) {
      throw new Error(String(task?.error || t('Action failed')))
    }
    selectedExtensionActionMessages[busyKey] = String(task?.progress?.label || task?.state || '')
    toastStore.show(selectedExtensionActionMessages[busyKey] || t('Action completed'), {
      type: 'success',
      duration: 3200,
    })
  } catch (error) {
    selectedExtensionActionMessages[busyKey] = error?.message || String(error || t('Action failed'))
    toastStore.show(selectedExtensionActionMessages[busyKey], {
      type: 'error',
      duration: 4600,
    })
  } finally {
    selectedExtensionActionBusy[busyKey] = false
  }
}

const hostRuntimeSlots = computed(() =>
  Array.isArray(hostStatus().activeRuntimeSlots) ? hostStatus().activeRuntimeSlots : []
)
const showHostRuntimeRestartAction = computed(() => hostRuntimeSlots.value.length > 0)
const hostRuntimeRestartBusy = computed(() => Boolean(hostRuntimeRestartBusyKey.value))
const hostStatusSurface = computed(() =>
  buildExtensionHostStatusSurface({
    pendingPromptOwner: hostStatus().pendingPromptOwner,
    slotCount: hostRuntimeSlots.value.length,
  }, {
    hostRuntimeSlots: hostRuntimeSlots.value,
  })
)
const {
  presentation: hostStatusPresentation,
  recoveryAction: hostRecoveryAction,
  triggerRecoveryAction: triggerHostRecoveryAction,
} = useExtensionHostStatusPresentation(() => hostStatusSurface.value)
const hostRuntimeBadge = computed(() => hostStatusPresentation.value.badge)
const hostRuntimeTitle = computed(() => hostStatusPresentation.value.title)
const hostRuntimeDescription = computed(() => hostStatusPresentation.value.description)
const hostRuntimeCardToneClass = computed(() => hostStatusPresentation.value.toneClass)
const showHostRuntimeNotice = computed(() =>
  hostRecoveryAction.value.available ||
    hostRuntimeCardToneClass.value === 'is-warning' ||
    hostRuntimeCardToneClass.value === 'is-info'
)

async function restartHostRuntimeSlot(slot = {}) {
  const extensionId = String(slot?.extensionId || '').trim()
  const workspaceRoot = String(slot?.workspaceRoot || '').trim()
  const busyKey = `${extensionId}@${workspaceRoot}`
  if (!extensionId || !workspaceRoot || hostRuntimeRestartBusyKey.value) return
  hostRuntimeRestartBusyKey.value = busyKey
  try {
    await extensionsStore.restartExtensionRuntime(extensionId, workspaceRoot)
    toastStore.show(t('Restarted the selected extension runtime'), {
      type: 'success',
      duration: 2600,
    })
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to restart extension runtime')), {
      type: 'error',
      duration: 4200,
    })
  } finally {
    if (hostRuntimeRestartBusyKey.value === busyKey) {
      hostRuntimeRestartBusyKey.value = ''
    }
  }
}

async function restartHostRuntime() {
  for (const slot of hostRuntimeSlots.value) {
    if (hostRuntimeRestartBusyKey.value) break
    await restartHostRuntimeSlot(slot)
  }
}

async function refreshExtensionRegistry() {
  await extensionsStore.refreshRegistry().catch(() => {})
  await extensionsStore.refreshTasks().catch(() => {})
}

async function openExtensionInstallFolder() {
  try {
    const globalConfigDir = await workspaceStore.ensureGlobalConfigDir()
    if (!globalConfigDir) throw new Error(t('Extension install folder is unavailable'))
    await revealPathInFileManager({ path: `${globalConfigDir}/extensions` })
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to open extension install folder')), {
      type: 'error',
      duration: 3600,
    })
  }
}

onMounted(async () => {
  await refreshExtensionRegistry()
})

onBeforeUnmount(() => {
  for (const draftKey of Object.keys(settingDrafts)) {
    const [extensionId, ...keyParts] = draftKey.split('::')
    const key = keyParts.join('::')
    void persistSettingDraft(extensionId, key)
  }
  for (const timer of settingSaveTimers.values()) {
    clearTimeout(timer)
  }
  settingSaveTimers.clear()
})
</script>

<style scoped>
.extensions-page {
  gap: 32px;
}

.extensions-page.is-options-view {
  gap: 14px;
}

.extensions-group-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.extensions-group-heading .settings-group-title {
  margin-bottom: 8px;
  flex: 1 1 auto;
}

.extensions-page-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 8px 4px 8px 0;
  flex: 0 0 auto;
}

.extensions-page-icon-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.extensions-page-icon-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--sidebar-item-hover) 70%, transparent);
  color: var(--text-primary);
}

.extensions-page-icon-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent);
  outline-offset: 2px;
}

.extensions-page-icon-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.extension-options-title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  flex: 1 1 auto;
}

.extension-options-title .extension-card-icon-button {
  margin: 0 0 0 4px;
}

.extension-empty-row {
  padding: 16px;
  color: var(--text-muted);
  font-size: 12px;
}

.extension-host-runtime-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--border) 34%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-base) 86%, transparent);
}

.extension-host-runtime-card.is-active {
  border-color: color-mix(in srgb, var(--accent) 24%, var(--border));
}

.extension-host-runtime-card__meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.extension-host-runtime-card__meta-item {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 8px;
  font-size: 11px;
  line-height: 1.4;
}

.extension-host-runtime-slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.extension-host-runtime-slots__title {
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
}

.extension-host-runtime-slots__empty {
  color: var(--text-muted);
  font-size: 11px;
}

.extension-host-runtime-slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--border) 26%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-raised) 74%, transparent);
}

.extension-host-runtime-slot__copy {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
}

.extension-host-runtime-slot__title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.extension-host-runtime-slot__workspace {
  color: var(--text-muted);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.extension-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}

.extension-card:last-child {
  border-bottom: none;
}

.extension-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 16px 18px;
}

.extension-copy {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extension-title-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.extension-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.extension-status,
.extension-scope,
.extension-chip {
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

.extension-status.is-available {
  color: var(--success);
}

.extension-status.is-invalid,
.extension-status.is-blocked {
  color: var(--error);
}

.extension-status.is-missingRuntime {
  color: var(--warning, #a56a00);
}

.extension-status.is-disabled {
  color: var(--text-muted);
}

.extension-description,
.extension-message {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.extension-message.is-error {
  color: var(--error);
}

.extension-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.extension-meta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 2px;
}

.extension-meta-list {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 8px;
  font-size: 11px;
  line-height: 1.35;
}

.extension-meta-item {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  gap: 8px;
  font-size: 11px;
  line-height: 1.35;
}

.extension-meta-label {
  color: var(--text-muted);
}

.extension-meta-value {
  min-width: 0;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.extension-controls {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding-top: 0;
}

.extension-card-icon-button {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    opacity 0.15s ease;
}

.extension-card-icon-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--sidebar-item-hover) 70%, transparent);
  color: var(--text-primary);
}

.extension-card-icon-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 65%, transparent);
  outline-offset: 2px;
}

.extension-card-icon-button:disabled {
  cursor: default;
  opacity: 0.38;
}

.extension-setting-row {
  min-height: 52px;
}

.extension-setting-copy {
  gap: 2px;
}

.extension-setting-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.extension-setting-badge {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--success) 12%, var(--surface-raised));
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.extension-setting-control {
  width: min(100%, var(--settings-select-width, 280px));
}

.extension-setting-control.is-wide {
  width: min(100%, 360px);
}

.extension-options-actions-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.extension-options-actions-copy {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
}

.extension-action-hint {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.extension-options-actions-bar {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
}

.extension-setting-textarea {
  width: 100%;
  min-height: 86px;
  resize: vertical;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--border-subtle) 88%, transparent);
  border-radius: 6px;
  padding: 8px 10px;
  background: color-mix(in srgb, var(--surface-base) 86%, transparent);
  color: var(--text-primary);
  font: 12px/1.45 var(--font-mono);
  outline: none;
}

.extension-setting-textarea:focus {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border));
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--accent) 30%, transparent),
    0 0 0 1px var(--accent);
}

@media (max-width: 720px) {
  .extension-header {
    flex-direction: column;
  }

  .extension-setting-row {
    align-items: stretch;
    flex-direction: column;
    gap: 6px;
  }

  .extension-setting-control {
    width: 100%;
    justify-content: stretch;
  }

  .extension-options-actions-group {
    align-items: stretch;
    flex-direction: column;
  }

  .extension-options-actions-bar {
    width: 100%;
  }

  .extension-options-actions-bar :deep(.ui-button) {
    width: 100%;
  }

  .extension-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
