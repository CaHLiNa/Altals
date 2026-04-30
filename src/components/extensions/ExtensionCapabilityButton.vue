<template>
  <UiButton
    variant="secondary"
    size="sm"
    :disabled="disabled || busy"
    :loading="busy"
    @click="start"
  >
    <template #leading>
      <IconBolt :size="14" />
    </template>
    {{ label }}
  </UiButton>
</template>

<script setup>
import { computed, ref } from 'vue'
import { IconBolt } from '@tabler/icons-vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'
import { useToastStore } from '../../stores/toast'
import UiButton from '../shared/ui/UiButton.vue'

const props = defineProps({
  capability: { type: String, default: '' },
  action: { type: Object, default: null },
  target: { type: Object, required: true },
  settings: { type: Object, default: () => ({}) },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['started'])
const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const toastStore = useToastStore()
const busy = ref(false)

const action = computed(() => props.action || null)
const capability = computed(() => String(action.value?.capability || props.capability || '').trim())
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
const label = computed(() => props.label || t(action.value?.label || 'Run extension action'))
const disabled = computed(() => props.disabled || !extension.value || !capability.value || !action.value?.extensionId)

async function start() {
  if (disabled.value || busy.value) return
  busy.value = true
  try {
    const job = await extensionsStore.startExtensionAction(action.value, props.target, props.settings)
    emit('started', job)
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
