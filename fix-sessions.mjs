const fs = require('fs')

let content = fs.readFileSync('src/components/panel/AiSessionRail.vue', 'utf-8')

// Remove border and background from __main
content = content.replace(/\.ai-session-rail__main,\n\.ai-session-rail__editor \{\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  max-width: 200px;\n  padding: 4px 10px;\n  border-radius: 12px;\n  border: 1px solid transparent;\n  background: transparent;\n\}/g, `
.ai-session-rail__item,
.ai-session-rail__editor {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 240px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  transition: border-color 140ms ease, background-color 140ms ease, color 140ms ease;
}

.ai-session-rail__item:hover,
.ai-session-rail__item.is-active {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color) 72%);
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
}

.ai-session-rail__main {
  appearance: none;
  cursor: pointer;
  color: var(--text-secondary);
  flex: 1 1 auto;
  border: none;
  background: transparent;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ai-session-rail__item:hover .ai-session-rail__main,
.ai-session-rail__main.is-active {
  color: var(--text-primary);
}
`)

content = content.replace(/\.ai-session-rail__item \{\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  flex: 0 0 auto;\n  max-width: 240px;\n\}/g, "")

content = content.replace(`.ai-session-rail__main:hover,
.ai-session-rail__main.is-active {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-color) 72%);
  background: color-mix(in srgb, var(--surface-hover) 28%, transparent);
}`, "")

fs.writeFileSync('src/components/panel/AiSessionRail.vue', content)
