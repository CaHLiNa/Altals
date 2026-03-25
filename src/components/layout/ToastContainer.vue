<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-${toast.type}`"
          @click="!toast.action && toastStore.dismiss(toast.id)"
        >
          <component
            :is="typeIcon(toast.type)"
            :size="16"
            :stroke-width="2"
            class="toast-type-icon"
          />
          <span class="toast-message">{{ toast.message }}</span>
          <UiButton
            v-if="toast.action"
            class="toast-action-btn"
            variant="primary"
            size="sm"
            @click.stop="handleToastAction(toast)"
          >
            {{ toast.action.label }}
          </UiButton>
          <UiButton
            v-if="toast.action"
            class="toast-dismiss-btn"
            variant="ghost"
            size="icon-sm"
            icon-only
            @click.stop="toastStore.dismiss(toast.id)"
          >
            <IconX :size="14" :stroke-width="2" />
          </UiButton>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToastStore } from '../../stores/toast'
import {
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-vue'
import UiButton from '../shared/ui/UiButton.vue'

const toastStore = useToastStore()

function typeIcon(type) {
  switch (type) {
    case 'success':
      return IconCircleCheck
    case 'error':
      return IconCircleX
    case 'warning':
      return IconAlertTriangle
    case 'info':
      return IconInfoCircle
    default:
      return IconInfoCircle
  }
}

function handleToastAction(toast) {
  toast.action?.onClick?.()
  toastStore.dismiss(toast.id)
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 16px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: var(--ui-font-caption);
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--fg-muted) 30%, var(--border));
  color: var(--fg-primary);
  max-width: 380px;
  line-height: var(--line-height-regular);
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: var(--shadow-md);
}

.toast-type-icon {
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
}

.toast-action-btn {
  white-space: nowrap;
}

.toast-dismiss-btn {
  display: flex;
  align-items: center;
  padding: 0;
  line-height: 1;
  color: var(--text-muted);
}

/* Type styling: background tint + icon color */
.toast-success {
  background: color-mix(in srgb, var(--success) 8%, var(--bg-secondary));
}
.toast-success .toast-type-icon {
  color: var(--success);
}

.toast-error {
  background: color-mix(in srgb, var(--error, #f44) 8%, var(--bg-secondary));
}
.toast-error .toast-type-icon {
  color: var(--error, #f44);
}

.toast-warning {
  background: color-mix(in srgb, var(--warning, #e0af68) 8%, var(--bg-secondary));
}
.toast-warning .toast-type-icon {
  color: var(--warning, #e0af68);
}

.toast-info {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
}
.toast-info .toast-type-icon {
  color: var(--accent);
}

/* Transitions */
.toast-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}
.toast-leave-active {
  transition:
    opacity 0.08s ease-out,
    transform 0.08s ease-out;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
.toast-move {
  transition: transform 0.15s ease;
}
</style>
