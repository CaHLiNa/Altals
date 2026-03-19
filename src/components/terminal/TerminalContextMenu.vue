<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[120]" @mousedown="emit('close')">
      <div
        class="terminal-context-menu fixed min-w-[180px] rounded-md border py-1"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @mousedown.stop
      >
        <button
          v-for="item in items"
          :key="item.key"
          class="terminal-context-item"
          type="button"
          :disabled="item.disabled"
          @click="emit('select', item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'select'])
</script>

<style scoped>
.terminal-context-menu {
  background: color-mix(in srgb, var(--bg-secondary) 98%, transparent);
  border-color: color-mix(in srgb, var(--border) 88%, transparent);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.28);
}

.terminal-context-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--fg-primary);
  font-size: var(--ui-font-label);
  text-align: left;
  padding: 7px 12px;
}

.terminal-context-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

.terminal-context-item:disabled {
  color: var(--fg-muted);
}
</style>
