import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveMinimumLeftSidebarWidth,
  resolveMinimumRightSidebarWidth,
} from '../src/composables/useAppShellLayout.js'

test('left sidebar minimum width matches the outline-to-references gap on standard chrome', () => {
  const width = resolveMinimumLeftSidebarWidth({
    railWidth: 44,
    currentSidebarWidth: 240,
    collapseButtonLeft: 246,
    collapseButtonWidth: 30,
    rightmostPanelRight: 150,
    panelGap: 4,
  })

  assert.equal(width, 148)
})

test('left sidebar minimum width expands when the fixed panel group starts after mac traffic lights', () => {
  const width = resolveMinimumLeftSidebarWidth({
    railWidth: 44,
    currentSidebarWidth: 240,
    collapseButtonLeft: 246,
    collapseButtonWidth: 30,
    rightmostPanelRight: 170,
    panelGap: 4,
  })

  assert.equal(width, 168)
})

test('left sidebar minimum width stays pinned to the shared maximum when the current surface only has one sidebar button', () => {
  const width = resolveMinimumLeftSidebarWidth({
    railWidth: 44,
    currentSidebarWidth: 240,
    collapseButtonLeft: 246,
    collapseButtonWidth: 30,
    rightmostPanelRight: 82,
    panelGap: 4,
    currentPanelCount: 1,
    maxPanelCount: 3,
    panelButtonWidth: 30,
  })

  assert.equal(width, 148)
})

test('left sidebar minimum width stays pinned to the shared maximum when the current surface has two sidebar buttons', () => {
  const width = resolveMinimumLeftSidebarWidth({
    railWidth: 44,
    currentSidebarWidth: 240,
    collapseButtonLeft: 246,
    collapseButtonWidth: 30,
    rightmostPanelRight: 116,
    panelGap: 4,
    currentPanelCount: 2,
    maxPanelCount: 3,
    panelButtonWidth: 30,
  })

  assert.equal(width, 148)
})

test('left sidebar minimum width falls back when chrome measurements are incomplete', () => {
  const width = resolveMinimumLeftSidebarWidth({
    railWidth: 44,
    currentSidebarWidth: 240,
    collapseButtonLeft: NaN,
    collapseButtonWidth: 30,
    rightmostPanelRight: 170,
    panelGap: 4,
  })

  assert.equal(width, 160)
})

test('right sidebar minimum width mirrors the workspace inspector chrome width', () => {
  const width = resolveMinimumRightSidebarWidth({
    viewportWidth: 1000,
    currentSidebarWidth: 360,
    rightmostPanelRight: 750,
    panelGap: 4,
  })

  assert.equal(width, 110)
})

test('right sidebar minimum width stays pinned to the shared maximum when the current surface only has one inspector button', () => {
  const width = resolveMinimumRightSidebarWidth({
    viewportWidth: 1000,
    currentSidebarWidth: 360,
    rightmostPanelRight: 716,
    panelGap: 4,
    currentPanelCount: 1,
    maxPanelCount: 2,
    panelButtonWidth: 30,
  })

  assert.equal(width, 110)
})

test('right sidebar minimum width falls back when inspector chrome measurements are incomplete', () => {
  const width = resolveMinimumRightSidebarWidth({
    viewportWidth: NaN,
    currentSidebarWidth: 360,
    rightmostPanelRight: 750,
    panelGap: 4,
  })

  assert.equal(width, 200)
})
