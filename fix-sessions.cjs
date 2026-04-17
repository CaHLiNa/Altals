const fs = require('fs')

let content = fs.readFileSync('src/components/panel/AiSessionRail.vue', 'utf-8')

// Replace `.ai-session-rail__item` styling to absorb the container styling correctly
content = content.replace(`.ai-session-rail__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 0 auto;
  max-width: 240px;
}`, `.ai-session-rail__item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 0 auto;
  max-width: 240px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  transition: border-color 140ms ease, background-color 140ms ease;
}
.ai-session-rail__item:hover,
.ai-session-rail__item.is-active {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color) 72%);
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
}`)

content = content.replace(`.ai-session-rail__main,
.ai-session-rail__editor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 200px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
}`, `.ai-session-rail__main,
.ai-session-rail__editor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 200px;
  padding: 0;
  border: none;
  background: transparent;
}`)

content = content.replace(`.ai-session-rail__main {
  appearance: none;
  cursor: pointer;
  color: var(--text-secondary);
  flex: 1 1 auto;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease;
}`, `.ai-session-rail__main {
  appearance: none;
  cursor: pointer;
  color: var(--text-secondary);
  flex: 1 1 auto;
  transition: color 140ms ease;
}`)

content = content.replace(`.ai-session-rail__main:hover,
.ai-session-rail__main.is-active {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color) 72%);
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
}`, `.ai-session-rail__main:hover,
.ai-session-rail__item:hover .ai-session-rail__main,
.ai-session-rail__main.is-active {
  color: var(--text-primary);
}`)

fs.writeFileSync('src/components/panel/AiSessionRail.vue', content)
