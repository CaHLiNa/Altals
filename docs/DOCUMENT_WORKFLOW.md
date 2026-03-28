# Document Workflow

Altals currently supports one document workflow family: Markdown, LaTeX, and Typst authoring inside a local workspace.

## Supported Sources

- Markdown source files
- LaTeX source files
- Typst source files

## Supported Outputs

- Markdown preview
- Typst native preview
- PDF viewer output for generated documents

## Workflow Rules

- Source files stay editable in the text editor surface.
- Preview paths are derived from a source file and must resolve back to that source.
- LaTeX and Typst compile actions should expose missing-tool and build-failure states clearly.
- PDF viewing should stay focused on reading, search, outline, thumbnails, and source-position sync.

## Tooling Dependencies

- Markdown preview uses built-in frontend rendering.
- LaTeX workflows depend on a local TeX toolchain.
- Typst workflows depend on local Typst and Tinymist tooling.
- Git integration is optional but supported for project sync and history.

## Validation

- Open each supported source type.
- Trigger its primary preview or compile action.
- Confirm the right sidebar exposes document-run state when relevant.
- Confirm unsupported files fall back to the unsupported-file pane.
