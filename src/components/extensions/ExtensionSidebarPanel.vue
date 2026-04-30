<template>
  <div class="extension-sidebar-panel">
    <div class="extension-sidebar-panel__header">
      <div class="extension-sidebar-panel__header-main">
        <div class="extension-sidebar-panel__title">{{ title }}</div>
        <div class="extension-sidebar-panel__meta">{{ extensionName }}</div>
      </div>
      <div class="extension-sidebar-panel__header-actions">
        <button
          v-for="action in viewTitleActions"
          :key="`${action.extensionId}:${action.commandId}`"
          type="button"
          class="extension-sidebar-panel__refresh"
          @click="runHeaderAction(action)"
        >
          {{ t(action.title || action.commandId) }}
        </button>
        <button type="button" class="extension-sidebar-panel__refresh" @click="refreshViews">
          {{ t('Refresh') }}
        </button>
      </div>
    </div>

    <div v-if="views.length === 0" class="extension-sidebar-panel__empty">
      {{ t('No extension views found') }}
    </div>

    <div v-else class="extension-sidebar-panel__views">
      <section
        v-for="view in views"
        :key="`${view.extensionId}:${view.id}`"
        class="extension-sidebar-panel__section"
      >
        <div class="extension-sidebar-panel__section-header">
          <div class="extension-sidebar-panel__view-title">
            {{ t(resolvedViewTitle(view)) }}
          </div>
          <div class="extension-sidebar-panel__view-meta">{{ view.id }}</div>
        </div>

        <div v-if="resolvedItems(view).length === 0" class="extension-sidebar-panel__empty">
          {{ t('No extension view items found') }}
        </div>

        <div class="extension-sidebar-panel__tree">
          <ExtensionSidebarTreeNode
            v-for="item in resolvedItems(view)"
            :key="`${view.extensionId}:${view.id}:${item.handle || item.id}`"
            :view="view"
            :item="item"
            :context="props.context"
            :depth="0"
            :expanded-item-keys="expandedItemKeys"
            :child-items-resolver="(entry) => resolvedChildItems(view, entry)"
            @run-command="(item) => runItemCommand(view, item)"
            @toggle-expand="(item) => toggleItemExpansion(view, item)"
            @run-item-action="runHeaderAction"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from '../../i18n'
import { useExtensionsStore } from '../../stores/extensions'
import { useToastStore } from '../../stores/toast'
import ExtensionSidebarTreeNode from './ExtensionSidebarTreeNode.vue'

const props = defineProps({
  container: { type: Object, required: true },
  context: { type: Object, default: () => ({}) },
  target: { type: Object, default: () => ({}) },
})

const { t } = useI18n()
const extensionsStore = useExtensionsStore()
const toastStore = useToastStore()

const title = computed(() => t(props.container?.title || props.container?.id || 'Extension'))
const extensionName = computed(() => props.container?.extensionName || props.container?.extensionId || '')
const views = computed(() => extensionsStore.viewsForContainer(props.container?.id, props.context))
const expandedItemKeys = ref({})
const viewTitleActions = computed(() => {
  const firstView = views.value[0] || {}
  return extensionsStore.viewTitleActionsForView(firstView, props.context)
})
const resolvedViewRefreshTokens = computed(() =>
  views.value.map((view) => ({
    key: `${view.extensionId}:${view.id}`,
    token: extensionsStore.viewRefreshTickFor(`${view.extensionId}:${view.id}`),
  }))
)

watch(
  views,
  (nextViews) => {
    for (const view of nextViews) {
      void refreshSingleView(view).catch(() => {})
    }
  },
  { immediate: true }
)

watch(resolvedViewRefreshTokens, (next, previous = []) => {
  const previousTokens = new Map(previous.map((entry) => [entry.key, entry.token]))
  const changedViews = next
    .filter((entry) => previousTokens.has(entry.key) && previousTokens.get(entry.key) !== entry.token)
    .map((entry) => views.value.find((view) => `${view.extensionId}:${view.id}` === entry.key))
    .filter(Boolean)

  for (const view of changedViews) {
    void refreshSingleView(view).catch(() => {})
  }
})

function resolvedViewRecord(view = {}) {
  return extensionsStore.resolvedViewFor(`${view.extensionId}:${view.id}`)
}

function resolvedViewTitle(view = {}) {
  return resolvedViewRecord(view)?.title || view.contextualTitle || view.title || view.id
}

function resolvedItems(view = {}) {
  return extensionsStore.resolvedViewChildrenFor(`${view.extensionId}:${view.id}`, '')
}

function resolvedChildItems(view = {}, item = {}) {
  return extensionsStore.resolvedViewChildrenFor(
    `${view.extensionId}:${view.id}`,
    item.handle || item.id,
  )
}

function isExpandable(item = {}) {
  const state = String(item?.collapsibleState || '')
  return state && state !== 'none'
}

function itemExpansionKey(view = {}, item = {}) {
  return `${view.extensionId}:${view.id}:${item.handle || item.id}`
}

function isItemExpanded(view = {}, item = {}) {
  const key = itemExpansionKey(view, item)
  if (expandedItemKeys.value[key] != null) {
    return Boolean(expandedItemKeys.value[key])
  }
  return String(item?.collapsibleState || '') === 'expanded'
}

async function loadExpandedChildren(view = {}, items = []) {
  for (const item of items) {
    if (!isExpandable(item) || !isItemExpanded(view, item)) continue
    await extensionsStore.resolveView(view, props.target, {}, item.handle || item.id).catch(() => {})
    const children = resolvedChildItems(view, item)
    if (children.length > 0) {
      await loadExpandedChildren(view, children)
    }
  }
}

function fallbackCommandForView(view = {}, item = {}) {
  const itemCommandId = String(item?.commandId || '').trim()
  const extension = extensionsStore.registry.find((entry) => entry.id === view.extensionId)
  if (!extension) return null
  if (itemCommandId) {
    return (extension.contributedCommands || []).find((command) => command.commandId === itemCommandId) || null
  }
  return (extension.contributedCommands || [])[0] || null
}

async function runItemCommand(view = {}, item = {}) {
  if (isExpandable(item) && !item.commandId) {
    await toggleItemExpansion(view, item)
    return
  }
  const command = fallbackCommandForView(view, item)
  if (!command) {
    toastStore.show(t('No extension commands found'), { type: 'error', duration: 3200 })
    return
  }
  try {
    await extensionsStore.executeCommand({
      ...command,
      extensionId: view.extensionId,
      itemId: String(item?.id || ''),
      itemHandle: String(item?.handle || ''),
    }, props.target)
    toastStore.show(t('Extension task started'), { type: 'success', duration: 2400 })
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to start extension task')), {
      type: 'error',
      duration: 4200,
    })
  }
}

async function runHeaderAction(action = {}) {
  const command = fallbackCommandForView({ extensionId: action.extensionId }, action)
  if (!command) return
  try {
    await extensionsStore.executeCommand({
      ...command,
      extensionId: action.extensionId,
      commandId: action.commandId || command.commandId,
    }, props.target)
    toastStore.show(t('Extension task started'), { type: 'success', duration: 2400 })
  } catch (error) {
    toastStore.show(error?.message || String(error || t('Failed to start extension task')), {
      type: 'error',
      duration: 4200,
    })
  }
}

async function refreshViews() {
  for (const view of views.value) {
    await refreshSingleView(view).catch(() => {})
  }
}

async function refreshSingleView(view = {}) {
  await extensionsStore.resolveView(view, props.target).catch(() => {})
  await loadExpandedChildren(view, resolvedItems(view))
}

async function toggleItemExpansion(view = {}, item = {}) {
  if (!isExpandable(item)) return
  const key = itemExpansionKey(view, item)
  const nextExpanded = !isItemExpanded(view, item)
  expandedItemKeys.value = {
    ...expandedItemKeys.value,
    [key]: nextExpanded,
  }
  if (!nextExpanded) return
  await extensionsStore.resolveView(view, props.target, {}, item.handle || item.id).catch(() => {})
}
</script>

<style scoped>
.extension-sidebar-panel {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 10px;
  padding: 6px 2px 0;
}

.extension-sidebar-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px;
}

.extension-sidebar-panel__header-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.extension-sidebar-panel__header-main {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
}

.extension-sidebar-panel__title {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.extension-sidebar-panel__meta,
.extension-sidebar-panel__view-meta,
.extension-sidebar-panel__empty {
  color: var(--text-muted);
  font-size: 11px;
}

.extension-sidebar-panel__views {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  padding: 0 6px 8px;
}

.extension-sidebar-panel__tree {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extension-sidebar-panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.extension-sidebar-panel__section-header {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 0 4px;
}

.extension-sidebar-panel__empty {
  padding: 0 10px;
}

.extension-sidebar-panel__refresh {
  flex: 0 0 auto;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}

</style>
