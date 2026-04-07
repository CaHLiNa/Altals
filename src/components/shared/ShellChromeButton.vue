<template>
  <UiButton
    type="button"
    variant="ghost"
    :size="size"
    icon-only
    class="shell-chrome-button"
    :class="{ 'is-active': active }"
    :title="title"
    :aria-label="ariaLabel || title"
    :disabled="disabled"
  >
    <slot />
  </UiButton>
</template>

<script setup>
import UiButton from './ui/UiButton.vue'

defineProps({
  active: { type: Boolean, default: false },
  title: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  size: { type: String, default: 'icon-md' },
})
</script>

<style scoped>
.shell-chrome-button {
  position: relative;
  opacity: 1;
  border-radius: 6px;
  color: var(--text-muted);
  transition:
    background-color 140ms ease,
    color 140ms ease,
    border-color 140ms ease,
    box-shadow 140ms ease;
}

.shell-chrome-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface-hover) 34%, transparent);
  color: var(--text-primary);
}

.shell-chrome-button.is-active {
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
  color: var(--text-primary);
  box-shadow: none;
}

.shell-chrome-button.is-active::before {
  display: none;
}
</style>
