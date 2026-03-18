import { autocompletion } from '@codemirror/autocomplete'
import { tooltips } from '@codemirror/view'
import { isTypst } from '../../../utils/fileTypes.js'
import { createTinymistTypstCompletionSource } from './completions.js'
import { createTinymistTypstHighlightExtension } from './highlight.js'
import { createTinymistTypstHoverExtension } from './hover.js'
import { createTinymistTypstDocumentLinksExtension } from './documentLinks.js'
import { createTinymistTypstFoldingExtension } from './folding.js'
import { createTinymistTypstSignatureHelpExtension } from './signatureHelp.js'

export function supportsTinymistTypstEditor(filePath) {
  return isTypst(filePath)
}

export function createTinymistTypstEditorExtensions(options = {}) {
  const completionSource = createTinymistTypstCompletionSource(options)
  const tooltipConfig = {
    position: 'fixed',
  }

  if (typeof document !== 'undefined' && document.body) {
    tooltipConfig.parent = document.body
  }

  return [
    tooltips(tooltipConfig),
    ...createTinymistTypstHighlightExtension(options),
    ...createTinymistTypstHoverExtension(options),
    ...createTinymistTypstDocumentLinksExtension(options),
    ...createTinymistTypstFoldingExtension(options),
    ...createTinymistTypstSignatureHelpExtension(options),
    autocompletion({
      override: [completionSource],
      activateOnTyping: true,
      activateOnTypingDelay: 0,
      defaultKeymap: true,
    }),
  ]
}
