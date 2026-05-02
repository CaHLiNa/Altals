<template>
  <div class="settings-page extensions-page">
    <div class="extensions-page-header">
      <h3 class="settings-section-title">{{ t('Extensions') }}</h3>
      <UiButton
        variant="secondary"
        size="sm"
        :disabled="extensionsStore.loadingRegistry"
        @click="refreshExtensionRegistry"
      >
        {{ t('Refresh Extension Registry') }}
      </UiButton>
    </div>

    <section class="settings-group">
      <div class="settings-group-title">{{ t('Extension Host Runtime') }}</div>
      <div class="settings-group-body">
        <div class="extension-host-runtime-card" :class="hostRuntimeCardToneClass">
          <div class="extension-host-runtime-card__header">
            <div class="extension-host-runtime-card__copy">
              <div class="extension-host-runtime-card__title-row">
                <div class="extension-host-runtime-card__title">{{ hostRuntimeTitle }}</div>
                <span class="extension-host-runtime-card__badge">{{ hostRuntimeBadge }}</span>
              </div>
              <div class="extension-host-runtime-card__description">
                {{ hostRuntimeDescription }}
              </div>
            </div>
            <div class="extension-host-runtime-card__actions">
              <UiButton
                v-if="showHostRuntimeRestartAction"
                variant="ghost"
                size="sm"
                :disabled="hostRuntimeRestartBusy"
                @click="void restartHostRuntime()"
              >
                {{ hostRuntimeRestartBusy ? t('Restarting...') : t('Restart Runtime') }}
              </UiButton>
              <UiButton
                v-if="showHostPromptRecoveryAction"
                variant="ghost"
                size="sm"
                :disabled="hostPromptRecoveryBusy"
                @click="void recoverHostPrompt()"
              >
                {{ hostPromptRecoveryBusy ? t('Cancelling...') : t('Cancel Prompt') }}
              </UiButton>
              <UiButton
                variant="secondary"
                size="sm"
                :disabled="extensionsStore.loadingRegistry"
                @click="refreshExtensionRegistry"
              >
                {{ t('Refresh Host Status') }}
              </UiButton>
            </div>
          </div>
          <div class="extension-host-runtime-card__meta">
            <div class="extension-host-runtime-card__meta-item">
              <span class="extension-meta-label">{{ t('Runtime') }}</span>
              <span class="extension-meta-value">{{ hostRuntimeName }}</span>
            </div>
            <div class="extension-host-runtime-card__meta-item">
              <span class="extension-meta-label">{{ t('Pending Prompt Owner') }}</span>
              <span class="extension-meta-value">{{ hostPromptOwnerSummary }}</span>
            </div>
          </div>
          <div class="extension-host-runtime-slots">
            <div class="extension-host-runtime-slots__title">{{ t('Active Runtime Slots') }}</div>
            <div v-if="hostRuntimeSlots.length === 0" class="extension-host-runtime-slots__empty">
              {{ t('No active runtime slots') }}
            </div>
            <div
              v-for="slot in hostRuntimeSlots"
              :key="`${slot.extensionId}@${slot.workspaceRoot}`"
              class="extension-host-runtime-slot"
            >
              <div class="extension-host-runtime-slot__copy">
                <div class="extension-host-runtime-slot__title">
                  {{ slot.extensionId }}
                </div>
                <div class="extension-host-runtime-slot__workspace">
                  {{ slot.workspaceRoot || '/' }}
                </div>
              </div>
              <UiButton
                variant="ghost"
                size="sm"
                :disabled="hostRuntimeRestartBusyKey === `${slot.extensionId}@${slot.workspaceRoot}`"
                @click="void restartHostRuntimeSlot(slot)"
              >
                {{ hostRuntimeRestartBusyKey === `${slot.extensionId}@${slot.workspaceRoot}` ? t('Restarting...') : t('Restart Runtime') }}
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-group">
      <div class="settings-group-title">{{ t('Installed Extensions') }}</div>
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
                <span class="extension-name">{{ t(extension.name || extension.id) }}</span>
                <span class="extension-status" :class="`is-${displayStatus(extension)}`">{{ t(displayStatus(extension)) }}</span>
                <span class="extension-scope">{{ t(extension.scope) }}</span>
              </div>
              <div class="extension-description">{{ t(extension.description || extension.id) }}</div>
              <div class="extension-meta-grid">
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Manifest') }}</span>
                  <span class="extension-meta-value">{{ extension.manifestFormat || t('Not configured') }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Entrypoint') }}</span>
                  <span class="extension-meta-value">
                    {{ extension.main || extension.runtime?.command || t('Not configured') }}
                  </span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Runtime') }}</span>
                  <span class="extension-meta-value">{{ extension.runtime?.runtimeType || t('Not configured') }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Runtime Status') }}</span>
                  <span class="extension-meta-value">{{ runtimeStatus(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Runtime Commands') }}</span>
                  <span class="extension-meta-value">{{ runtimeCommandSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Runtime Views') }}</span>
                  <span class="extension-meta-value">{{ runtimeViewSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Runtime Actions') }}</span>
                  <span class="extension-meta-value">{{ runtimeActionSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Runtime Capabilities') }}</span>
                  <span class="extension-meta-value">{{ runtimeCapabilitySummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Bootstrap Capabilities') }}</span>
                  <span class="extension-meta-value">{{ bootstrapCapabilitySummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Bootstrap Commands') }}</span>
                  <span class="extension-meta-value">{{ commandSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Bootstrap Keybindings') }}</span>
                  <span class="extension-meta-value">{{ keybindingSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Bootstrap Views') }}</span>
                  <span class="extension-meta-value">{{ viewSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Permissions') }}</span>
                  <span class="extension-meta-value">{{ permissionSummary(extension) }}</span>
                </div>
                <div class="extension-meta-item">
                  <span class="extension-meta-label">{{ t('Secure Settings') }}</span>
                  <span class="extension-meta-value">{{ secureSettingSummary(extension) }}</span>
                </div>
              </div>
              <div v-if="runtimeReason(extension)" class="extension-meta-list">
                <span class="extension-meta-label">{{ t('Runtime Activation') }}</span>
                <span class="extension-meta-value">{{ runtimeReason(extension) }}</span>
              </div>
              <div v-if="extension.activationEvents?.length" class="extension-meta-list">
                <span class="extension-meta-label">{{ t('Activation Events') }}</span>
                <span class="extension-meta-value">{{ extension.activationEvents.join(' · ') }}</span>
              </div>
              <div class="extension-meta-list">
                <span class="extension-meta-label">{{ t('Plugin Model') }}</span>
                <span class="extension-meta-value">
                  {{ t('Runtime registration first. Manifest metadata is only bootstrap information.') }}
                </span>
              </div>
              <div class="extension-meta-list">
                <span class="extension-meta-label">{{ t('Usage Surface') }}</span>
                <span class="extension-meta-value">
                  {{ t('Configure plugins here, then use them from the document right sidebar.') }}
                </span>
              </div>
              <div class="extension-chip-row">
                <span v-for="capability in extension.capabilities" :key="capability" class="extension-chip">
                  {{ capability }}
                </span>
              </div>
              <div v-if="capabilityActions(extension).length" class="extension-capability-list">
                <section
                  v-for="capability in capabilityActions(extension)"
                  :key="`${extension.id}:${capability.id}`"
                  class="extension-capability-card"
                >
                  <div class="extension-capability-card-header">
                    <div class="extension-capability-card-copy">
                      <div class="extension-capability-card-title-row">
                        <div class="extension-capability-card-title">{{ capability.id }}</div>
                        <span
                          class="extension-capability-card-status"
                          :class="capabilityStatusClass(extension, capability)"
                        >
                          {{ capabilityStatusLabel(extension, capability) }}
                        </span>
                      </div>
                      <div class="extension-capability-card-message">
                        {{ capabilityStatusMessage(extension, capability) }}
                      </div>
                    </div>
                    <UiButton
                      variant="ghost"
                      size="sm"
                      :disabled="capabilityBusyId === `${extension.id}:${capability.id}` || !capabilityCanRun(extension, capability)"
                      @click="runCapability(extension, capability)"
                    >
                      {{ capabilityButtonLabel(extension, capability) }}
                    </UiButton>
                  </div>
                  <div class="extension-capability-schema-grid">
                    <div class="extension-capability-schema-column">
                      <div class="extension-capability-schema-title">{{ t('Inputs') }}</div>
                      <div v-if="capabilityInputs(capability).length" class="extension-capability-schema-list">
                        <div
                          v-for="input in capabilityInputs(capability)"
                          :key="`${extension.id}:${capability.id}:input:${input.key}`"
                          class="extension-capability-schema-item"
                          :class="{ 'is-warning': input.blocking }"
                        >
                          <div class="extension-capability-schema-item-row">
                            <span class="extension-capability-schema-item-label">{{ input.label }}</span>
                            <span class="extension-chip">{{ capabilityTypeLabel(input) }}</span>
                            <span class="extension-chip">{{ capabilityRequiredLabel(input) }}</span>
                          </div>
                          <div v-if="capabilityDefinitionDetail(input)" class="extension-capability-schema-item-detail">
                            {{ capabilityDefinitionDetail(input) }}
                          </div>
                        </div>
                      </div>
                      <div v-else class="extension-capability-schema-empty">{{ t('No declared inputs') }}</div>
                    </div>
                    <div class="extension-capability-schema-column">
                      <div class="extension-capability-schema-title">{{ t('Outputs') }}</div>
                      <div v-if="capabilityOutputs(capability).length" class="extension-capability-schema-list">
                        <div
                          v-for="output in capabilityOutputs(capability)"
                          :key="`${extension.id}:${capability.id}:output:${output.key}`"
                          class="extension-capability-schema-item"
                        >
                          <div class="extension-capability-schema-item-row">
                            <span class="extension-capability-schema-item-label">{{ output.label }}</span>
                            <span class="extension-chip">{{ capabilityTypeLabel(output) }}</span>
                            <span class="extension-chip">{{ capabilityRequiredLabel(output) }}</span>
                          </div>
                          <div v-if="capabilityDefinitionDetail(output)" class="extension-capability-schema-item-detail">
                            {{ capabilityDefinitionDetail(output) }}
                          </div>
                        </div>
                      </div>
                      <div v-else class="extension-capability-schema-empty">{{ t('No declared outputs') }}</div>
                    </div>
                  </div>
                </section>
              </div>
              <div v-if="extension.errors.length" class="extension-message is-error">
                {{ extension.errors.map((message) => t(message)).join('; ') }}
              </div>
              <div v-else-if="extension.warnings.length" class="extension-message">
                {{ extension.warnings.map((message) => t(message)).join('; ') }}
              </div>
            </div>
            <div class="extension-controls">
              <span class="extension-enable-label">{{ t('Enabled') }}</span>
              <UiSwitch
                :model-value="isEnabled(extension.id)"
                :disabled="extension.status === 'invalid' || extension.status === 'blocked'"
                :title="t('Enable extension')"
                @update:model-value="(value) => extensionsStore.setExtensionEnabled(extension.id, value)"
              />
            </div>
          </div>

          <div v-if="settingGroups(extension).length" class="extension-settings-panel">
            <section
              v-for="group in settingGroups(extension)"
              :key="`${extension.id}:${group.id}`"
              class="extension-setting-group"
            >
              <div class="extension-setting-group-heading">
                <div class="extension-setting-group-title">{{ t(group.titleKey) }}</div>
                <div class="extension-setting-group-hint">{{ t(group.hintKey) }}</div>
              </div>
              <div class="extension-setting-list">
                <div
                  v-for="[key, setting] in group.entries"
                  :key="`${extension.id}:${key}`"
                  class="extension-setting-row"
                >
                  <div class="extension-setting-copy">
                    <div class="extension-setting-label-row">
                      <div class="extension-setting-label">{{ t(setting.label || humanizeSettingKey(key)) }}</div>
                      <span v-if="setting.secureStorage === true" class="extension-setting-badge">
                        {{ t('Keychain') }}
                      </span>
                    </div>
                    <div v-if="setting.description" class="extension-setting-hint">
                      {{ t(setting.description) }}
                    </div>
                    <div v-if="setting.secureStorage === true" class="extension-setting-hint">
                      {{ t('Stored securely in the app keychain.') }}
                    </div>
                  </div>
                  <div class="extension-setting-control" :class="{ 'is-wide': isLongTextSetting(key, setting) }">
                    <UiSwitch
                      v-if="setting.type === 'boolean'"
                      :model-value="Boolean(settingValue(extension, key))"
                      size="sm"
                      :title="t(setting.label || humanizeSettingKey(key))"
                      @update:model-value="(value) => updateSetting(extension.id, key, value)"
                    />
                    <UiSelect
                      v-else-if="settingOptions(setting).length"
                      :model-value="settingValue(extension, key)"
                      :options="settingOptions(setting)"
                      :placeholder="t(setting.label || humanizeSettingKey(key))"
                      @update:model-value="(value) => updateSetting(extension.id, key, value)"
                    />
                    <textarea
                      v-else-if="isLongTextSetting(key, setting)"
                      class="extension-setting-textarea"
                      :value="settingValue(extension, key)"
                      spellcheck="false"
                      rows="4"
                      @input="(event) => updateSetting(extension.id, key, event.target.value)"
                    ></textarea>
                    <UiInput
                      v-else
                      :model-value="settingValue(extension, key)"
                      :type="inputTypeForSetting(key, setting)"
                      :monospace="isTechnicalSetting(key)"
                      size="sm"
                      @update:model-value="(value) => updateSetting(extension.id, key, coerceSettingValue(setting, value))"
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useReferencesStore } from '../../stores/references'
import { useToastStore } from '../../stores/toast'
import UiButton from '../shared/ui/UiButton.vue'
import UiInput from '../shared/ui/UiInput.vue'
import UiSelect from '../shared/ui/UiSelect.vue'
import UiSwitch from '../shared/ui/UiSwitch.vue'
import { useExtensionHostStatusPresentation } from '../../composables/useExtensionHostStatusPresentation'
import { resolveExtensionTargetContext } from '../../domains/extensions/extensionTargetContext'
import { inspectExtensionCapability } from '../../domains/extensions/extensionCapabilitySchema'
import {
  buildExtensionCommandHostState,
  buildExtensionRuntimeBlockDescriptor,
  describeExtensionCommandError,
} from '../../domains/extensions/extensionCommandHostState'
import { buildExtensionHostStatusSurface } from '../../domains/extensions/extensionHostStatusSurface'
import {
  secureSettingInputType,
  shortExtensionSettingKey,
} from '../../domains/extensions/extensionSettingPresentation'

const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const workspaceStore = useWorkspaceStore()
const editorStore = useEditorStore()
const referencesStore = useReferencesStore()
const toastStore = useToastStore()
const extensions = computed(() => extensionsStore.registry)
const capabilityBusyId = ref('')
const hostRuntimeRestartBusyKey = ref('')
const capabilityWorkspaceReady = computed(() => Boolean(String(workspaceStore.path || '').trim()))
const capabilityInvokeTarget = computed(() =>
  resolveExtensionTargetContext({
    workspaceLeftSidebarPanel: workspaceStore.leftSidebarPanel,
    selectedReference: referencesStore.selectedReference,
    activeTab: editorStore.activeTab,
  })
)
function isEnabled(extensionId = '') {
  return extensionsStore.enabledExtensionIds.includes(String(extensionId || '').trim().toLowerCase())
}

function runtimeEntry(extension = {}) {
  return extensionsStore.runtimeEntryFor(extension.id)
}

function hostStatus() {
  return extensionsStore.hostStatus
}

function activeRuntimeSlotsForExtension(extension = {}) {
  const extensionId = String(extension?.id || '').trim().toLowerCase()
  return Array.isArray(hostStatus().activeRuntimeSlots)
    ? hostStatus().activeRuntimeSlots.filter((entry) => entry.extensionId === extensionId)
    : []
}

function hostDiagnostics(extension = {}) {
  return extensionsStore.hostDiagnosticsFor(extension.id, workspaceStore.path || '')
}

function displayStatus(extension = {}) {
  if (extension.status !== 'available') return extension.status
  return isEnabled(extension.id) ? extension.status : 'disabled'
}

function runtimeStatus(extension = {}) {
  const entry = runtimeEntry(extension)
  const slots = activeRuntimeSlotsForExtension(extension)
  if (entry.activated && slots.length > 1) {
    return t('activated') + ` · ${slots.length} workspaces`
  }
  return entry.activated ? t('activated') : t('idle')
}

function runtimeReason(extension = {}) {
  const entry = runtimeEntry(extension)
  const diagnostics = hostDiagnostics(extension)
  const parts = []
  if (entry.reason) parts.push(entry.reason)
  if (diagnostics.workspaceRoots.length > 0) {
    parts.push(diagnostics.workspaceRoots.join(' · '))
  }
  if (diagnostics.blockedByForeignPrompt) {
    parts.push(`blocked by ${diagnostics.pendingPromptOwner?.extensionId || ''} @ ${diagnostics.blockingPromptWorkspaceRoot || '/'}`)
  }
  if (diagnostics.ownsPendingPrompt) {
    parts.push(`waiting for prompt in ${diagnostics.pendingPromptWorkspaceRoot || '/'}`)
  }
  return parts.join(' · ')
}

function runtimeCommandSummary(extension = {}) {
  const entry = runtimeEntry(extension)
  if (Array.isArray(entry.registeredCommandDetails) && entry.registeredCommandDetails.length > 0) {
    return entry.registeredCommandDetails.map((command) => command.commandId).join(' · ')
  }
  if (Array.isArray(entry.registeredCommands) && entry.registeredCommands.length > 0) {
    return entry.registeredCommands.join(' · ')
  }
  return t('No runtime commands')
}

function runtimeViewSummary(extension = {}) {
  const entry = runtimeEntry(extension)
  if (Array.isArray(entry.registeredViewDetails) && entry.registeredViewDetails.length > 0) {
    return entry.registeredViewDetails.map((view) => view.id).join(' · ')
  }
  if (Array.isArray(entry.registeredViews) && entry.registeredViews.length > 0) {
    return entry.registeredViews.join(' · ')
  }
  return t('No runtime views')
}

function runtimeActionSummary(extension = {}) {
  const entry = runtimeEntry(extension)
  if (!Array.isArray(entry.registeredMenuActions) || entry.registeredMenuActions.length === 0) {
    return t('No runtime actions')
  }
  return entry.registeredMenuActions
    .map((action) => `${action.surface}:${action.commandId}`)
    .join(' · ')
}

function runtimeCapabilitySummary(extension = {}) {
  const entry = runtimeEntry(extension)
  if (!Array.isArray(entry.registeredCapabilities) || entry.registeredCapabilities.length === 0) {
    return t('No runtime capabilities')
  }
  return entry.registeredCapabilities.join(' · ')
}

function bootstrapCapabilitySummary(extension = {}) {
  const capabilities = Array.isArray(extension.contributedCapabilities)
    ? extension.contributedCapabilities.map((capability) => String(capability?.id || '').trim()).filter(Boolean)
    : []
  if (!capabilities.length) return t('No bootstrap capabilities')
  return capabilities.join(' · ')
}

function permissionSummary(extension = {}) {
  const permissions = extension.permissions || {}
  const labels = []
  if (permissions.readWorkspaceFiles) labels.push(t('workspace files'))
  if (permissions.readReferenceLibrary) labels.push(t('reference library'))
  if (permissions.spawnProcess) labels.push(t('local process'))
  return labels.join(' · ')
}

function secureSettingSummary(extension = {}) {
  const entries = Object.entries(extension.settingsSchema || {})
    .filter(([, setting]) => setting?.secureStorage === true)
    .map(([key, setting]) => t(setting?.label || humanizeSettingKey(key)))
  if (!entries.length) return t('No secure settings')
  return entries.join(' · ')
}

function commandSummary(extension = {}) {
  const commands = Array.isArray(extension.contributedCommands) ? extension.contributedCommands : []
  if (!commands.length) return t('No bootstrap commands')
  return commands.map((command) => command.commandId).join(' · ')
}

function keybindingSummary(extension = {}) {
  const keybindings = Array.isArray(extension.contributedKeybindings)
    ? extension.contributedKeybindings
    : []
  if (!keybindings.length) return t('No bootstrap keybindings')
  return keybindings
    .map((keybinding) => keybinding.mac || keybinding.key || keybinding.win || keybinding.linux)
    .filter(Boolean)
    .join(' · ')
}

function viewSummary(extension = {}) {
  const containers = Array.isArray(extension.contributedViewContainers)
    ? extension.contributedViewContainers
    : []
  const views = Array.isArray(extension.contributedViews)
    ? extension.contributedViews
    : []
  if (!containers.length && !views.length) return t('No bootstrap views')
  return [
    ...containers.map((container) => container.title || container.id),
    ...views.map((view) => view.title || view.id),
  ].join(' · ')
}

function capabilityActions(extension = {}) {
  const capabilities = Array.isArray(extension.contributedCapabilities)
    ? extension.contributedCapabilities
    : []
  return capabilities.filter((capability) => String(capability?.id || '').trim())
}

function capabilityHostState(extension = {}) {
  const descriptor = buildExtensionRuntimeBlockDescriptor(
    buildExtensionCommandHostState(hostDiagnostics(extension))
  )
  return {
    blocked: descriptor.blocked,
    label: descriptor.labelKey ? t(descriptor.labelKey) : '',
    message: descriptor.messageKey ? t(descriptor.messageKey, descriptor.messageParams) : '',
    tone: descriptor.tone,
  }
}

function capabilityButtonLabel(extension = {}, capability = {}) {
  const hostState = capabilityHostState(extension)
  if (hostState.blocked) return hostState.label
  return t('Run {name}', {
    name: String(capability?.id || '').trim(),
  })
}

function inspectCapability(capability = {}) {
  return inspectExtensionCapability(capability, capabilityInvokeTarget.value, {
    workspaceReady: capabilityWorkspaceReady.value,
  })
}

function capabilitySchemaReady(capability = {}) {
  return inspectCapability(capability).ready
}

function capabilityCanRun(extension = {}, capability = {}) {
  return capabilitySchemaReady(capability) && !capabilityHostState(extension).blocked
}

function capabilityStatusLabel(extension = {}, capability = {}) {
  const hostState = capabilityHostState(extension)
  if (hostState.blocked) return hostState.label
  return capabilitySchemaReady(capability) ? t('Ready') : t('Unavailable')
}

function capabilityStatusClass(extension = {}, capability = {}) {
  const hostState = capabilityHostState(extension)
  if (hostState.blocked) return hostState.tone
  return capabilitySchemaReady(capability) ? 'is-ready' : 'is-unavailable'
}

function capabilityStatusMessage(extension = {}, capability = {}) {
  const hostState = capabilityHostState(extension)
  if (hostState.blocked) return hostState.message
  const inspection = inspectCapability(capability)
  return t(inspection.messageKey, inspection.messageVars)
}

function capabilityInputs(capability = {}) {
  return inspectCapability(capability).inputs
}

function capabilityOutputs(capability = {}) {
  return inspectCapability(capability).outputs
}

function capabilityTypeLabel(definition = {}) {
  return t(definition.typeLabelKey || '')
}

function capabilityRequiredLabel(definition = {}) {
  return t(definition.required ? 'Required' : 'Optional')
}

function capabilityDefinitionDetail(definition = {}) {
  if (definition.blocking && definition.messageKey) {
    return t(definition.messageKey, definition.messageVars)
  }
  if (definition.detailKey) {
    return t(definition.detailKey, definition.detailVars)
  }
  if (definition.mediaType) {
    return definition.mediaType
  }
  return ''
}

async function runCapability(extension = {}, capability = {}) {
  const capabilityId = String(capability?.id || '').trim()
  if (!capabilityId || !capabilityCanRun(extension, capability)) return
  const busyId = `${extension.id}:${capabilityId}`
  capabilityBusyId.value = busyId
  try {
    await extensionsStore.invokeCapability({
      extensionId: extension.id,
      capabilityId,
    }, capabilityInvokeTarget.value)
    toastStore.show(t('Extension task started'), { type: 'success', duration: 2400 })
  } catch (error) {
    const commandError = describeExtensionCommandError(error, t('Failed to start extension task'))
    toastStore.show(
      commandError.messageKey
        ? t(commandError.messageKey, commandError.messageParams)
        : commandError.messageText || t('Failed to start extension task'),
      {
        type: commandError.type,
        duration: 4200,
      },
    )
  } finally {
    if (capabilityBusyId.value === busyId) {
      capabilityBusyId.value = ''
    }
  }
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
    keys: ['apiKey', 'apiUrl', 'model'],
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

function sortSettingEntries(entries = [], orderedKeys = []) {
  const order = new Map(orderedKeys.map((key, index) => [key, index]))
  return [...entries].sort(([left], [right]) => {
    const leftOrder = order.has(left) ? order.get(left) : Number.MAX_SAFE_INTEGER
    const leftShort = shortSettingKey(left)
    const rightShort = shortSettingKey(right)
    const normalizedLeftOrder = order.has(leftShort) ? order.get(leftShort) : leftOrder
    const rightOrder = order.has(right) ? order.get(right) : Number.MAX_SAFE_INTEGER
    const normalizedRightOrder = order.has(rightShort) ? order.get(rightShort) : rightOrder
    if (normalizedLeftOrder !== normalizedRightOrder) return normalizedLeftOrder - normalizedRightOrder
    return left.localeCompare(right)
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

function updateSetting(extensionId = '', key = '', value = '') {
  void extensionsStore.setExtensionConfigValue(extensionId, key, value)
}

const hostRuntimeName = computed(() => hostStatus().runtime || t('Not configured'))
const hostRuntimeSlots = computed(() =>
  Array.isArray(hostStatus().activeRuntimeSlots) ? hostStatus().activeRuntimeSlots : []
)
const hostStatusSurface = computed(() =>
  buildExtensionHostStatusSurface({
    pendingPromptOwner: hostStatus().pendingPromptOwner,
    slotCount: hostRuntimeSlots.value.length,
  }, {
    hostRuntimeSlots: hostRuntimeSlots.value,
  })
)
const hostPromptOwnerSummary = computed(() => {
  const owner = hostStatus().pendingPromptOwner
  if (!owner?.extensionId) return t('No pending prompt')
  return `${owner.extensionId}@${owner.workspaceRoot || '/'}`
})
const {
  presentation: hostStatusPresentation,
  promptRecoveryBusy: hostPromptRecoveryBusy,
  promptRecovery: hostPromptRecovery,
  cancelPromptRecovery: recoverHostPrompt,
} = useExtensionHostStatusPresentation(() => hostStatusSurface.value)
const hostRuntimeBadge = computed(() => hostStatusPresentation.value.badge)
const hostRuntimeTitle = computed(() => hostStatusPresentation.value.title)
const hostRuntimeDescription = computed(() => hostStatusPresentation.value.description)
const hostRuntimeCardToneClass = computed(() => hostStatusPresentation.value.toneClass)
const showHostPromptRecoveryAction = computed(() =>
  hostPromptRecovery.value.available
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

async function refreshExtensionRegistry() {
  await extensionsStore.refreshRegistry().catch(() => {})
  await extensionsStore.refreshTasks().catch(() => {})
}

onMounted(async () => {
  await refreshExtensionRegistry()
})
</script>

<style scoped>
.extensions-page {
  gap: 32px;
}

.extensions-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
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

.extension-host-runtime-card.is-warning {
  border-color: color-mix(in srgb, #d97706 32%, var(--border));
  background: color-mix(in srgb, #d97706 8%, var(--surface-base));
}

.extension-host-runtime-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.extension-host-runtime-card__copy {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
}

.extension-host-runtime-card__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.extension-host-runtime-card__title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.extension-host-runtime-card__badge {
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

.extension-host-runtime-card__description {
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.extension-host-runtime-card__actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
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

.extension-capability-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
}

.extension-capability-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 34%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-base) 82%, transparent);
  padding: 12px;
}

.extension-capability-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.extension-capability-card-copy {
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 4px;
}

.extension-capability-card-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.extension-capability-card-title {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.extension-capability-card-status {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  background: color-mix(in srgb, var(--surface-hover) 80%, transparent);
  color: var(--text-primary);
  font-size: 10px;
  font-weight: 600;
}

.extension-capability-card-status.is-ready {
  background: color-mix(in srgb, var(--success) 18%, transparent);
}

.extension-capability-card-status.is-warning {
  background: color-mix(in srgb, #d97706 18%, transparent);
}

.extension-capability-card-status.is-blocked {
  background: color-mix(in srgb, #d97706 18%, transparent);
}

.extension-capability-card-status.is-unavailable {
  background: color-mix(in srgb, var(--warning) 18%, transparent);
}

.extension-capability-card-message {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.extension-capability-schema-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.extension-capability-schema-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.extension-capability-schema-title {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.extension-capability-schema-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.extension-capability-schema-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--border) 28%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 24%, transparent);
  padding: 9px 10px;
}

.extension-capability-schema-item.is-warning {
  border-color: color-mix(in srgb, var(--warning) 38%, var(--border));
}

.extension-capability-schema-item-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.extension-capability-schema-item-label {
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
}

.extension-capability-schema-item-detail,
.extension-capability-schema-empty {
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.extension-meta-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin-top: 2px;
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
  gap: 8px;
  padding-top: 2px;
}

.extension-enable-label {
  font-size: 11px;
  color: var(--text-muted);
}

.extension-settings-panel {
  display: flex;
  flex-direction: column;
  border-top: 1px solid color-mix(in srgb, var(--border) 34%, transparent);
  background: transparent;
}

.extension-setting-group {
  display: flex;
  flex-direction: column;
  padding: 8px 0 0;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
}

.extension-setting-group:last-child {
  border-bottom: none;
}

.extension-setting-group-heading {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 18px 8px;
}

.extension-setting-group-title {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.35;
  letter-spacing: 0.03em;
}

.extension-setting-group-hint {
  margin-top: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.extension-setting-list {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.extension-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
  padding: 10px 18px;
  border-top: 1px solid color-mix(in srgb, var(--border) 24%, transparent);
  transition: background-color 0.15s ease;
}

.extension-setting-row:hover {
  background: color-mix(in srgb, var(--sidebar-item-hover) 18%, transparent);
}

.extension-setting-copy {
  min-width: 0;
  flex: 1 1 auto;
}

.extension-setting-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.extension-setting-label {
  font-size: 12px;
  color: var(--text-primary);
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

.extension-setting-hint {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-muted);
}

.extension-setting-control {
  flex: 0 0 auto;
  width: min(100%, var(--settings-select-width, 280px));
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.extension-setting-control.is-wide {
  width: min(100%, 360px);
  justify-content: stretch;
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

  .extension-capability-card-header {
    flex-direction: column;
    align-items: stretch;
  }

  .extension-capability-schema-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .extension-setting-group-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
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

  .extension-controls {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
