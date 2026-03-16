<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-1 overflow-hidden">
      <PdfViewer
        v-if="hasPdf"
        :key="pdfReloadKey"
        :filePath="pdfPath"
        :paneId="paneId"
        :toolbar-target-selector="toolbarTargetSelector"
      />
      <div v-else class="flex items-center justify-center h-full" style="color: var(--fg-muted);">
        <div class="text-center text-sm">
          <div v-if="compileStatus === 'compiling'">
            {{ t('Compiling…') }}
          </div>
          <div v-else-if="compileStatus === 'error'">
            <div>{{ t('Compilation failed — see Terminal.') }}</div>
            <div class="mt-1 text-xs">{{ t('Diagnostics are shown in Terminal.') }}</div>
          </div>
          <div v-else-if="!typstStore.available && typstStore.lastCompilerCheckAt">
            {{ t('Typst compiler not available yet.') }}
          </div>
          <div v-else>
            {{ t('No PDF yet — click Compile in the .typ tab') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useTypstStore } from '../../stores/typst'
import { useI18n } from '../../i18n'
import { useCompiledPdfPreview } from '../../composables/useCompiledPdfPreview'
import PdfViewer from './PdfViewer.vue'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
  toolbarTargetSelector: { type: String, default: '' },
})

const typstStore = useTypstStore()
const { t } = useI18n()

const typPath = computed(() => props.filePath.replace(/\.pdf$/i, '.typ'))
const state = computed(() => typstStore.stateForFile(typPath.value))
const compileStatus = computed(() => state.value?.status || null)
const pdfPath = computed(() => state.value?.pdfPath || props.filePath)
const { hasPdf, pdfReloadKey } = useCompiledPdfPreview({
  pdfPathRef: pdfPath,
  reloadEventName: 'typst-compile-done',
  matchesReloadEvent: (event) => event.detail?.typPath === typPath.value,
})

onMounted(() => {
  typstStore.checkCompiler()
})
</script>
