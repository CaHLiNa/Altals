export const EXTERNAL_TOOLS = ['web_search', 'search_papers', 'fetch_url', 'add_reference']

export const TOOL_CATEGORIES = [
  {
    id: 'workspace',
    label: 'Workspace',
    defaultCollapsed: true,
    subgroups: [
      {
        label: 'Read & Browse',
        tools: [
          { name: 'read_file', description: 'Read file contents' },
          { name: 'list_files', description: 'List files and directories' },
          { name: 'search_content', description: 'Search text across files' },
        ],
      },
      {
        label: 'Create & Edit',
        tools: [
          { name: 'write_file', description: 'Create or overwrite a file' },
          { name: 'edit_file', description: 'Edit an existing file' },
          { name: 'rename_file', description: 'Rename a file or directory' },
          { name: 'move_file', description: 'Move a file to another directory' },
          { name: 'duplicate_file', description: 'Duplicate a file' },
          { name: 'delete_file', description: 'Delete a file' },
        ],
      },
      {
        label: 'System',
        tools: [
          { name: 'run_command', description: 'Execute a safe workspace command' },
        ],
      },
    ],
  },
  {
    id: 'references',
    label: 'References',
    tools: [
      { name: 'search_references', description: 'Search local library' },
      { name: 'get_reference', description: 'Get reference metadata' },
      { name: 'add_reference', description: 'Add by DOI or BibTeX', external: 'CrossRef' },
      { name: 'cite_reference', description: 'Insert citation at cursor' },
      { name: 'edit_reference', description: 'Edit reference metadata' },
    ],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    tools: [
      { name: 'add_comment', description: 'Add comment to text' },
      { name: 'reply_to_comment', description: 'Reply to a comment' },
      { name: 'resolve_comment', description: 'Resolve a comment' },
      { name: 'create_proposal', description: 'Present choice cards' },
    ],
  },
  {
    id: 'compile',
    label: 'Compile & Diagnose',
    tools: [
      { name: 'compile_document', description: 'Compile a TeX / Typst source and return diagnostics' },
    ],
  },
  {
    id: 'notebook',
    label: 'Notebooks',
    tools: [
      { name: 'read_notebook', description: 'Read notebook cells & outputs' },
      { name: 'edit_cell', description: 'Edit a notebook cell' },
      { name: 'run_cell', description: 'Execute a notebook cell' },
      { name: 'run_all_cells', description: 'Execute all cells' },
      { name: 'add_cell', description: 'Insert a new cell' },
      { name: 'delete_cell', description: 'Remove a cell' },
    ],
  },
  {
    id: 'web',
    label: 'Web Research',
    tools: [
      { name: 'web_search', description: 'Search the web', external: 'Exa' },
      { name: 'search_papers', description: 'Search academic papers', external: 'OpenAlex + Exa' },
      { name: 'fetch_url', description: 'Fetch web page content', external: 'Exa' },
    ],
  },
]

export function flattenToolRegistry(categories = TOOL_CATEGORIES) {
  const tools = []

  for (const category of categories) {
    if (category.subgroups?.length) {
      for (const subgroup of category.subgroups) {
        for (const tool of subgroup.tools || []) {
          tools.push({
            ...tool,
            categoryId: category.id,
            categoryLabel: category.label,
            subgroupLabel: subgroup.label,
          })
        }
      }
      continue
    }

    for (const tool of category.tools || []) {
      tools.push({
        ...tool,
        categoryId: category.id,
        categoryLabel: category.label,
        subgroupLabel: null,
      })
    }
  }

  return tools
}

export function getCategoryTools(category) {
  if (!category) return []
  if (category.tools?.length) return category.tools
  if (category.subgroups?.length) {
    return category.subgroups.flatMap((subgroup) => subgroup.tools || [])
  }
  return []
}

export function categoryToolCount(category) {
  return getCategoryTools(category).length
}

export function categoryHasExternal(category) {
  return getCategoryTools(category).some((tool) => !!tool.external)
}

export function categoryAllLocal(category) {
  return getCategoryTools(category).every((tool) => !tool.external)
}

export const TOOL_GROUPS = {
  workspace_read: ['read_file', 'list_files', 'search_content'],
  workspace_safe_edit: ['write_file', 'edit_file'],
  workspace_manage: ['rename_file', 'move_file', 'duplicate_file'],
  workspace_delete: ['delete_file'],
  system: ['run_command'],
  references: ['search_references', 'get_reference', 'add_reference', 'cite_reference', 'edit_reference'],
  feedback: ['add_comment', 'reply_to_comment', 'resolve_comment', 'create_proposal'],
  compile: ['compile_document'],
  notebook: ['read_notebook', 'edit_cell', 'run_cell', 'run_all_cells', 'add_cell', 'delete_cell'],
  web: ['web_search', 'search_papers', 'fetch_url'],
}

export const ROLE_TOOL_PROFILES = {
  writer: ['workspace_read', 'workspace_safe_edit', 'references', 'feedback'],
  researcher: ['workspace_read', 'references', 'feedback', 'web'],
  reviewer: ['workspace_read', 'references', 'feedback', 'web'],
  citation_librarian: ['workspace_read', 'references', 'feedback', 'web'],
  code_assistant: ['workspace_read', 'workspace_safe_edit', 'workspace_manage', 'feedback', 'notebook', 'system'],
  tex_typ_fixer: ['workspace_read', 'workspace_safe_edit', 'workspace_manage', 'feedback', 'compile', 'system'],
  pdf_translator: ['workspace_read', 'feedback'],
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))]
}

export function expandToolGroups(groups = []) {
  const expanded = []

  for (const group of groups) {
    if (!group) continue
    if (TOOL_GROUPS[group]) {
      expanded.push(...TOOL_GROUPS[group])
      continue
    }
    expanded.push(group)
  }

  return unique(expanded)
}

export function resolveAllowedToolNames(options = {}) {
  const explicitTools = unique(options.allowedTools || [])
  if (explicitTools.length > 0) return explicitTools

  const profile = String(options.profile || '').trim()
  if (profile === 'all' || profile === 'unrestricted') return null

  const role = String(options.role || '').trim()
  const profileKey = profile || role
  if (!profileKey) return null

  const groups = ROLE_TOOL_PROFILES[profileKey]
  if (!groups?.length) return null

  return expandToolGroups(groups)
}
