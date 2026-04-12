<template>
  <div class="launcher">
    <div class="launcher-shell">
      <section class="launcher-hero ui-surface-card">
        <div class="launcher-kicker">{{ t('Academic writing workspace') }}</div>
        <div class="launcher-brand-row">
          <div class="launcher-logo">A</div>
          <div class="launcher-brand-copy">
            <h1 class="launcher-title">Altals</h1>
            <p class="launcher-tagline">
              {{ t('Markdown, LaTeX, and Typst in one local-first project workspace.') }}
            </p>
          </div>
        </div>

        <div class="launcher-focus-copy">
          {{
            t(
              'Open a project and stay in the writing flow: draft, preview, compile, and review save points without leaving the document surface.'
            )
          }}
        </div>

        <div class="launcher-principles" aria-label="Writing workflow">
          <div class="launcher-principle">
            <span class="launcher-principle-label">{{ t('Draft') }}</span>
            <span class="launcher-principle-copy">
              {{ t('Edit notes, papers, and source files in one project tree.') }}
            </span>
          </div>
          <div class="launcher-principle">
            <span class="launcher-principle-label">{{ t('Preview') }}</span>
            <span class="launcher-principle-copy">
              {{ t('Keep structure, outline, and rendered output close while revising.') }}
            </span>
          </div>
          <div class="launcher-principle">
            <span class="launcher-principle-label">{{ t('Protect') }}</span>
            <span class="launcher-principle-copy">
              {{ t('Use save points, history, and sync as explicit safety boundaries.') }}
            </span>
          </div>
        </div>

        <div class="launcher-actions">
          <UiButton variant="primary" size="md" @click="$emit('open-folder')">
            {{ t('Open project folder') }}
            <template #trailing>
              <kbd class="ui-kbd">{{ modKey }}+O</kbd>
            </template>
          </UiButton>
        </div>

        <p class="launcher-hint">
          {{ t('Open a project folder to start your first local writing workspace.') }}
        </p>
      </section>

      <aside class="launcher-recents ui-surface-card">
        <div class="launcher-recents-header">
          <div>
            <div class="launcher-recents-kicker">{{ t('Continue writing') }}</div>
            <h2 class="launcher-recents-title">{{ t('Recent workspaces') }}</h2>
            <p class="launcher-recents-copy">
              {{ t('Jump back into the projects you were editing most recently.') }}
            </p>
          </div>
          <div class="launcher-recents-count">{{ recents.length }}</div>
        </div>

        <div v-if="recents.length" class="launcher-recent-list">
          <div v-for="r in recents" :key="r.path" class="launcher-recent">
            <button
              type="button"
              class="launcher-recent-open ui-list-row"
              @click="$emit('open-workspace', r.path)"
            >
              <span class="launcher-recent-icon" aria-hidden="true">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
                  />
                </svg>
              </span>
              <span class="launcher-recent-text">
                <span class="launcher-recent-name">{{ r.name }}</span>
                <span class="launcher-recent-path">{{ shortenPath(r.path) }}</span>
              </span>
              <span class="launcher-recent-meta">{{ t('Open') }}</span>
            </button>
            <UiButton
              variant="ghost"
              size="icon-sm"
              icon-only
              class="launcher-recent-remove"
              :title="t('Remove from recent')"
              :aria-label="t('Remove from recent')"
              @click.stop="removeRecent(r.path)"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </UiButton>
          </div>
        </div>

        <div v-else class="launcher-empty-state">
          <div class="launcher-empty-title">{{ t('No recent workspace yet') }}</div>
          <p class="launcher-empty-copy">
            {{ t('Open a project folder to start your first local writing workspace.') }}
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { modKey } from '../platform'
import { useI18n } from '../i18n'
import UiButton from './shared/ui/UiButton.vue'

const emit = defineEmits(['open-folder', 'open-workspace'])

const workspace = useWorkspaceStore()
const { t } = useI18n()
const recents = computed(() => workspace.getRecentWorkspaces())

function shortenPath(fullPath) {
  const home = fullPath.match(/^\/Users\/[^/]+/)
  if (home) return fullPath.replace(home[0], '~')
  return fullPath
}

function removeRecent(path) {
  workspace.removeRecent(path)
}
</script>

<style scoped>
.launcher {
  flex: 1;
  overflow: auto;
  padding: 24px 20px 28px;
}

.launcher-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.42fr) minmax(320px, 0.78fr);
  gap: 16px;
  width: min(100%, var(--shell-hero-width));
  min-height: 100%;
  margin: 0 auto;
  align-items: stretch;
}

.launcher-hero,
.launcher-recents {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--shell-border) 54%, transparent);
  border-radius: var(--shell-radius-lg);
  background: var(--shell-surface);
  box-shadow: none;
  backdrop-filter: blur(12px) saturate(1.04);
}

.launcher-hero::before,
.launcher-recents::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--fg-primary) 2%, transparent),
    transparent 18%
  );
}

.launcher-hero {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 28px 30px 30px;
  justify-content: center;
}

.launcher-kicker,
.launcher-recents-kicker {
  font-size: var(--ui-font-micro);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.launcher-brand-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.launcher-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: 1px solid color-mix(in srgb, var(--shell-border) 58%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--workspace-paper) 68%, transparent);
  color: var(--text-primary);
  font-size: var(--ui-font-hero-xs);
  font-family: var(--font-display);
  font-weight: 600;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--fg-primary) 5%, transparent),
    0 10px 24px color-mix(in srgb, black 8%, transparent);
}

.launcher-brand-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.launcher-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--ui-font-hero-sm);
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.01em;
  color: var(--text-primary);
}

.launcher-tagline {
  max-width: 540px;
  margin: 0;
  font-size: var(--ui-font-body);
  line-height: var(--line-height-relaxed);
  color: var(--text-secondary);
}

.launcher-focus-copy {
  max-width: 52rem;
  padding-left: 2px;
  font-size: var(--ui-font-title);
  line-height: 1.65;
  color: color-mix(in srgb, var(--text-secondary) 92%, transparent);
}

.launcher-principles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-top: 1px solid color-mix(in srgb, var(--shell-border) 42%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--shell-border) 26%, transparent);
}

.launcher-principle {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 14px 16px;
  min-height: 100%;
}

.launcher-principle:not(:first-child) {
  border-left: 1px solid color-mix(in srgb, var(--shell-border) 22%, transparent);
}

.launcher-principle-label {
  font-size: var(--ui-font-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.launcher-principle-copy {
  font-size: var(--ui-font-body);
  line-height: 1.55;
  color: var(--text-secondary);
}

.launcher-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.launcher-hint {
  margin: 0;
  font-size: var(--ui-font-label);
  line-height: var(--line-height-regular);
  color: var(--text-muted);
}

.launcher-clone-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: 14px;
  border-radius: var(--shell-radius-sm);
  background: color-mix(in srgb, var(--surface-base) 36%, transparent);
  border: 1px solid color-mix(in srgb, var(--shell-border) 36%, transparent);
}

.launcher-clone-heading {
  font-size: var(--ui-font-label);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.launcher-input {
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--shell-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-base) 82%, transparent);
  color: var(--text-primary);
}

.launcher-input:focus-visible {
  outline: none;
  border-color: var(--shell-accent-border);
  box-shadow: 0 0 0 3px var(--focus-ring);
}

.launcher-clone-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.launcher-error {
  font-size: var(--ui-font-caption);
  color: var(--error);
}

.launcher-recents {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 22px 20px 20px;
}

.launcher-recents-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.launcher-recents-title {
  margin: 4px 0 0;
  font-size: var(--ui-font-display);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.launcher-recents-copy {
  margin: 6px 0 0;
  font-size: var(--ui-font-label);
  line-height: 1.55;
  color: var(--text-muted);
}

.launcher-recents-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-base) 42%, transparent);
  color: var(--text-secondary);
  font-size: var(--ui-font-caption);
  font-weight: var(--font-weight-semibold);
}

.launcher-recent-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.launcher-recent {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  gap: 8px;
}

.launcher-recent-open {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 52px;
  padding: 11px 12px;
  border: 1px solid color-mix(in srgb, var(--shell-border) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--workspace-paper) 22%, transparent);
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease,
    box-shadow 140ms ease;
}

.launcher-recent-open:hover {
  border-color: color-mix(in srgb, var(--shell-border) 30%, transparent);
  background: color-mix(in srgb, var(--surface-hover) 22%, transparent);
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--border) 10%, transparent);
}

.launcher-recent-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--workspace-paper-muted) 74%, transparent);
  color: var(--text-secondary);
}

.launcher-recent-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.launcher-recent-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-body);
  font-weight: var(--font-weight-medium);
}

.launcher-recent-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
}

.launcher-recent-meta {
  font-size: var(--ui-font-caption);
  color: var(--text-muted);
}

.launcher-recent-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid color-mix(in srgb, var(--shell-border) 18%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--workspace-paper) 18%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.launcher-recent-remove > svg {
  width: 12px;
  height: 12px;
}

.launcher-recent-remove:hover {
  border-color: color-mix(in srgb, var(--error) 28%, transparent);
  background: color-mix(in srgb, var(--error) 8%, transparent);
  color: var(--error);
}

.launcher-empty-state {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid color-mix(in srgb, var(--shell-border) 28%, transparent);
  border-radius: 12px;
  padding: 18px;
  background: color-mix(in srgb, var(--surface-base) 24%, transparent);
}

.launcher-empty-title {
  font-size: var(--ui-font-body);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
}

.launcher-empty-copy {
  margin: 0;
  font-size: var(--ui-font-label);
  line-height: var(--line-height-regular);
  color: var(--text-muted);
}

@media (max-width: 980px) {
  .launcher-shell {
    grid-template-columns: 1fr;
  }

  .launcher-principles {
    grid-template-columns: 1fr;
  }

  .launcher-principle:not(:first-child) {
    border-left: 0;
    border-top: 1px solid color-mix(in srgb, var(--shell-border) 18%, transparent);
  }
}

@media (max-width: 720px) {
  .launcher {
    padding: 22px 18px 24px;
  }

  .launcher-hero,
  .launcher-recents {
    padding: 22px 20px;
  }

  .launcher-brand-row {
    align-items: flex-start;
  }

  .launcher-title {
    font-size: var(--ui-font-hero-sm);
  }

  .launcher-tagline {
    font-size: var(--ui-font-body);
  }

  .launcher-recent-meta {
    display: none;
  }
}
</style>
