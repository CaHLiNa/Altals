import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const requiredDocs = [
  ['docs/PRODUCT.md', '# Product'],
  ['docs/ARCHITECTURE.md', '# Architecture'],
  ['docs/DOMAINS.md', '# Domains'],
  ['docs/OPERATIONS.md', '# Operations'],
  ['docs/DATA_MODEL.md', '# Data Model'],
  ['docs/BUILD_SYSTEM.md', '# Build System'],
  ['docs/DOCUMENT_WORKFLOW.md', '# Document Workflow'],
  ['docs/GIT_AND_SNAPSHOTS.md', '# Git And Snapshots'],
  ['docs/REFACTOR_BLUEPRINT.md', '# Refactor Blueprint'],
  ['docs/CONTRIBUTING.md', '# Contributing'],
  ['docs/TESTING.md', '# Testing'],
  ['docs/plan/README.md', '# Iteration Plan'],
]

const requiredAgentFiles = [
  ['AGENTS.md', '# Altals Agent Constitution'],
  ['src/AGENTS.md', '# Frontend Agents'],
  ['src/app/AGENTS.md', '# App Layer Agents'],
  ['src/components/AGENTS.md', '# Component Layer Agents'],
  ['src/composables/AGENTS.md', '# Composable Layer Agents'],
  ['src/domains/AGENTS.md', '# Domain Layer Agents'],
  ['src/services/AGENTS.md', '# Service Layer Agents'],
  ['src/stores/AGENTS.md', '# Store Layer Agents'],
  ['src-tauri/AGENTS.md', '# Tauri Backend Agents'],
  ['docs/AGENTS.md', '# Docs Agents'],
  ['tests/AGENTS.md', '# Test Agents'],
]

const requiredBlueprintSections = [
  '## Overview',
  '## Product Direction',
  '## Architectural Principles',
  '## Current State Assessment',
  '## Phase Plan',
  '## Task Backlog',
  '## In Progress',
  '## Completed',
  '## Blocked / Risks',
  '## Next Recommended Slice',
  '## Validation Checklist',
  '## Migration Notes',
]

test('required top-level docs exist with the expected root headings', () => {
  for (const [relativePath, heading] of requiredDocs) {
    const absolutePath = path.join(repoRoot, relativePath)
    assert.equal(existsSync(absolutePath), true, `${relativePath} should exist`)
    const content = readFileSync(absolutePath, 'utf8')
    assert.equal(content.startsWith(`${heading}\n`), true, `${relativePath} should start with ${heading}`)
  }
})

test('required AGENTS hierarchy exists with the expected root headings', () => {
  for (const [relativePath, heading] of requiredAgentFiles) {
    const absolutePath = path.join(repoRoot, relativePath)
    assert.equal(existsSync(absolutePath), true, `${relativePath} should exist`)
    const content = readFileSync(absolutePath, 'utf8')
    assert.equal(content.startsWith(`${heading}\n`), true, `${relativePath} should start with ${heading}`)
  }
})

test('the refactor blueprint keeps the mandatory top-level sections', () => {
  const blueprint = readFileSync(path.join(repoRoot, 'docs/REFACTOR_BLUEPRINT.md'), 'utf8')
  for (const heading of requiredBlueprintSections) {
    assert.equal(
      blueprint.includes(`${heading}\n`),
      true,
      `Blueprint should contain ${heading}`,
    )
  }
})
