# Right Dock Smoke Checklist

Use this checklist after changing the inline right dock. It is intentionally manual because the dock depends on desktop workspace state, local files, PDF artifacts, and user-controlled visual confirmation.

## Document Workspace

- Open a Markdown file, toggle preview, and confirm the preview icon tab appears.
- Compile a LaTeX file with warnings/errors and confirm the Problems tab appears with a count.
- Click a LaTeX problem and confirm the source document is opened and highlighted at the reported line.
- Close the Problems tab and confirm it stays hidden until the next LaTeX compile.
- Close the document dock while Problems is available and confirm it stays hidden until the next LaTeX compile.
- Fix or switch away from LaTeX diagnostics and confirm Problems disappears or falls back cleanly.
- Open a second file from the file tree into the document dock and confirm the dynamic file tab appears.
- Close the dynamic file tab and confirm the dock falls back to preview, Problems, or closes when no contextual page remains.
- Close the preview tab and confirm the dock falls back to a remaining file tab, Problems, or closes when no contextual page remains.
- Drag the document dock divider and confirm the editor is squeezed instead of covered.
- Double-click the divider and confirm snap/restore keeps a readable editor width.

## Reference Library

- Open the reference library and select a reference.
- Confirm Details is the default permanent tab.
- Select a cited reference and confirm Cited In appears with a count.
- Select an uncited reference and confirm Cited In is hidden.
- Open an attached PDF and confirm the PDF tab appears as a dynamic tab.
- Switch Details -> Cited In -> PDF and confirm the active tab can return from each state.
- Close the PDF tab and confirm the dock falls back to Details.
- Select another reference and confirm dynamic PDF state resets to Details.
- Drag the reference dock divider and confirm the reference list is squeezed instead of covered.
- Double-click the divider and confirm snap/restore keeps a readable reference list width.

## Cross Surface

- Switch Files <-> References and confirm each surface keeps its own dock page contract.
- Use the top-right rail toggle and confirm it opens/closes the active surface dock.
- Restart the desktop app and confirm persisted active pages normalize to valid contract pages.
- Search for `RightSidebar.vue|right-shell-sidebar|right-shell-pane` and confirm there is no old component entrypoint in `src/`.
