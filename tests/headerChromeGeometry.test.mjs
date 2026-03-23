import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveHeaderChromeLayout,
  resolveLeftSidebarChromeAnchor,
  resolveRightSidebarChromeAnchor,
} from '../src/shared/headerChromeGeometry.js'

test('left sidebar chrome anchor snaps to the mac traffic-light safe padding in windowed mode', () => {
  assert.equal(resolveLeftSidebarChromeAnchor({
    hasVisibleTrafficLights: true,
    macSafePadding: 72,
    railBoundary: 44,
  }), 72)
})

test('left sidebar chrome anchor falls back to the rail boundary in fullscreen', () => {
  assert.equal(resolveLeftSidebarChromeAnchor({
    hasVisibleTrafficLights: false,
    macSafePadding: 72,
    railBoundary: 44,
  }), 44)
})

test('right sidebar expanded anchor preserves the inspector left-edge inset', () => {
  assert.equal(resolveRightSidebarChromeAnchor({
    sidebarWidth: 360,
    buttonWidth: 30,
    buttonInset: 8,
  }), 322)
})

test('header chrome layout keeps the first left slot stable in windowed macOS', () => {
  assert.deepEqual(resolveHeaderChromeLayout({
    hasVisibleTrafficLights: true,
    macSafePadding: 72,
    railBoundary: 44,
    leftSidebarWidth: 240,
    leftSidebarOpen: false,
    rightSidebarWidth: 360,
    rightSidebarOpen: false,
    buttonWidth: 30,
    buttonInset: 8,
  }), {
    leftPanelTabsLeft: 72,
    leftCollapseLeft: 72,
    rightPanelTabsRight: 0,
    rightCollapseRight: 0,
  })
})

test('header chrome layout keeps the live left and right edges stable while both sidebars are open', () => {
  assert.deepEqual(resolveHeaderChromeLayout({
    hasVisibleTrafficLights: true,
    macSafePadding: 72,
    railBoundary: 44,
    leftSidebarWidth: 240,
    leftSidebarOpen: true,
    rightSidebarWidth: 360,
    rightSidebarOpen: true,
    buttonWidth: 30,
    buttonInset: 8,
  }), {
    leftPanelTabsLeft: 72,
    leftCollapseLeft: 246,
    rightPanelTabsRight: 0,
    rightCollapseRight: 322,
  })
})
