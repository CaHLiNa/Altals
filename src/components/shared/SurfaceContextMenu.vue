<template>
  <DropdownMenuRoot :open="visible" :modal="false" @update:open="handleOpenChange">
    <DropdownMenuPortal>
      <DropdownMenuContent
        class="context-menu surface-context-menu"
        :reference="menuReference"
        position="popper"
        position-strategy="fixed"
        :side-offset="2"
        :collision-padding="8"
        @close-auto-focus.prevent
        @pointer-down-outside="emit('close')"
        @focus-outside="emit('close')"
        @interact-outside="emit('close')"
        @escape-key-down="emit('close')"
      >
        <template v-for="(group, groupIndex) in normalizedGroups" :key="group.key || groupIndex">
          <DropdownMenuSeparator v-if="groupIndex > 0" class="context-menu-separator" />
          <DropdownMenuLabel v-if="group.label" class="context-menu-section">
            {{ group.label }}
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="item in group.items"
            :key="item.key"
            class="context-menu-item surface-context-menu-item"
            :class="{ 'context-menu-item-danger': item.danger }"
            :disabled="item.disabled"
            @select="handleSelect(item)"
          >
            <span class="surface-context-menu-label">{{ item.label }}</span>
            <span v-if="item.meta" class="surface-context-menu-meta">{{ item.meta }}</span>
            <span v-else-if="item.checked" class="surface-context-menu-check">✓</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup>
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
} from 'reka-ui'
import { computed } from 'vue'
import { createPointReference } from '../../utils/floatingReference'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  groups: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'select'])

const normalizedGroups = computed(() =>
  (props.groups || [])
    .map((group, index) => ({
      key: group?.key || `group-${index}`,
      label: group?.label || '',
      items: Array.isArray(group?.items)
        ? group.items.filter((item) => !!item?.key && !!item?.label)
        : [],
    }))
    .filter((group) => group.items.length > 0)
)

const menuReference = computed(() => createPointReference(props.x, props.y))

function handleSelect(item) {
  if (!item || item.disabled) return
  emit('select', item.key, item)
  emit('close')
}

function handleOpenChange(open) {
  if (!open) {
    emit('close')
  }
}
</script>

<style scoped>
.surface-context-menu {
  min-width: 220px !important;
  max-width: min(320px, calc(100vw - 16px)) !important;
}

.surface-context-menu-item {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 13px;
}

.surface-context-menu-item[data-disabled] {
  cursor: default;
  color: var(--fg-muted) !important;
  opacity: 0.72;
}

.surface-context-menu-item[data-disabled]:hover,
.surface-context-menu-item[data-disabled][data-highlighted] {
  background: transparent !important;
  color: var(--fg-muted) !important;
}

.surface-context-menu-label {
  min-width: 0;
  flex: 1 1 auto;
}

.surface-context-menu-meta,
.surface-context-menu-check {
  flex: 0 0 auto;
  font-size: 10.5px;
  color: color-mix(in srgb, var(--text-muted) 76%, transparent);
}

.surface-context-menu-check {
  color: var(--accent);
}
</style>
