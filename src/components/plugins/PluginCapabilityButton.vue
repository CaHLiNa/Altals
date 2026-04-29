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
import { usePluginsStore } from '../../stores/plugins'
import { useToastStore } from '../../stores/toast'
import UiButton from '../shared/ui/UiButton.vue'

const props = defineProps({
  capability: { type: String, required: true },
  target: { type: Object, required: true },
  settings: { type: Object, default: () => ({}) },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['started'])
const { t } = useI18n()
const pluginsStore = usePluginsStore()
const toastStore = useToastStore()
const busy = ref(false)

const provider = computed(() => pluginsStore.defaultProviderForCapability(props.capability))
const label = computed(() => props.label || t('Translate PDF'))
const disabled = computed(() => props.disabled || !provider.value)

async function start() {
  if (disabled.value || busy.value) return
  busy.value = true
  try {
    const job = await pluginsStore.startCapabilityJob(props.capability, props.target, props.settings)
    emit('started', job)
    toastStore.show(t('Plugin job started'), { type: 'success', duration: 2400 })
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to start plugin job')), {
      type: 'error',
      duration: 4200,
    })
  } finally {
    busy.value = false
  }
}
</script>
