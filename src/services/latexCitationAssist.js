import { isLatex, isMarkdown, isTypst } from '../utils/fileTypes.js'
import {
  buildLatexBibliographyInsertPlan,
  hasLatexBibliographyDirective,
} from './latexBibliography.js'

function buildCitationInsertText(filePath, keys, options = {}) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean)
  if (list.length === 0) return ''

  if (isLatex(filePath)) {
    const command = options.latexCommand || 'cite'
    return `\\${command}{${list.join(', ')}}`
  }

  if (isTypst(filePath)) {
    return list.map((key) => `@${key}`).join(' ')
  }

  if (isMarkdown(filePath)) {
    return `[${list.map((key) => `@${key}`).join('; ')}]`
  }

  return ''
}

export function insertLatexBibliographyCommands({ view, t, toastStore } = {}) {
  if (!view) return false

  const plan = buildLatexBibliographyInsertPlan(view.state.doc.toString())
  if (!plan.changes.length) return false

  view.dispatch({
    changes: plan.changes,
    scrollIntoView: true,
  })
  view.focus()
  toastStore?.show?.(t('Inserted bibliography commands for this LaTeX file.'), {
    type: 'success',
    duration: 4000,
  })
  return true
}

export function maybePromptLatexBibliography({ view, filePath, t, toastStore } = {}) {
  if (!view || !isLatex(filePath)) return false

  const content = view.state.doc.toString()
  if (hasLatexBibliographyDirective(content)) return false

  toastStore?.showOnce?.(
    `latex-bibliography:${filePath}`,
    t('This file cites references but has no bibliography command yet.'),
    {
      type: 'warning',
      duration: 12000,
      action: {
        label: t('Insert bibliography'),
        onClick: () => {
          insertLatexBibliographyCommands({ view, t, toastStore })
        },
      },
    },
    Infinity,
  )
  return true
}

export function insertCitationWithAssist({
  view,
  filePath,
  keys,
  selection,
  t,
  toastStore,
  options = {},
} = {}) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean)
  if (!view || !filePath || list.length === 0) return ''

  const range = selection || view.state.selection.main
  const text = buildCitationInsertText(filePath, list, options)
  if (!text) return ''

  view.dispatch({
    changes: { from: range.from, to: range.to, insert: text },
    selection: { anchor: range.from + text.length },
  })

  maybePromptLatexBibliography({ view, filePath, t, toastStore })
  return text
}
