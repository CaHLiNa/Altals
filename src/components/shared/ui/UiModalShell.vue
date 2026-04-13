<template>
  <DialogRoot :open="visible" @update:open="handleOpenChange">
    <DialogPortal>
      <div
        v-if="visible"
        class="ui-modal-overlay"
        :class="[`ui-modal-overlay--${position}`, overlayClass]"
      >
        <DialogOverlay class="ui-modal-backdrop ui-overlay-scrim" />

        <DialogContent
          class="ui-modal-surface"
          :class="[
            `ui-modal-surface--${size}`,
            {
              'is-flush': !bodyPadding,
              'is-absolute': position === 'absolute',
            },
            surfaceClass,
          ]"
          :style="surfaceStyle"
          @pointer-down-outside="handleOutsideInteraction"
          @interact-outside="handleOutsideInteraction"
        >
          <div v-if="$slots.header" class="ui-modal-header">
            <slot name="header" />
          </div>
          <div class="ui-modal-body" :class="[bodyClass, { 'is-flush': !bodyPadding }]">
            <slot />
          </div>
          <div v-if="$slots.footer" class="ui-modal-footer">
            <slot name="footer" />
          </div>
        </DialogContent>
      </div>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup>
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot } from 'reka-ui'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  closeOnBackdrop: {
    type: Boolean,
    default: true,
  },
  size: {
    type: String,
    default: 'md',
  },
  position: {
    type: String,
    default: 'center',
  },
  bodyPadding: {
    type: Boolean,
    default: true,
  },
  overlayClass: {
    type: [String, Array, Object],
    default: '',
  },
  surfaceClass: {
    type: [String, Array, Object],
    default: '',
  },
  bodyClass: {
    type: [String, Array, Object],
    default: '',
  },
  surfaceStyle: {
    type: [String, Object, Array],
    default: '',
  },
})

const emit = defineEmits(['close'])

function handleOpenChange(open) {
  if (!open) {
    emit('close')
  }
}

function handleOutsideInteraction(event) {
  if (!props.closeOnBackdrop) {
    event.preventDefault()
  }
}
</script>

<style scoped>
.ui-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  padding: var(--space-5);
}

.ui-modal-backdrop {
  position: fixed;
  inset: 0;
}

.ui-modal-overlay--center {
  align-items: center;
  justify-content: center;
}

.ui-modal-overlay--absolute {
  align-items: stretch;
  justify-content: stretch;
}

.ui-modal-surface {
  display: flex;
  flex-direction: column;
  max-width: min(100%, 90vw);
  max-height: min(100%, 90vh);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1;
}

.ui-modal-surface.is-absolute {
  position: absolute;
}

.ui-modal-surface--sm {
  width: min(420px, 100%);
}

.ui-modal-surface--md {
  width: min(520px, 100%);
}

.ui-modal-surface--lg {
  width: min(760px, 100%);
}

.ui-modal-surface--xl {
  width: min(1000px, 100%);
}

.ui-modal-header,
.ui-modal-footer {
  flex: 0 0 auto;
}

.ui-modal-body {
  min-height: 0;
  padding: var(--space-4);
}

.ui-modal-body.is-flush {
  padding: 0;
}

.ui-modal-surface:focus-visible {
  outline: none;
}
</style>
