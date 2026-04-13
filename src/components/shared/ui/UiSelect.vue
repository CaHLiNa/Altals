<template>
  <SelectRoot
    :model-value="modelValue"
    :open="open"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
    @update:open="(value) => (open = value)"
  >
    <div ref="shellRef" class="ui-select-shell" :class="[shellClassName, propsShellClass]">
      <SelectTrigger
        ref="triggerRef"
        class="ui-select-trigger"
        :disabled="disabled"
        :aria-label="triggerLabel"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
      >
        <SelectValue class="ui-select-value" :placeholder="placeholder || selectedLabel" />
        <SelectIcon class="ui-select-caret" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 3l4 4 4-4z" />
          </svg>
        </SelectIcon>
      </SelectTrigger>

      <SelectPortal>
        <SelectContent
          class="ui-select-menu"
          position="popper"
          position-strategy="fixed"
          :side-offset="6"
          :collision-padding="8"
        >
          <SelectViewport>
            <SelectItem
              v-for="(option, index) in normalizedOptions"
              :key="getOptionKey(option, index)"
              class="ui-select-option"
              :class="{ 'is-selected': isSelected(option) }"
              :value="option.value"
              :disabled="option.disabled"
            >
              <SelectItemText class="ui-select-option-label">
                {{ option.label }}
              </SelectItemText>
              <SelectItemIndicator class="ui-select-option-check" aria-hidden="true">
                ✓
              </SelectItemIndicator>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </div>
  </SelectRoot>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  modelValue: {
    type: [String, Number, Boolean],
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  shellClass: {
    type: [String, Array, Object],
    default: '',
  },
  size: {
    type: String,
    default: 'md',
  },
  options: {
    type: Array,
    default: () => [],
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const shellRef = ref(null)
const triggerRef = ref(null)
const open = ref(false)

const normalizedOptions = computed(() =>
  (props.options || []).map((option) => {
    if (option && typeof option === 'object' && 'value' in option) {
      return {
        value: option.value,
        label: option.label ?? String(option.value ?? ''),
        disabled: option.disabled === true,
      }
    }
    return {
      value: option,
      label: String(option ?? ''),
      disabled: false,
    }
  })
)

const shellClassName = computed(() => [
  `ui-select-shell--${props.size}`,
  {
    'is-disabled': props.disabled,
    'is-open': open.value,
  },
])

const propsShellClass = computed(() => props.shellClass)

const selectedOption = computed(
  () =>
    normalizedOptions.value.find((option) => sameValue(option.value, props.modelValue)) ||
    normalizedOptions.value.find((option) => !option.disabled) ||
    null
)

const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder || '')

const triggerLabel = computed(() => props.ariaLabel || selectedLabel.value || 'Select')

function sameValue(a, b) {
  return String(a ?? '') === String(b ?? '')
}

function isSelected(option) {
  return sameValue(option?.value, props.modelValue)
}

function getOptionKey(option, index) {
  return `${String(option?.value ?? '')}:${index}`
}

defineExpose({
  el: triggerRef,
  focus: () => triggerRef.value?.focus(),
  blur: () => triggerRef.value?.blur(),
  click: () => triggerRef.value?.click(),
})
</script>

<style scoped>
.ui-select-shell {
  position: relative;
  display: inline-flex;
  width: 100%;
  min-width: 0;
}

.ui-select-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-base);
  color: var(--text-primary);
  font: inherit;
  text-align: left;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
  cursor: pointer;
}

.ui-select-trigger:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 48%, var(--border));
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.ui-select-trigger:disabled {
  opacity: 0.55;
  cursor: default;
}

.ui-select-shell--sm .ui-select-trigger {
  min-height: 28px;
  padding: 0 32px 0 var(--space-3);
}

.ui-select-shell--md .ui-select-trigger {
  min-height: 32px;
  padding: 0 36px 0 var(--space-3);
}

.ui-select-shell--lg .ui-select-trigger {
  min-height: 36px;
  padding: 0 40px 0 var(--space-3);
}

.ui-select-value {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ui-select-caret {
  position: absolute;
  top: 50%;
  right: var(--space-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  pointer-events: none;
  transform: translateY(-50%);
  transition:
    transform 140ms ease,
    color 140ms ease;
}

.ui-select-shell.is-open .ui-select-caret {
  transform: translateY(-50%) rotate(180deg);
  color: var(--text-secondary);
}

.ui-select-menu {
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  width: max(var(--reka-select-trigger-width, 100%), 100%);
  min-width: max-content;
  padding: 4px;
  border: 1px solid color-mix(in srgb, var(--shell-border) 12%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-muted) 82%, var(--shell-surface));
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(18px) saturate(0.94);
}

.ui-select-option {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
  outline: none;
}

.ui-select-option:hover:not([data-disabled]),
.ui-select-option[data-highlighted],
.ui-select-option[data-state='checked'] {
  background: color-mix(in srgb, var(--surface-hover) 6%, transparent);
  color: var(--text-primary);
}

.ui-select-option.is-selected,
.ui-select-option[data-state='checked'] {
  color: var(--text-primary);
}

.ui-select-option[data-disabled] {
  opacity: 0.45;
  cursor: default;
}

.ui-select-option-label {
  min-width: 0;
  flex: 1 1 auto;
}

.ui-select-option-check {
  flex: 0 0 auto;
  color: color-mix(in srgb, var(--accent) 72%, currentColor);
}
</style>
