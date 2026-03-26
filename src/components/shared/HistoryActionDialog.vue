<template>
  <div v-if="visible" class="history-action-dialog" @click.self="$emit('close')">
    <div class="history-action-dialog-surface">
      <div class="history-action-dialog-title">
        {{ title }}
      </div>
      <div class="history-action-dialog-copy">
        {{ description }}
      </div>
      <div class="history-action-dialog-actions">
        <UiButton
          v-if="showCancel"
          variant="secondary"
          size="sm"
          :disabled="busy"
          @click="$emit('close')"
        >
          {{ cancelLabel }}
        </UiButton>
        <UiButton :variant="confirmVariant" size="sm" :disabled="busy" @click="$emit('confirm')">
          {{ busy ? busyLabel : confirmLabel }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import UiButton from './ui/UiButton.vue'

defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  confirmLabel: { type: String, default: 'OK' },
  cancelLabel: { type: String, default: 'Cancel' },
  busyLabel: { type: String, default: 'Working...' },
  confirmVariant: { type: String, default: 'primary' },
  busy: { type: Boolean, default: false },
  showCancel: { type: Boolean, default: true },
})

defineEmits(['confirm', 'close'])
</script>

<style scoped>
.history-action-dialog {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  background: color-mix(in srgb, var(--overlay-backdrop) 82%, transparent);
}

.history-action-dialog-surface {
  width: min(420px, 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  padding: var(--space-4);
}

.history-action-dialog-title {
  color: var(--text-primary);
  font-size: var(--ui-font-body);
  font-weight: 600;
}

.history-action-dialog-copy {
  margin-top: var(--space-2);
  color: var(--text-muted);
  font-size: var(--ui-font-caption);
  line-height: 1.55;
  white-space: pre-wrap;
}

.history-action-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
