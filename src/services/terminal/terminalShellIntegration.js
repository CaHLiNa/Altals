export const TERMINAL_SHELL_OSC = 633

function escapeOscScript(lines) {
  return `${lines.filter(Boolean).join('\n')}\n`
}

export function parseShellIntegrationPayload(data = '') {
  const raw = String(data || '')
  const separator = raw.indexOf(';')
  if (separator === -1) {
    return { type: raw, payload: '' }
  }
  return {
    type: raw.slice(0, separator),
    payload: raw.slice(separator + 1),
  }
}

function buildZshBootstrap() {
  return escapeOscScript([
    "function __altals_emit() { printf '\\033]633;%s\\007' \"$1\" }",
    "function __altals_preexec() { __altals_emit \"CmdStart;$1\" }",
    "function __altals_precmd() { local status=\"$?\"; __altals_emit \"Cwd;$PWD\"; __altals_emit \"CmdFinish;$status\" }",
    'autoload -Uz add-zsh-hook 2>/dev/null',
    'add-zsh-hook preexec __altals_preexec 2>/dev/null',
    'add-zsh-hook precmd __altals_precmd 2>/dev/null',
    '__altals_emit "Cwd;$PWD"',
  ])
}

function buildBashBootstrap() {
  return escapeOscScript([
    "__altals_emit() { printf '\\033]633;%s\\007' \"$1\"; }",
    '__altals_last_histcmd=""',
    '__altals_preexec() {',
    '  [[ -n "$COMP_LINE" ]] && return',
    '  [[ "${BASH_COMMAND:-}" == "__altals_precmd"* ]] && return',
    '  if [[ "${__altals_last_histcmd:-}" == "${HISTCMD:-}" ]]; then return; fi',
    '  __altals_last_histcmd="${HISTCMD:-}"',
    '  __altals_emit "CmdStart;${BASH_COMMAND:-}"',
    '}',
    '__altals_precmd() {',
    '  local status="$?"',
    '  __altals_emit "Cwd;$PWD"',
    '  if [[ -n "${__altals_last_histcmd:-}" ]]; then',
    '    __altals_emit "CmdFinish;$status"',
    '  fi',
    '}',
    "trap '__altals_preexec' DEBUG",
    'PROMPT_COMMAND="__altals_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND}"',
    '__altals_emit "Cwd;$PWD"',
  ])
}

export function buildShellIntegrationBootstrap(shellCmd = '') {
  const normalized = String(shellCmd || '').toLowerCase()
  if (normalized.includes('zsh')) return buildZshBootstrap()
  if (normalized.includes('bash')) return buildBashBootstrap()
  return ''
}
