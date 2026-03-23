import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildPdfTranslateProviderExtra,
  compactPdfTranslateProviderOptions,
  createDefaultPdfTranslateProviderOptions,
  normalizePdfTranslateProviderOptions,
} from '../src/services/pdfTranslateProviderOptions.js'

test('provider PDF translation options normalize OpenAI-compatible controls', () => {
  const options = normalizePdfTranslateProviderOptions('openai', {
    timeout: '120',
    temperature: '3.5',
    reasoningEffort: 'invalid',
    jsonMode: true,
    sendTemperature: 'yes',
  })

  assert.deepEqual(options, {
    ...createDefaultPdfTranslateProviderOptions('openai'),
    timeout: 120,
    temperature: 2,
    reasoningEffort: '',
    jsonMode: true,
    sendTemperature: false,
  })
})

test('provider PDF translation options compact defaults and map to pdf2zh_next field names', () => {
  const compacted = compactPdfTranslateProviderOptions('openai', {
    timeout: '',
    temperature: 0.2,
    reasoningEffort: 'high',
    jsonMode: true,
    sendTemperature: false,
    sendReasoningEffort: true,
  })

  assert.deepEqual(compacted, {
    temperature: 0.2,
    reasoningEffort: 'high',
    jsonMode: true,
    sendReasoningEffort: true,
  })

  assert.deepEqual(buildPdfTranslateProviderExtra('openai', {
    pdfTranslateOptions: compacted,
  }), {
    openai_temperature: 0.2,
    openai_reasoning_effort: 'high',
    openai_enable_json_mode: true,
    openai_send_reasoning_effort: true,
  })
})
