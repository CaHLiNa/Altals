<template>
  <div class="terminal-tabs flex min-w-0 items-center border-b">
    <div ref="tabsContainerRef" class="flex min-w-0 flex-1 items-center overflow-x-auto scrollbar-hidden relative">
      <button
        v-for="(instance, index) in instances"
        :key="instance.id"
        :ref="(element) => setTabRef(instance.id, element)"
        class="terminal-tab group"
        :class="{ 'is-active': instance.id === activeInstanceId, 'is-dragging': dragIndex === index }"
        :title="instance.cwd || instance.label"
        @mousedown="onMouseDown(index, $event)"
        @mouseenter="onMouseEnter(index)"
        @click="emit('activate', instance.id)"
        @contextmenu.prevent="emit('tab-contextmenu', { event: $event, instanceId: instance.id })"
        @dblclick="startRename(instance)"
      >
        <span class="terminal-tab-dot" :class="statusClass(instance)" />
        <template v-if="renameInstanceId === instance.id">
          <input
            ref="renameInputRef"
            v-model="renameValue"
            class="terminal-tab-input"
            @keydown.enter.prevent="finishRename"
            @keydown.escape.prevent="cancelRename"
            @blur="finishRename"
            @click.stop
          />
        </template>
        <template v-else>
          <span class="truncate">{{ instance.label }}</span>
        </template>
        <button class="terminal-tab-close" type="button" @click.stop="emit('close', instance.id)">×</button>
      </button>

      <button class="terminal-action-btn terminal-tab-new" type="button" @click="emit('new')">
        ＋
      </button>

      <div v-if="dropIndicatorLeft !== null" class="terminal-tab-drop" :style="{ left: `${dropIndicatorLeft}px` }" />
    </div>

    <div class="terminal-actions flex shrink-0 items-center">
      <button class="terminal-action-btn" type="button" @click="emit('new')" :title="t('New terminal')">＋</button>
      <button class="terminal-action-btn" type="button" @click="emit('split')" :disabled="!activeInstanceId" :title="t('Split terminal')">⫶</button>
      <button class="terminal-action-btn" type="button" @click="emit('find')" :disabled="!activeInstanceId" :title="t('Find')">⌕</button>
      <button class="terminal-action-btn" type="button" @click="emit('clear')" :disabled="!activeInstanceId" :title="t('Clear')">⌫</button>
      <button class="terminal-action-btn" type="button" @click="emit('kill')" :disabled="!activeInstanceId" :title="t('Kill terminal')">×</button>
      <button class="terminal-action-btn" type="button" @click="emit('panel-close')" :title="t('Close terminal panel')">▾</button>
    </div>

    <Teleport to="body">
      <div v-if="ghostVisible" class="terminal-tab-ghost" :style="{ left: `${ghostX}px`, top: `${ghostY}px` }">
        {{ ghostLabel }}
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { useI18n } from '../../i18n'

const props = defineProps({
  instances: {
    type: Array,
    default: () => [],
  },
  activeInstanceId: {
    type: Number,
    default: null,
  },
})

const emit = defineEmits([
  'activate',
  'close',
  'rename',
  'new',
  'split',
  'find',
  'clear',
  'kill',
  'panel-close',
  'reorder',
  'tab-contextmenu',
])

const { t } = useI18n()
const tabsContainerRef = ref(null)
const renameInputRef = ref(null)
const renameInstanceId = ref(null)
const renameValue = ref('')
const tabElements = new Map()
const dragIndex = ref(-1)
const dragOverIndex = ref(-1)
const dropIndicatorLeft = ref(null)
const ghostVisible = ref(false)
const ghostX = ref(0)
const ghostY = ref(0)
const ghostLabel = ref('')
let mouseDownStart = null
let dragging = false

function setTabRef(id, element) {
  if (element) tabElements.set(id, element)
  else tabElements.delete(id)
}

function tabElementByIndex(index) {
  const instance = props.instances[index]
  return instance ? tabElements.get(instance.id) || null : null
}

function statusClass(instance) {
  if (instance.status === 'busy') return 'is-busy'
  if (instance.status === 'error' || instance.status === 'exited' || (instance.lastExitCode ?? 0) > 0) return 'is-error'
  if (instance.status === 'success' || (instance.lastExitCode === 0 && instance.commandMarkers?.length)) return 'is-success'
  return 'is-idle'
}

function startRename(instance) {
  renameInstanceId.value = instance.id
  renameValue.value = instance.label
  nextTick(() => {
    const input = Array.isArray(renameInputRef.value) ? renameInputRef.value[0] : renameInputRef.value
    input?.focus?.()
    input?.select?.()
  })
}

function finishRename() {
  if (renameInstanceId.value !== null && renameValue.value.trim()) {
    emit('rename', { instanceId: renameInstanceId.value, label: renameValue.value.trim() })
  }
  renameInstanceId.value = null
}

function cancelRename() {
  renameInstanceId.value = null
}

function updateDropIndicator(mouseX) {
  if (!tabsContainerRef.value) return

  const containerRect = tabsContainerRef.value.getBoundingClientRect()
  let bestIndex = -1
  let bestDistance = Infinity

  for (let index = 0; index <= props.instances.length; index += 1) {
    let edgeX
    if (index === 0) {
      edgeX = tabElementByIndex(0)?.getBoundingClientRect().left
    } else {
      edgeX = tabElementByIndex(index - 1)?.getBoundingClientRect().right
    }
    if (typeof edgeX !== 'number') continue
    const distance = Math.abs(mouseX - edgeX)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  }

  if (bestIndex === -1 || bestIndex === dragIndex.value || bestIndex === dragIndex.value + 1) {
    dropIndicatorLeft.value = null
    dragOverIndex.value = -1
    return
  }

  const edgeX = bestIndex === 0
    ? tabElementByIndex(0)?.getBoundingClientRect().left
    : tabElementByIndex(bestIndex - 1)?.getBoundingClientRect().right
  dropIndicatorLeft.value = (edgeX || 0) - containerRect.left - 1
  dragOverIndex.value = bestIndex > dragIndex.value ? bestIndex - 1 : bestIndex
}

function onMouseDown(index, event) {
  if (renameInstanceId.value === props.instances[index]?.id) return
  mouseDownStart = { index, x: event.clientX, y: event.clientY }
  dragging = false

  function onMove(moveEvent) {
    if (!mouseDownStart) return
    if (!dragging && Math.abs(moveEvent.clientX - mouseDownStart.x) > 5) {
      dragging = true
      dragIndex.value = mouseDownStart.index
      ghostVisible.value = true
      ghostLabel.value = props.instances[mouseDownStart.index]?.label || ''
      document.body.classList.add('tab-dragging')
    }
    if (!dragging) return
    ghostX.value = moveEvent.clientX
    ghostY.value = moveEvent.clientY
    updateDropIndicator(moveEvent.clientX)
  }

  function onUp() {
    if (dragging && dragIndex.value !== -1 && dragOverIndex.value !== -1 && dragIndex.value !== dragOverIndex.value) {
      emit('reorder', { fromIndex: dragIndex.value, toIndex: dragOverIndex.value })
    }

    dragIndex.value = -1
    dragOverIndex.value = -1
    dropIndicatorLeft.value = null
    ghostVisible.value = false
    mouseDownStart = null
    dragging = false
    document.body.classList.remove('tab-dragging')
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onMouseEnter(index) {
  if (!dragging || dragIndex.value === index) return
  dragOverIndex.value = index
}
</script>

<style scoped>
.terminal-tabs {
  min-height: 32px;
  background: color-mix(in srgb, var(--bg-secondary) 96%, transparent);
  border-color: color-mix(in srgb, var(--border) 82%, transparent);
}

.terminal-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 88px;
  max-width: 220px;
  height: 32px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: var(--ui-font-caption);
  flex-shrink: 0;
}

.terminal-tab.is-active {
  background: var(--bg-primary);
  color: var(--fg-primary);
}

.terminal-tab.is-dragging {
  opacity: 0.35;
}

.terminal-tab-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--fg-muted) 70%, transparent);
}

.terminal-tab-dot.is-busy {
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
}

.terminal-tab-dot.is-success {
  background: var(--success);
}

.terminal-tab-dot.is-error {
  background: var(--error);
}

.terminal-tab-close,
.terminal-action-btn {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  border-radius: 4px;
}

.terminal-tab-close {
  width: 18px;
  height: 18px;
  opacity: 0;
}

.terminal-tab:hover .terminal-tab-close {
  opacity: 1;
}

.terminal-tab-input {
  width: 100%;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: inherit;
}

.terminal-action-btn {
  width: 28px;
  height: 28px;
  font-size: var(--ui-font-caption);
}

.terminal-action-btn:hover:not(:disabled),
.terminal-tab-close:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.terminal-action-btn:disabled {
  opacity: 0.45;
}

.terminal-tab-new {
  margin-right: 4px;
}

.terminal-tab-drop {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--accent);
  border-radius: 999px;
}

.terminal-tab-ghost {
  position: fixed;
  z-index: 130;
  transform: translate(12px, 12px);
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--border) 90%, transparent);
  background: color-mix(in srgb, var(--bg-secondary) 96%, transparent);
  color: var(--fg-primary);
  border-radius: 6px;
  padding: 6px 10px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  font-size: var(--ui-font-caption);
}
</style>
