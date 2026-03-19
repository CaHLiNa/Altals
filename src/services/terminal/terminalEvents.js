import { useTerminalStore } from '../../stores/terminal'

let cleanupBridge = null

export function installTerminalEventBridge(pinia) {
  if (cleanupBridge || typeof window === 'undefined') return cleanupBridge

  const terminal = useTerminalStore(pinia)

  const handlers = {
    createLanguageTerminal: (event) => {
      terminal.hydrateForWorkspace()
      terminal.handleCreateLanguageTerminalEvent(event.detail || {})
    },
    focusLanguageTerminal: (event) => {
      terminal.hydrateForWorkspace()
      terminal.handleFocusLanguageTerminalEvent(event.detail || {})
    },
    sendToRepl: (event) => {
      terminal.hydrateForWorkspace()
      void terminal.handleSendToReplEvent(event.detail || {})
    },
    terminalLog: (event) => {
      terminal.hydrateForWorkspace()
      terminal.handleTerminalLogEvent(event.detail || {})
    },
    terminalStream: (event) => {
      terminal.hydrateForWorkspace()
      terminal.handleTerminalStreamEvent(event.detail || {})
    },
  }

  window.addEventListener('create-language-terminal', handlers.createLanguageTerminal)
  window.addEventListener('focus-language-terminal', handlers.focusLanguageTerminal)
  window.addEventListener('send-to-repl', handlers.sendToRepl)
  window.addEventListener('terminal-log', handlers.terminalLog)
  window.addEventListener('terminal-stream', handlers.terminalStream)

  cleanupBridge = () => {
    window.removeEventListener('create-language-terminal', handlers.createLanguageTerminal)
    window.removeEventListener('focus-language-terminal', handlers.focusLanguageTerminal)
    window.removeEventListener('send-to-repl', handlers.sendToRepl)
    window.removeEventListener('terminal-log', handlers.terminalLog)
    window.removeEventListener('terminal-stream', handlers.terminalStream)
    cleanupBridge = null
  }

  return cleanupBridge
}
