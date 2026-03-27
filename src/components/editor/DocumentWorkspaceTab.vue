<template>
  <div
    class="document-workspace-tab"
    :class="{ 'document-workspace-tab-split': previewState?.previewVisible }"
  >
    <div class="document-workspace-editor">
      <TextEditor
        class="h-full min-h-0 min-w-0"
        :filePath="filePath"
        :paneId="paneId"
        @cursor-change="(pos) => $emit('cursor-change', pos)"
        @editor-stats="(stats) => $emit('editor-stats', stats)"
        @selection-change="(selection) => $emit('selection-change', selection)"
      />
    </div>

    <div v-if="previewState?.previewVisible" class="document-workspace-preview">
      <MarkdownPreview
        v-if="previewState.previewMode === 'markdown'"
        :filePath="previewState.previewFilePath"
        :paneId="paneId"
      />
      <TypstNativePreview
        v-else-if="previewState.previewMode === 'typst-native'"
        :filePath="previewState.previewFilePath"
        :paneId="paneId"
      />
      <DocumentPdfViewer
        v-else-if="previewState.previewMode === 'pdf' && previewState.previewFilePath"
        :filePath="previewState.previewFilePath"
        :paneId="paneId"
        :workflow-source-path="filePath"
        :workflow-preview-kind="previewState.previewMode"
        :toolbar-target-selector="toolbarTargetSelector"
      />
    </div>
  </div>
</template>

<script setup>
import { defineAsyncComponent } from 'vue'

const TextEditor = defineAsyncComponent(() => import('./TextEditor.vue'))
const MarkdownPreview = defineAsyncComponent(() => import('./MarkdownPreview.vue'))
const TypstNativePreview = defineAsyncComponent(() => import('./TypstNativePreview.vue'))
const DocumentPdfViewer = defineAsyncComponent(() => import('./DocumentPdfViewer.vue'))

defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
  previewState: { type: Object, default: null },
  toolbarTargetSelector: { type: String, default: '' },
})

defineEmits(['cursor-change', 'editor-stats', 'selection-change'])
</script>

<style scoped>
.document-workspace-tab {
  display: grid;
  min-width: 0;
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
}

.document-workspace-tab-split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.document-workspace-editor,
.document-workspace-preview {
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.document-workspace-preview {
  border-left: 1px solid var(--border-subtle);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-secondary) 82%, transparent), transparent 96px),
    var(--bg-primary);
}
</style>
