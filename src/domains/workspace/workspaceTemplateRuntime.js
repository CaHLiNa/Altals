const DEFAULT_TRANSLATOR = (value) => value

export const WORKSPACE_DOCUMENT_TEMPLATES = Object.freeze([
  {
    id: 'markdown-note',
    ext: '.md',
    label: 'Markdown note',
    description: 'Quick notes, reading summaries, and lightweight drafts.',
    filename: 'note.md',
  },
  {
    id: 'latex-article',
    ext: '.tex',
    label: 'LaTeX article',
    description: 'Article-style manuscript with title block and document shell.',
    filename: 'article.tex',
  },
  {
    id: 'python-script',
    ext: '.py',
    label: 'Python script',
    description: 'Quick scripts, experiments, and small research helpers.',
    filename: 'script.py',
  },
])

export function listWorkspaceDocumentTemplates(t = DEFAULT_TRANSLATOR) {
  return WORKSPACE_DOCUMENT_TEMPLATES.map((template) => ({
    ...template,
    label: t(template.label),
    description: t(template.description),
  }))
}
