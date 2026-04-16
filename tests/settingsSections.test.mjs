import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SETTINGS_SECTION_DEFINITIONS,
  normalizeSettingsSectionId,
} from '../src/components/settings/settingsSections.js'

test('settings sections expose zotero entry', () => {
  assert.ok(SETTINGS_SECTION_DEFINITIONS.some((section) => section.id === 'zotero'))
})

test('settings sections expose a single top-level agent entry', () => {
  assert.ok(SETTINGS_SECTION_DEFINITIONS.some((section) => section.id === 'agent'))
  assert.equal(
    SETTINGS_SECTION_DEFINITIONS.some((section) => section.id === 'ai'),
    false
  )
  assert.equal(
    SETTINGS_SECTION_DEFINITIONS.some((section) => section.id === 'skills'),
    false
  )
})

test('normalizeSettingsSectionId migrates legacy ai and skills sections into agent', () => {
  assert.equal(normalizeSettingsSectionId('ai'), 'agent')
  assert.equal(normalizeSettingsSectionId('skills'), 'agent')
  assert.equal(normalizeSettingsSectionId('theme'), 'theme')
})
