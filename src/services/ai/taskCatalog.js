import { isMarkdown, isLatex, isTypst } from '../../utils/fileTypes.js'

function fileName(path) {
  return String(path || '').split('/').pop() || path
}

function isCodePath(path = '') {
  return (
    path.endsWith('.py') ||
    path.endsWith('.r') ||
    path.endsWith('.R') ||
    path.endsWith('.jl') ||
    path.endsWith('.ipynb')
  )
}

function isDatasetPath(path = '') {
  return path.endsWith('.csv') || path.endsWith('.tsv')
}

function buildWritingTasks(path, t) {
  const name = fileName(path)
  const items = [
    {
      label: t('Review current draft'),
      meta: name,
      task: {
        action: 'send',
        role: 'reviewer',
        toolProfile: 'reviewer',
        taskId: 'review.current-draft',
        artifactIntent: 'review',
        prompt:
          'Review this draft for argument quality, clarity, structure, and academic tone. Point out concrete revision opportunities.',
        filePath: path,
      },
    },
    {
      label: t('Citation help'),
      meta: name,
      task: {
        action: 'send',
        role: 'citation_librarian',
        toolProfile: 'citation_librarian',
        taskId: 'citation.current-draft',
        artifactIntent: 'citation_set',
        prompt:
          'Inspect this draft and identify claims that need stronger citation support or better integration of references.',
        filePath: path,
      },
    },
  ]

  if (isLatex(path) || isTypst(path)) {
    items.push({
      label: t('Fix TeX / Typst'),
      meta: name,
      task: createTexTypFixTask({ filePath: path }),
    })
  }

  return items
}

function buildCodeTasks(path, t) {
  const name = fileName(path)
  return [
    {
      label: t('Code assistant'),
      meta: name,
      task: {
        action: 'send',
        role: 'code_assistant',
        toolProfile: 'code_assistant',
        taskId: 'code.explain-current',
        prompt:
          'Explain this code or notebook, identify the main workflow, and call out likely issues, assumptions, or unclear areas.',
        filePath: path,
      },
    },
    {
      label: t('Check reproducibility'),
      meta: name,
      task: {
        action: 'send',
        role: 'code_assistant',
        toolProfile: 'code_assistant',
        taskId: 'code.reproducibility',
        prompt:
          'Review this code or notebook for reproducibility risks, hidden state, missing dependencies, and unclear execution steps.',
        filePath: path,
      },
    },
  ]
}

function buildDatasetTasks(path, t) {
  const name = fileName(path)
  return [
    {
      label: t('Describe dataset'),
      meta: name,
      task: {
        action: 'send',
        role: 'researcher',
        toolProfile: 'researcher',
        taskId: 'data.describe',
        prompt:
          'Describe this dataset, infer likely variable roles, point out data quality issues, and suggest the next analysis steps.',
        filePath: path,
      },
    },
  ]
}

function buildContextTasks(path, t) {
  if (!path) return []
  if (isMarkdown(path) || isLatex(path) || isTypst(path)) return buildWritingTasks(path, t)
  if (isCodePath(path)) return buildCodeTasks(path, t)
  if (isDatasetPath(path)) return buildDatasetTasks(path, t)
  return []
}

function buildWorkflowTasks(t) {
  return [
    {
      label: t('General chat'),
      meta: 'chat',
      task: {
        action: 'prefill',
        role: 'general',
        taskId: 'chat.general',
        prompt: 'Help me think through this research task.',
      },
    },
    {
      label: t('Continue writing'),
      meta: 'writer',
      task: {
        action: 'prefill',
        role: 'writer',
        toolProfile: 'writer',
        taskId: 'writer.continue',
        prompt: 'Help me continue writing this section. Start by asking what I am working on.',
      },
    },
    {
      label: t('Literature review'),
      meta: 'research',
      task: {
        action: 'prefill',
        role: 'researcher',
        toolProfile: 'researcher',
        taskId: 'research.literature-review',
        prompt: 'Help me run a literature review around this topic:',
      },
    },
    {
      label: t('Review current draft'),
      meta: 'review',
      task: {
        action: 'prefill',
        role: 'reviewer',
        toolProfile: 'reviewer',
        taskId: 'review.prefill',
        artifactIntent: 'review',
        prompt: 'Act as a critical peer reviewer. Review this draft for originality, logic, clarity, and evidence:',
      },
    },
    {
      label: t('Citation help'),
      meta: 'citations',
      task: {
        action: 'prefill',
        role: 'citation_librarian',
        toolProfile: 'citation_librarian',
        taskId: 'citation.prefill',
        artifactIntent: 'citation_set',
        prompt: 'Help me find and integrate citations for this section or claim:',
      },
    },
    {
      label: t('Code assistant'),
      meta: 'code',
      task: {
        action: 'prefill',
        role: 'code_assistant',
        toolProfile: 'code_assistant',
        taskId: 'code.prefill',
        prompt: 'Help me with this research code, notebook, or debugging task:',
      },
    },
  ]
}

export function getAiLauncherItems({ recentFiles = [], t }) {
  const items = []
  const primaryPath = recentFiles[0]?.path || ''

  const contextItems = buildContextTasks(primaryPath, t)
  contextItems.forEach((item, index) => {
    items.push({
      ...item,
      groupHeader: index === 0 ? t('Current context') : null,
      muted: true,
    })
  })

  const workflowItems = buildWorkflowTasks(t)
  workflowItems.forEach((item, index) => {
    items.push({
      ...item,
      groupHeader: index === 0 ? t('Workflows') : null,
    })
  })

  return items
}

export function createCommentReviewTask({ filePath, relativePath, count, label = 'Comment review' }) {
  const plural = count === 1 ? 'comment' : `${count} comments`
  return {
    action: 'send',
    role: 'reviewer',
    toolProfile: 'reviewer',
    taskId: 'comments.review',
    source: 'comments',
    entryContext: 'comments',
    label,
    filePath,
    prompt: `Review and address the ${plural} on ${relativePath}. Resolve questions, suggest concrete edits, and use the comment tools when appropriate.`,
  }
}

export function createSelectionAskTask({ label = 'Ask AI' } = {}) {
  return {
    role: 'general',
    taskId: 'selection.ask',
    source: 'selection',
    entryContext: 'selection',
    label,
    toolProfile: null,
  }
}

export function createTexTypFixTask({ filePath, label = 'Fix TeX / Typst', source = 'launcher', entryContext = 'document' } = {}) {
  return {
    action: 'send',
    role: 'tex_typ_fixer',
    toolProfile: 'tex_typ_fixer',
    taskId: 'fix.tex-typ',
    artifactIntent: 'patch',
    source,
    entryContext,
    label,
    filePath,
    prompt:
      'Inspect this source file for syntax, structure, and likely compilation issues. Prefer the smallest safe fixes first.',
  }
}
