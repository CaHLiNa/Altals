<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div class="context-menu" :style="menuStyle">
        <!-- Creation section (folders and empty space only) -->
        <template v-if="!entry || entry.is_dir">
          <div class="context-menu-item" @click="$emit('create', { ext: null, isDir: true })">
            <IconFolderPlus :size="14" :stroke-width="1.5" />
            <span class="flex-1">{{ t('New Folder') }}</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: null })">
            <IconFilePlus :size="14" :stroke-width="1.5" />
            <span class="flex-1">{{ t('New File...') }}</span>
          </div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.md' })">
            <IconFileText :size="14" :stroke-width="1.5" />
            <span class="flex-1">{{ t('Markdown') }}</span>
            <span class="context-menu-ext">.md</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.tex' })">
            <IconMath :size="14" :stroke-width="1.5" />
            <span class="flex-1">{{ t('LaTeX') }}</span>
            <span class="context-menu-ext">.tex</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.typ' })">
            <IconMath :size="14" :stroke-width="1.5" />
            <span class="flex-1">Typst</span>
            <span class="context-menu-ext">.typ</span>
          </div>
        </template>

        <!-- Actions section -->
        <template v-if="entry">
          <div v-if="entry.is_dir" class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('rename', entry)">
            <IconPencil :size="14" :stroke-width="1.5" />
            {{ t('Rename') }}
          </div>
          <div class="context-menu-item" @click="$emit('duplicate', entry)">
            <IconCopy :size="14" :stroke-width="1.5" />
            {{ t('Duplicate') }}
          </div>
          <div class="context-menu-item context-menu-item-danger" @click="$emit('delete', entry)">
            <IconTrash :size="14" :stroke-width="1.5" />
            {{ t('Delete') }}
          </div>
        </template>

        <div v-if="selectedCount > 1" class="context-menu-separator"></div>
        <div v-if="selectedCount > 1" class="context-menu-item context-menu-item-danger" @click="$emit('delete-selected')">
          <IconTrash :size="14" :stroke-width="1.5" />
          {{ t('Delete {count} selected', { count: selectedCount }) }}
        </div>

        <template v-if="entry && !entry.is_dir">
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('file-version-history', entry)">
            <IconClock :size="14" :stroke-width="1.5" />
            {{ t('File Version History') }}
          </div>
        </template>

        <template v-if="entry">
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('reveal-in-finder', entry)">
            <IconExternalLink :size="14" :stroke-width="1.5" />
            {{ revealLabel }}
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import {
  IconFileText,
  IconMath,
  IconFilePlus,
  IconFolderPlus,
  IconPencil,
  IconCopy,
  IconTrash,
  IconClock,
  IconExternalLink,
} from '@tabler/icons-vue'
import { isMac } from '../../platform'
import { useI18n } from '../../i18n'

const isWindows = /Win/.test(navigator.platform)
const { t } = useI18n()
const revealLabel = isMac ? t('Reveal in Finder') : isWindows ? t('Show in Explorer') : t('Open in File Manager')

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  entry: { type: Object, default: null },
  selectedCount: { type: Number, default: 0 },
})

defineEmits(['close', 'create', 'rename', 'duplicate', 'delete', 'delete-selected', 'file-version-history', 'reveal-in-finder'])

// Keep menu within viewport
const menuStyle = computed(() => {
  const menuWidth = 220
  const menuHeight = (props.entry ? 13 : 8) * 28 + 16
  const maxX = window.innerWidth - menuWidth - 8
  const maxY = window.innerHeight - menuHeight - 8
  return {
    left: Math.min(props.x, maxX) + 'px',
    top: Math.min(props.y, maxY) + 'px',
  }
})
</script>

<style>
.context-menu-ext {
  font-size: 10.5px;
  color: color-mix(in srgb, var(--text-muted) 76%, transparent);
  opacity: 1;
  margin-left: auto;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}
</style>
