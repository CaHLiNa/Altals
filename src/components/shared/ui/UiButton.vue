<template>
  <button
    ref="buttonRef"
    :type="type"
    class="ui-button"
    :class="buttonClass"
    :title="title"
    :aria-label="ariaLabel || title"
    :disabled="isDisabled"
  >
    <span v-if="loading" class="ui-button-spinner" aria-hidden="true"></span>
    <template v-else-if="contentMode === 'raw'">
      <slot />
    </template>
    <template v-else>
      <span v-if="$slots.leading" class="ui-button-leading">
        <slot name="leading" />
      </span>
      <span v-if="!iconOnly" class="ui-button-label">
        <slot />
      </span>
      <slot v-else />
      <span v-if="$slots.trailing && !iconOnly" class="ui-button-trailing">
        <slot name="trailing" />
      </span>
    </template>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  variant: {
    type: String,
    default: 'secondary',
  },
  size: {
    type: String,
    default: 'md',
  },
  type: {
    type: String,
    default: 'button',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  block: {
    type: Boolean,
    default: false,
  },
  iconOnly: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: false,
  },
  contentMode: {
    type: String,
    default: 'label',
  },
})

const buttonRef = ref(null)
const isDisabled = computed(() => props.disabled || props.loading)
const buttonClass = computed(() => [
  `ui-button--${props.variant}`,
  `ui-button--${props.size}`,
  {
    'is-block': props.block,
    'is-icon-only': props.iconOnly,
    'is-loading': props.loading,
    'is-active': props.active,
    'is-raw-content': props.contentMode === 'raw',
  },
])

defineExpose({
  el: buttonRef,
  focus: () => buttonRef.value?.focus(),
  blur: () => buttonRef.value?.blur(),
  click: () => buttonRef.value?.click(),
  getBoundingClientRect: () => buttonRef.value?.getBoundingClientRect?.(),
})
</script>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-weight: var(--font-weight-medium);
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease,
    opacity 140ms ease;
}

.ui-button:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-ring) 52%, transparent);
}

.ui-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.ui-button--sm {
  min-height: 34px;
  padding: 0 14px;
  font-size: var(--ui-font-label);
}

.ui-button--md {
  min-height: 38px;
  padding: 0 15px;
  font-size: var(--ui-font-body);
}

.ui-button--lg {
  min-height: 44px;
  padding: 0 20px;
  font-size: var(--ui-font-body);
}

.ui-button--icon-sm {
  width: 35px;
  height: 35px;
  padding: 0;
  border-radius: 12px;
}

.ui-button--icon-xs {
  width: 27px;
  height: 27px;
  padding: 0;
  border-radius: 9px;
}

.ui-button--icon-md {
  width: 37px;
  height: 37px;
  padding: 0;
  border-radius: 13px;
}

.ui-button--primary {
  background: var(--button-primary-bg);
  border-color: color-mix(in srgb, var(--button-primary-bg) 72%, var(--border));
  color: var(--button-primary-text);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 10px 22px color-mix(in srgb, black 12%, transparent);
}

.ui-button--primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hover);
}

.ui-button--secondary {
  background: color-mix(in srgb, var(--surface-base) 54%, transparent);
  border-color: color-mix(in srgb, var(--border-subtle) 42%, transparent);
  color: var(--text-secondary);
  box-shadow: none;
}

.ui-button--secondary:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--border-subtle) 54%, transparent);
  background: color-mix(in srgb, var(--surface-hover) 36%, transparent);
  color: var(--text-primary);
}

.ui-button--secondary:active:not(:disabled) {
  border-color: color-mix(in srgb, var(--border-subtle) 46%, transparent);
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
}

.ui-button--danger {
  background: color-mix(in srgb, var(--error) 12%, transparent);
  border-color: color-mix(in srgb, var(--error) 32%, var(--border));
  color: var(--error);
}

.ui-button--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error) 18%, transparent);
}

.ui-button--ghost {
  color: var(--text-muted);
}

.ui-button--ghost:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface-hover) 14%, transparent);
  color: var(--text-primary);
}

.ui-button--ghost:active:not(:disabled) {
  background: color-mix(in srgb, var(--surface-hover) 10%, transparent);
}

.ui-button.is-block {
  width: 100%;
}

.ui-button.is-icon-only {
  gap: 0;
}

.ui-button.is-raw-content {
  line-height: var(--line-height-regular);
}

.ui-button-label {
  white-space: nowrap;
}

.ui-button-leading,
.ui-button-trailing {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ui-button-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ui-button-spin 0.8s linear infinite;
}

@keyframes ui-button-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
