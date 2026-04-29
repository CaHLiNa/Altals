<template>
  <div class="plugin-job-panel">
    <div v-if="jobs.length === 0" class="plugin-job-empty">{{ t('No plugin jobs yet') }}</div>
    <div v-for="job in jobs" :key="job.id" class="plugin-job-row">
      <div class="plugin-job-main">
        <div class="plugin-job-title">
          <span>{{ job.capability }}</span>
          <span class="plugin-job-state" :class="`is-${job.state}`">{{ job.state }}</span>
        </div>
        <div class="plugin-job-meta">
          {{ job.pluginId || t('Unknown plugin') }}
          <span v-if="job.error"> · {{ job.error }}</span>
        </div>
        <div v-if="job.artifacts?.length" class="plugin-artifacts">
          <button
            v-for="artifact in job.artifacts"
            :key="artifact.id || artifact.path"
            type="button"
            class="plugin-artifact-link"
            @click="openArtifact(artifact)"
          >
            {{ artifact.kind || t('Artifact') }}
          </button>
        </div>
      </div>
      <div class="plugin-job-actions">
        <UiButton
          v-if="job.state === 'running' || job.state === 'queued'"
          variant="secondary"
          size="sm"
          @click="pluginsStore.cancelJob(job.id)"
        >
          {{ t('Cancel') }}
        </UiButton>
        <UiButton
          v-if="job.logPath"
          variant="ghost"
          size="sm"
          @click="pluginsStore.revealArtifact({ path: job.logPath })"
        >
          {{ t('Log') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../../i18n'
import { useEditorStore } from '../../stores/editor'
import { usePluginsStore } from '../../stores/plugins'
import UiButton from '../shared/ui/UiButton.vue'

const { t } = useI18n()
const editorStore = useEditorStore()
const pluginsStore = usePluginsStore()
const jobs = computed(() => pluginsStore.recentJobs)

function openArtifact(artifact = {}) {
  const path = String(artifact?.path || '')
  const isPdf = artifact?.mediaType === 'application/pdf' || path.toLowerCase().endsWith('.pdf')
  if (isPdf && path) {
    editorStore.openFile(path)
    return
  }
  void pluginsStore.openArtifact(artifact)
}
</script>

<style scoped>
.plugin-job-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.plugin-job-empty {
  padding: 14px 16px;
  color: var(--text-muted);
  font-size: 12px;
}

.plugin-job-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
}

.plugin-job-row:last-child {
  border-bottom: none;
}

.plugin-job-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.plugin-job-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
}

.plugin-job-state {
  font-size: 11px;
  color: var(--text-muted);
}

.plugin-job-state.is-succeeded {
  color: var(--success);
}

.plugin-job-state.is-failed {
  color: var(--error);
}

.plugin-job-meta {
  font-size: 12px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
}

.plugin-artifacts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.plugin-artifact-link {
  border: none;
  padding: 0;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  cursor: pointer;
}

.plugin-job-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}
</style>
