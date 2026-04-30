<template>
  <div v-if="actions.length > 0" class="extension-action-buttons">
    <ExtensionCapabilityButton
      v-for="action in actions"
      :key="`${action.extensionId}:${action.id}`"
      :action="action"
      :target="target"
      :settings="settings"
      :disabled="disabled"
      @started="$emit('started', $event)"
    />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useExtensionsStore } from '../../stores/extensions'
import ExtensionCapabilityButton from './ExtensionCapabilityButton.vue'

const props = defineProps({
  surface: { type: String, required: true },
  target: { type: Object, required: true },
  settings: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

defineEmits(['started'])

const extensionsStore = useExtensionsStore()
const actions = computed(() => extensionsStore.actionsForSurface(props.surface))

onMounted(() => {
  void extensionsStore.refreshRegistry().catch(() => {})
  void extensionsStore.refreshTasks().catch(() => {})
})
</script>

<style scoped>
.extension-action-buttons {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
</style>
