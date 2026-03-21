import test from 'node:test'
import assert from 'node:assert/strict'
import { collectArtifactsFromMessage } from '../src/services/ai/artifacts.js'

test('inferred workflow text artifacts do not duplicate summary and body', () => {
  const artifacts = collectArtifactsFromMessage(
    {
      id: 'msg-1',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '已明确这次运行的任务目标、输出边界和停止条件。',
        },
      ],
    },
    {
      role: 'reviewer',
      label: '审查当前草稿',
      artifactIntent: 'review',
      sourceFile: '/Users/math173sr/Desktop/Altals.md',
    },
  )

  assert.equal(artifacts.length, 1)
  assert.equal(artifacts[0].body, '已明确这次运行的任务目标、输出边界和停止条件。')
  assert.equal(artifacts[0].summary, '')
})
