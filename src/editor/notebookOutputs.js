function toPlainText(value) {
  if (Array.isArray(value)) return value.join('')
  return value || ''
}

export function normalizeNotebookOutput(raw) {
  const type = raw.output_type || raw.type
  if (type === 'stream') {
    return {
      output_type: 'stream',
      name: raw.name || raw.data?.name || 'stdout',
      text: raw.text || raw.data?.text || '',
    }
  }
  if (type === 'display_data') {
    return {
      output_type: 'display_data',
      data: raw.data || {},
      metadata: raw.metadata || {},
    }
  }
  if (type === 'execute_result') {
    return {
      output_type: 'execute_result',
      data: raw.data || {},
      metadata: raw.metadata || {},
      execution_count: raw.execution_count || null,
    }
  }
  if (type === 'error') {
    return {
      output_type: 'error',
      ename: raw.ename || raw.data?.ename || 'Error',
      evalue: raw.evalue || raw.data?.evalue || '',
      traceback: raw.traceback || raw.data?.traceback || [],
    }
  }
  return {
    output_type: 'stream',
    name: 'stdout',
    text: JSON.stringify(raw),
  }
}

export function summarizeNotebookCellOutputs(outputs, t) {
  const text = (outputs || []).map((output) => {
    if (output.output_type === 'stream') {
      return toPlainText(output.text)
    }
    if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
      const plain = output.data?.['text/plain']
      return plain ? toPlainText(plain) : `[${t('rich output')}]`
    }
    if (output.output_type === 'error') {
      return `${output.ename}: ${output.evalue}`
    }
    return ''
  }).join('\n')

  return text || `(${t('no output')})`
}

export function buildNotebookRunAllSummary(cells, t) {
  const summary = (cells || [])
    .filter((cell) => cell.type === 'code' && cell.outputs.length > 0)
    .map((cell, index) => {
      const output = cell.outputs.map((item) => {
        if (item.output_type === 'error') return `ERROR: ${item.ename}: ${item.evalue}`
        if (item.output_type === 'stream') return toPlainText(item.text).slice(0, 200)
        return `[${t('output')}]`
      }).join('\n')
      return `Cell ${index}: ${output.slice(0, 300)}`
    })
    .join('\n\n')

  return summary || t('All cells executed (no output)')
}
