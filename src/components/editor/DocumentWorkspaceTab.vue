<template>
  <div ref="containerRef" class="document-workspace-tab">
    <div class="document-workspace-tab-source" :style="sourceStyle">
      <slot name="source" />
    </div>
    <SplitHandle
      v-if="previewVisible"
      direction="vertical"
      @resize="handleResize"
    />
    <div v-if="previewVisible" class="document-workspace-tab-preview" :style="previewStyle">
      <slot name="preview" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import SplitHandle from './SplitHandle.vue'

const props = defineProps({
  previewVisible: { type: Boolean, default: false },
})

const containerRef = ref(null)
const previewRatio = ref(0.46)

const sourceStyle = computed(() => {
  if (!props.previewVisible) return {}
  return {
    width: `calc(${(1 - previewRatio.value) * 100}% - 1px)`,
  }
})

const previewStyle = computed(() => {
  if (!props.previewVisible) return {}
  return {
    width: `calc(${previewRatio.value * 100}% - 1px)`,
  }
})

function handleResize(event) {
  if (!props.previewVisible) return
  const container = containerRef.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  if (!rect.width) return

  const nextPreviewRatio = (rect.right - event.x) / rect.width
  previewRatio.value = Math.max(0.24, Math.min(0.76, nextPreviewRatio))
}
</script>

/* START OF FILE src/components/editor/DocumentWorkspaceTab.vue (只替换 style 部分) */
<style scoped>
.document-workspace-tab {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: transparent;
}

.document-workspace-tab-source,
.document-workspace-tab-preview {
  min-width: 0;
  min-height: 0;
}

.document-workspace-tab-source {
  flex: 0 0 auto;
  background: var(--shell-editor-surface);
  overflow: hidden;
}

.document-workspace-tab-preview {
  flex: 0 0 auto;
  background: var(--shell-preview-surface);
  overflow: hidden;
}
</style>
