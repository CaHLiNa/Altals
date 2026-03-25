<template>
  <div class="sync-popover">
    <div class="sync-header">{{ t('GitHub Sync') }}</div>
    <div class="sync-body">
      <!-- Status -->
      <div class="sync-row">
        <span class="sync-dot" :class="dotClass"></span>
        <span class="sync-status-text">{{ statusText }}</span>
      </div>

      <!-- Remote -->
      <div v-if="workspace.remoteUrl" class="sync-row">
        <span class="sync-label">{{ t('Repository') }}</span>
        <a class="sync-link" :href="repoHtmlUrl" @click.prevent="openInBrowser(repoHtmlUrl)">{{
          repoName
        }}</a>
      </div>

      <!-- Last sync time -->
      <div v-if="workspace.lastSyncTime" class="sync-row">
        <span class="sync-label">{{ t('Last sync') }}</span>
        <span class="sync-value">{{ formatRelativeFromNow(workspace.lastSyncTime) }}</span>
      </div>

      <!-- Error guidance (contextual, not raw) -->
      <div v-if="workspace.syncStatus === 'error'" class="sync-guidance" :class="guidanceClass">
        <div class="sync-guidance-text">{{ guidanceText }}</div>
        <div v-if="workspace.syncErrorType === 'auth'" class="sync-guidance-actions">
          <UiButton
            class="sync-action-btn"
            variant="secondary"
            size="sm"
            @click="$emit('open-settings')"
          >
            {{ t('Reconnect') }}
          </UiButton>
        </div>
      </div>

      <!-- Conflict info -->
      <div v-if="workspace.syncConflictBranch" class="sync-conflict">
        <span>{{
          t(
            "Your local changes and GitHub are out of sync. We've saved your version to {branch}.",
            { branch: workspace.syncConflictBranch }
          )
        }}</span>
        <div class="sync-conflict-hint">{{ t('Resolve on GitHub, then click Refresh.') }}</div>
        <div class="sync-conflict-actions">
          <UiButton
            class="sync-action-btn"
            variant="primary"
            size="sm"
            @click="openInBrowser(repoHtmlUrl)"
          >
            {{ t('Open GitHub') }}
          </UiButton>
          <UiButton class="sync-action-btn" variant="secondary" size="sm" @click="$emit('refresh')">
            {{ t('Refresh') }}
          </UiButton>
        </div>
      </div>

      <!-- Actions -->
      <div class="sync-actions">
        <UiButton
          v-if="workspace.remoteUrl && workspace.syncStatus !== 'syncing'"
          class="sync-action-btn primary"
          variant="primary"
          size="sm"
          @click="$emit('sync-now')"
        >
          {{ t('Sync Now') }}
        </UiButton>
        <UiButton
          v-if="!workspace.githubUser"
          class="sync-action-btn primary"
          variant="primary"
          size="sm"
          @click="$emit('open-settings')"
        >
          {{ t('Connect GitHub') }}
        </UiButton>
        <UiButton
          v-else-if="!workspace.remoteUrl"
          class="sync-action-btn primary"
          variant="primary"
          size="sm"
          @click="$emit('open-settings')"
        >
          {{ t('Link Repository') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import UiButton from '../shared/ui/UiButton.vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { formatRelativeFromNow, useI18n } from '../../i18n'

defineEmits(['sync-now', 'refresh', 'open-settings'])

const workspace = useWorkspaceStore()
const { t } = useI18n()

const dotClass = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced':
      return 'good'
    case 'syncing':
      return 'syncing'
    case 'conflict':
      return 'warning'
    case 'error':
      return 'error'
    case 'idle':
      return 'idle'
    default:
      return 'none'
  }
})

const statusText = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced':
      return t('Up to date')
    case 'syncing':
      return t('Syncing...')
    case 'conflict':
      return t('Needs your input')
    case 'error':
      return t('Needs attention')
    case 'idle':
      return t('Connected')
    case 'disconnected':
      return workspace.githubUser ? t('No repository linked') : t('Not connected')
    default:
      return t('Not connected')
  }
})

const guidanceText = computed(() => {
  switch (workspace.syncErrorType) {
    case 'auth':
      return t('Your GitHub connection has expired.')
    case 'network':
      return t("Can't reach GitHub right now. Will retry automatically.")
    default: {
      const raw = workspace.syncError || ''
      // Strip "Push failed: " prefix for cleaner display
      const clean = raw.replace(/^(Push failed|Fetch failed): /i, '')
      return clean || t('Something went wrong. Sync will retry automatically.')
    }
  }
})

const guidanceClass = computed(() => {
  return workspace.syncErrorType === 'auth' ? 'auth' : ''
})

const repoName = computed(() => {
  const url = workspace.remoteUrl
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/)
  return match ? match[1] : url
})

const repoHtmlUrl = computed(() => {
  const name = repoName.value
  return name.startsWith('http') ? name : `https://github.com/${name}`
})

async function openInBrowser(url) {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {
    // keep the popover stable if shell open is unavailable
  }
}
</script>

<style scoped>
.sync-popover {
  width: 260px;
}

.sync-header {
  padding: 8px 12px;
  font-size: var(--ui-font-caption);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted);
  border-bottom: 1px solid var(--border);
}

.sync-body {
  padding: 8px 12px;
}

.sync-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: var(--ui-font-label);
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sync-dot.good {
  background: var(--fg-muted);
}
.sync-dot.syncing {
  background: var(--fg-muted);
  animation: pulse 1.5s infinite;
}
.sync-dot.warning {
  background: var(--warning);
}
.sync-dot.error {
  background: var(--error);
}
.sync-dot.idle {
  background: var(--accent);
}
.sync-dot.none {
  background: var(--fg-muted);
  opacity: 0.4;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.sync-status-text {
  color: var(--fg-primary);
  font-weight: 500;
}

.sync-label {
  color: var(--fg-muted);
  min-width: 70px;
}

.sync-value {
  color: var(--fg-secondary);
}

.sync-link {
  color: var(--accent);
  cursor: pointer;
  font-size: var(--ui-font-label);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-link:hover {
  text-decoration: underline;
}

.sync-guidance {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(247, 118, 142, 0.1);
  font-size: var(--ui-font-label);
  line-height: 1.4;
}

.sync-guidance-text {
  color: var(--fg-secondary);
}

.sync-guidance.auth .sync-guidance-text {
  color: var(--error);
}

.sync-guidance-actions {
  margin-top: 6px;
}

.sync-conflict {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(224, 175, 104, 0.1);
  color: var(--warning);
  font-size: var(--ui-font-label);
  line-height: 1.4;
}

.sync-conflict-hint {
  margin-top: 4px;
  font-size: var(--ui-font-caption);
  color: var(--fg-muted);
}

.sync-conflict-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.sync-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.sync-action-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: none;
  color: var(--fg-secondary);
  font-size: var(--ui-font-label);
  cursor: pointer;
}

.sync-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sync-action-btn.primary {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(122, 162, 247, 0.1);
  width: 100%;
}

.sync-action-btn.primary:hover {
  background: rgba(122, 162, 247, 0.2);
}
</style>
