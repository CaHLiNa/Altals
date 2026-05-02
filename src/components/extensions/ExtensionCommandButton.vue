<template>
  <UiButton
    variant="secondary"
    size="sm"
    :disabled="disabled"
    :loading="busy"
    :title="buttonTitle"
    :aria-label="buttonTitle"
    @click="start"
  >
    <template #leading>
      <IconBolt :size="14" />
    </template>
    {{ buttonLabel }}
  </UiButton>
</template>

<script setup>
import { computed, ref } from 'vue'
import { IconBolt } from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'
import { useToastStore } from '../../stores/toast'
import { useWorkspaceStore } from '../../stores/workspace'
import { buildExtensionCommandHostState } from '../../domains/extensions/extensionCommandHostState'
import UiButton from '../shared/ui/UiButton.vue'

const props = defineProps({
  action: { type: Object, default: null },
  target: { type: Object, required: true },
  settings: { type: Object, default: () => ({}) },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['started'])
const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const workspaceStore = useWorkspaceStore()
const toastStore = useToastStore()
const busy = ref(false)

const action = computed(() => props.action || null)
const commandId = computed(() => String(action.value?.commandId || '').trim())
const enabledExtensionIds = computed(() => new Set(extensionsStore.enabledExtensionIds))
const extension = computed(() =>
  action.value?.extensionId
    ? extensionsStore.registry.find((extension) =>
        extension.id === action.value.extensionId &&
        extension.status === 'available' &&
        enabledExtensionIds.value.has(extension.id)
      )
    : null
)
const label = computed(() => props.label || t(action.value?.title || 'Run extension action'))
const hostState = computed(() => {
  if (!action.value?.extensionId) return buildExtensionCommandHostState()
  return buildExtensionCommandHostState(
    extensionsStore.hostDiagnosticsFor(action.value.extensionId, workspaceStore.path || '')
  )
})
const buttonLabel = computed(() => hostState.value.blocked ? t(hostState.value.labelKey) : label.value)
const buttonTitle = computed(() => {
  if (hostState.value.blocked) {
    return t(hostState.value.messageKey, hostState.value.messageParams)
  }
  return label.value
})
const disabled = computed(() =>
  props.disabled ||
  busy.value ||
  !extension.value ||
  !commandId.value ||
  !action.value?.extensionId ||
  hostState.value.blocked
)

async function start() {
  if (disabled.value || busy.value) return
  busy.value = true
  try {
    const task = await extensionsStore.executeCommand(action.value, props.target, props.settings)
    emit('started', task)
    toastStore.show(t('Extension task started'), { type: 'success', duration: 2400 })
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to start extension task')), {
      type: 'error',
      duration: 4200,
    })
  } finally {
    busy.value = false
  }
}
</script>
