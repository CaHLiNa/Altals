<template>
  <div v-if="entries.length > 1" class="sidebar-chrome">
    <div class="sidebar-chrome-strip">
      <ShellChromeButton
        v-for="entry in entries"
        :key="entry.key"
        :active="entry.key === activeKey"
        size="icon-xs"
        :title="entry.title"
        :aria-label="entry.label"
        @click="$emit('select', entry.key)"
      >
        <component :is="entry.icon" :size="12" :stroke-width="1.6" />
      </ShellChromeButton>
    </div>
    <div v-if="$slots.trailing" class="sidebar-chrome-trailing">
      <slot name="trailing" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ShellChromeButton from './ShellChromeButton.vue'

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

const entries = computed(() => (Array.isArray(props.entries) ? props.entries : []))
</script>

<style scoped>
.sidebar-chrome {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  height: 26px;
  min-height: 26px;
  box-sizing: border-box;
  padding: 0 3px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-base);
}

.sidebar-chrome-strip {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 0;
}

.sidebar-chrome-trailing {
  display: flex;
  align-items: center;
  gap: 0;
  margin-left: auto;
}
</style>
