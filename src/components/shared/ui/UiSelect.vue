<!-- START OF FILE src/components/shared/ui/UiSelect.vue -->
<template>
  <SelectRoot
    :model-value="stringValue"
    :disabled="disabled"
    @update:model-value="handleUpdate"
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
          <svg width="12" height="12" viewBox="0 0 15 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4.5 9.5L7.5 12.5L10.5 9.5" />
            <path d="M4.5 5.5L7.5 2.5L10.5 5.5" />
          </svg>
        </SelectIcon>
      </SelectTrigger>

      <SelectPortal>
        <SelectContent
          class="ui-select-menu"
          position="popper"
          side="bottom"
          align="start"
          :side-offset="4"
          :collision-padding="8"
        >
          <SelectViewport class="ui-select-viewport scrollbar-hidden">
            <SelectItem
              v-for="(option, index) in normalizedOptions"
              :key="getOptionKey(option, index)"
              class="ui-select-option"
              :value="option.stringValue"
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

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: '' },
  disabled: { type: Boolean, default: false },
  shellClass: { type: [String, Array, Object], default: '' },
  size: { type: String, default: 'md' },
  options: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: '' },
  placeholder: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])

const shellRef = ref(null)
const triggerRef = ref(null)

// 核心修复：强制转为字符串以满足 Reka UI 的内部要求，防止抛错卡死
const stringValue = computed(() => String(props.modelValue ?? ''))

const normalizedOptions = computed(() =>
  (props.options || []).map((option) => {
    if (option && typeof option === 'object' && 'value' in option) {
      return {
        originalValue: option.value,
        stringValue: String(option.value ?? ''),
        label: option.label ?? String(option.value ?? ''),
        disabled: option.disabled === true,
      }
    }
    return {
      originalValue: option,
      stringValue: String(option ?? ''),
      label: String(option ?? ''),
      disabled: false,
    }
  })
)

function handleUpdate(val) {
  // 选回后，将字符串还原为原始类型 (Number/Boolean) 传给父组件
  const opt = normalizedOptions.value.find(o => o.stringValue === val)
  emit('update:modelValue', opt ? opt.originalValue : val)
}

const shellClassName = computed(() => [
  `ui-select-shell--${props.size}`,
  { 'is-disabled': props.disabled },
])

const propsShellClass = computed(() => props.shellClass)
const selectedOption = computed(() => normalizedOptions.value.find((o) => o.stringValue === stringValue.value) || normalizedOptions.value.find((o) => !o.disabled) || null)
const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder || '')
const triggerLabel = computed(() => props.ariaLabel || selectedLabel.value || 'Select')

function getOptionKey(option, index) { return `${option.stringValue}:${index}` }

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
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  cursor: pointer;
}

.ui-select-trigger:focus-visible {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.ui-select-trigger:disabled {
  opacity: 0.55;
  cursor: default;
}

.ui-select-shell--sm .ui-select-trigger {
  min-height: 26px;
  padding: 0 28px 0 10px;
}

.ui-select-shell--md .ui-select-trigger {
  min-height: 30px;
  padding: 0 32px 0 12px;
}

.ui-select-shell--lg .ui-select-trigger {
  min-height: 36px;
  padding: 0 36px 0 12px;
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
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  pointer-events: none;
  transform: translateY(-50%);
  opacity: 0.8;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

/* 使用 Reka 原生的 data-state 替代手动管理的 class */
.ui-select-trigger[data-state="open"] .ui-select-caret {
  transform: translateY(-50%) rotate(180deg);
  opacity: 1;
}

/* =========================================================================
   原生毛玻璃下拉菜单 (Native Dropdown Menu)
========================================================================= */
.ui-select-menu {
  z-index: var(--z-dropdown);
  display: flex;
  flex-direction: column;
  
  /* 核心修复：最小宽度对齐按钮，取消最大宽度的强制 100vw，防止挤开屏幕 */
  min-width: var(--reka-select-trigger-width, 220px);
  max-width: min(100vw - 32px, 460px); 
  max-height: 45vh; 
  
  padding: 5px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
  backdrop-filter: blur(40px) saturate(1.5);
  border: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.theme-light .ui-select-menu {
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
}

.ui-select-viewport {
  flex: 1;
  overflow-y: auto;
  width: 100%;
}

.ui-select-option {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  outline: none;
}

.ui-select-option:hover:not([data-disabled]),
.ui-select-option[data-highlighted] {
  background: var(--list-active-bg) !important;
  color: var(--list-active-fg) !important;
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
  color: var(--text-primary);
}

.ui-select-option:hover .ui-select-option-check,
.ui-select-option[data-highlighted] .ui-select-option-check {
  color: var(--list-active-fg);
}
</style>