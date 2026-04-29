import { readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const assetsDir = resolve(rootDir, 'dist/assets')

const DEFAULT_JS_LIMIT = 500 * 1024
const PDF_WORKER_JS_LIMIT = 750 * 1024
const DEFAULT_CSS_LIMIT = 128 * 1024
const PDFIUM_WASM_LIMIT = 5 * 1024 * 1024
const ONIG_WASM_LIMIT = 512 * 1024

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(2)} KiB`
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return walk(path)
    return path
  })
}

function budgetForAsset(fileName) {
  if (/^worker-engine-[\w-]+\.js$/.test(fileName)) {
    return {
      limit: PDF_WORKER_JS_LIMIT,
      reason: 'EmbedPDF PDFium worker is an upstream worker bundle.',
    }
  }

  if (fileName.endsWith('.js')) {
    return {
      limit: DEFAULT_JS_LIMIT,
      reason: 'Default JS chunk budget.',
    }
  }

  if (/^pdfium-[\w-]+\.wasm$/.test(fileName)) {
    return {
      limit: PDFIUM_WASM_LIMIT,
      reason: 'PDFium WASM engine budget.',
    }
  }

  if (/^onig-[\w-]+\.wasm$/.test(fileName)) {
    return {
      limit: ONIG_WASM_LIMIT,
      reason: 'TextMate Oniguruma WASM budget.',
    }
  }

  if (fileName.endsWith('.css')) {
    return {
      limit: DEFAULT_CSS_LIMIT,
      reason: 'Default CSS asset budget.',
    }
  }

  return null
}

let assets = []
try {
  assets = walk(assetsDir)
} catch {
  console.error('Bundle budget check requires a completed Vite build at dist/assets.')
  process.exit(1)
}

const checked = []
const violations = []

for (const assetPath of assets) {
  const fileName = basename(assetPath)
  const budget = budgetForAsset(fileName)
  if (!budget) continue

  const size = statSync(assetPath).size
  const entry = {
    path: relative(rootDir, assetPath),
    size,
    ...budget,
  }
  checked.push(entry)
  if (size > budget.limit) violations.push(entry)
}

if (violations.length > 0) {
  console.error('Bundle budget exceeded:')
  for (const violation of violations.sort((left, right) => right.size - left.size)) {
    console.error(
      `- ${violation.path}: ${formatBytes(violation.size)} > ${formatBytes(violation.limit)} (${violation.reason})`,
    )
  }
  process.exit(1)
}

const largest = [...checked].sort((left, right) => right.size - left.size).slice(0, 5)
console.log('Bundle budget check passed.')
for (const asset of largest) {
  console.log(`- ${asset.path}: ${formatBytes(asset.size)} / ${formatBytes(asset.limit)}`)
}
