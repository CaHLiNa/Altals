<template>
  <div class="extension-tree-node">
    <div class="extension-tree-node__row" :style="{ '--extension-tree-depth': depth }">
      <button
        v-if="isExpandable"
        type="button"
        class="extension-tree-node__chevron"
        @click.stop="$emit('toggle-expand', item)"
      >
        {{ expanded ? '▾' : '▸' }}
      </button>
      <span v-else class="extension-tree-node__chevron extension-tree-node__chevron--empty"></span>

      <button
        type="button"
        class="extension-tree-node__primary"
        :title="item.tooltip || item.description || ''"
        @click="$emit('run-command', item)"
      >
        <span v-if="item.icon" class="extension-tree-node__icon">{{ item.icon }}</span>
        <span class="extension-tree-node__label">{{ item.label }}</span>
        <span v-if="item.description" class="extension-tree-node__meta">{{ item.description }}</span>
      </button>

      <div v-if="itemActions.length > 0" class="extension-tree-node__actions">
        <button
          v-for="action in itemActions"
          :key="`${action.extensionId}:${action.commandId}:${item.id}`"
          type="button"
          class="extension-tree-node__action"
          @click.stop="$emit('run-item-action', action)"
        >
          {{ t(action.title || action.commandId) }}
        </button>
      </div>
    </div>

    <div v-if="isExpandable && expanded && childItems.length > 0" class="extension-tree-node__children">
      <ExtensionSidebarTreeNode
        v-for="child in childItems"
        :key="`${view.extensionId}:${view.id}:${child.handle || child.id}`"
        :view="view"
        :item="child"
        :context="context"
        :depth="depth + 1"
        :expanded-item-keys="expandedItemKeys"
        :child-items-resolver="childItemsResolver"
        @run-command="$emit('run-command', $event)"
        @toggle-expand="$emit('toggle-expand', $event)"
        @run-item-action="$emit('run-item-action', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'

defineOptions({ name: 'ExtensionSidebarTreeNode' })

const props = defineProps({
  view: { type: Object, required: true },
  item: { type: Object, required: true },
  context: { type: Object, default: () => ({}) },
  depth: { type: Number, default: 0 },
  expandedItemKeys: { type: Object, required: true },
  childItemsResolver: { type: Function, required: true },
})

defineEmits(['run-command', 'toggle-expand', 'run-item-action'])

const { t } = useI18n()
const extensionsStore = useExtensionsStore()

const itemKey = computed(() => `${props.view.extensionId}:${props.view.id}:${props.item.handle || props.item.id}`)
const isExpandable = computed(() => {
  const state = String(props.item?.collapsibleState || '')
  return state && state !== 'none'
})
const expanded = computed(() => {
  if (props.expandedItemKeys?.value?.[itemKey.value] != null) {
    return Boolean(props.expandedItemKeys.value[itemKey.value])
  }
  return String(props.item?.collapsibleState || '') === 'expanded'
})
const childItems = computed(() => props.childItemsResolver(props.item))
const itemActions = computed(() => extensionsStore.viewItemActionsForItem(props.view, props.item, props.context))
</script>

<style scoped>
.extension-tree-node {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.extension-tree-node__row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: start;
  gap: 6px;
  padding-left: calc(var(--extension-tree-depth, 0) * 14px);
}

.extension-tree-node__chevron,
.extension-tree-node__primary,
.extension-tree-node__action {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.extension-tree-node__chevron {
  width: 18px;
  height: 18px;
  padding: 0;
  color: var(--text-muted);
}

.extension-tree-node__chevron--empty {
  cursor: default;
}

.extension-tree-node__primary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  border: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-base) 78%, transparent);
  padding: 10px;
  text-align: left;
}

.extension-tree-node__icon {
  color: var(--text-muted);
  font-size: 11px;
}

.extension-tree-node__primary:hover,
.extension-tree-node__chevron:hover:not(.extension-tree-node__chevron--empty),
.extension-tree-node__action:hover {
  background: var(--surface-hover);
}

.extension-tree-node__label {
  min-width: 0;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.extension-tree-node__meta {
  color: var(--text-muted);
  font-size: 11px;
}

.extension-tree-node__actions {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.extension-tree-node__action {
  color: var(--text-muted);
  font-size: 10px;
}

.extension-tree-node__children {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
