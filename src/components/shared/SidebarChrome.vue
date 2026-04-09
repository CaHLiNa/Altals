<template>
  <div v-if="shouldRenderChrome" class="sidebar-chrome">
    <div v-if="entries.length > 1" class="sidebar-chrome-strip ui-segmented-control">
      <ShellChromeButton
        v-for="entry in entries"
        :key="entry.key"
        :active="entry.key === activeKey"
        size="icon-sm"
        :title="entry.title"
        :aria-label="entry.label"
        @click="$emit('select', entry.key)"
      >
        <component :is="entry.icon" :size="16" :stroke-width="1.75" />
      </ShellChromeButton>
    </div>
    <div v-if="$slots.trailing" class="sidebar-chrome-trailing">
      <slot name="trailing" />
    </div>
  </div>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import ShellChromeButton from './ShellChromeButton.vue'
import { shouldRenderSidebarChrome as resolveSidebarChromeVisibility } from '../../shared/sidebarChromeVisibility.js'

const props = defineProps({
  entries: {
    type: Array,
    default: () => [],
  },
  activeKey: {
    type: String,
    default: '',
  },
})

defineEmits(['select'])

const slots = useSlots()
const entries = computed(() => (Array.isArray(props.entries) ? props.entries : []))
const shouldRenderChrome = computed(() =>
  resolveSidebarChromeVisibility(entries.value, Boolean(slots.trailing))
)
</script>

<style scoped>
.sidebar-chrome {
  --sidebar-header-row-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  min-height: var(--sidebar-header-row-height);
  box-sizing: border-box;
  padding: 0 4px 5px;
  margin-bottom: 4px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-subtle) 10%, transparent);
  background: transparent;
}

.sidebar-chrome-strip {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0;
}

.sidebar-chrome-trailing {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: auto;
  padding: 0;
}
</style>
