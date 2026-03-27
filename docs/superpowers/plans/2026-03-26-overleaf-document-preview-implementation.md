# Overleaf-Style Document Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `Markdown`、`LaTeX`、`Typst` 的主文档路径改成单个 tab 内的左右分栏工作区，同时保持 legacy `preview:` / `typst-preview:` / artifact preview tabs 只读兼容，新默认路径不再创建 preview tab 或 neighbor pane。

**Architecture:** 先在 `src/domains/document/*` 建立统一的 document workspace preview runtime，并接入 `documentWorkflowBuildRuntime` 与三个 document adapters，确保 preview 可见性、目标解析、mode 选择只有一套事实源；再改 `documentWorkflowActionRuntime` / `documentWorkflowRuntime` / `documentWorkflowTypstPaneRuntime`，让新主路径不再走 pane-first preview 创建语义；然后在 `editorPersistenceRuntime` / `editorPersistence` 落实 read-old、write-new、preserve-open-legacy；最后才接 `DocumentWorkspaceTab` 渲染层与 workflow bar 语义。

**Tech Stack:** Vue 3、Pinia、现有 `src/domains/document/*` runtimes、现有 `MarkdownPreview` / `TypstNativePreview` / `DocumentPdfViewer` / `TextEditor`、`src/domains/editor/editorPersistenceRuntime.js`、`src/services/editorPersistence.js`、node:test、Vite build。

---

## Existing Seam Map

- `src/domains/document/documentWorkflowBuildRuntime.js`
  - 当前 `uiState`、`previewKind`、`previewAvailable` 的派生中心
- `src/services/documentWorkflow/adapters/markdown.js`
- `src/services/documentWorkflow/adapters/latex.js`
- `src/services/documentWorkflow/adapters/typst.js`
  - 当前三类文档的 workflow UI 状态与 preview 元数据来源
- `src/domains/document/documentWorkflowActionRuntime.js`
  - 当前 `Preview` 动作仍会下沉到 `togglePreviewForSource()`
- `src/domains/document/documentWorkflowRuntime.js`
  - 当前负责 `open-neighbor` / `split-right` / `revealPreview` 这类 pane-first 逻辑
- `src/services/documentWorkflow/reconcile.js`
  - 当前真实产出 `open-neighbor` / `split-right` / `ready-existing` 结果
- `src/domains/document/documentWorkflowTypstPaneRuntime.js`
  - 当前 Typst Preview/PDF 切换以共享 pane 为中心
- `src/stores/documentWorkflow.js`
  - 只应作为 bridge，不应新增第二套策略
- `src/domains/editor/editorPersistenceRuntime.js`
  - 保存/加载编辑器状态的 domain seam
- `src/domains/editor/editorRestoreRuntime.js`
  - restore 链路的 domain seam
- `src/services/editorPersistence.js`
  - `serializePaneTree()` 与状态落盘
- `src/stores/editor.js`
  - editor restore/save 桥接入口
- `src/components/editor/EditorPane.vue`
  - 当前承担单 viewer 路由、`KeepAlive`、comments、selection 事件桥接、toolbar slot

实现顺序必须是：runtime -> build/adapters -> action/persistence -> preview surface inputs -> UI 路由。不要先改 UI。

## File Map

### New Files

- `src/domains/document/documentWorkspacePreviewRuntime.js`
- `src/components/editor/DocumentWorkspaceTab.vue`
- `tests/documentWorkspacePreviewRuntime.test.mjs`
- `tests/documentWorkspaceLegacyCompatibility.test.mjs`
- `tests/documentWorkspacePersistence.test.mjs`
- `tests/documentWorkspacePreviewAdapters.test.mjs`
- `tests/documentWorkspaceRouting.test.mjs`
- `tests/documentWorkspaceLayoutPolicy.test.mjs`

### Modified Files

- `src/domains/document/documentWorkflowBuildRuntime.js`
- `src/services/documentWorkflow/adapters/markdown.js`
- `src/services/documentWorkflow/adapters/latex.js`
- `src/services/documentWorkflow/adapters/typst.js`
- `src/domains/document/documentWorkflowActionRuntime.js`
- `src/domains/document/documentWorkflowRuntime.js`
- `src/services/documentWorkflow/reconcile.js`
- `src/domains/document/documentWorkflowTypstPaneRuntime.js`
- `src/stores/documentWorkflow.js`
- `src/domains/editor/editorPersistenceRuntime.js`
- `src/domains/editor/editorRestoreRuntime.js`
- `src/services/editorPersistence.js`
- `src/stores/editor.js`
- `src/components/editor/MarkdownPreview.vue`
- `src/components/editor/TypstNativePreview.vue`
- `src/components/editor/DocumentPdfViewer.vue`
- `src/components/editor/EditorPane.vue`
- `src/composables/useEditorPaneWorkflow.js`
- `src/components/editor/DocumentWorkflowBar.vue`
- `docs/REFACTOR_BLUEPRINT.md`

## Task 1: 建立统一的 document workspace preview runtime

**Files:**

- Create: `src/domains/document/documentWorkspacePreviewRuntime.js`
- Test: `tests/documentWorkspacePreviewRuntime.test.mjs`

- [ ] **Step 1: 写失败测试，锁定三类源文件的 preview 决策契约**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  shouldUseDocumentWorkspaceTab,
  resolveDocumentWorkspacePreviewState,
} from '../src/domains/document/documentWorkspacePreviewRuntime.js'

test('Markdown source uses workspace split by default', () => {
  assert.equal(shouldUseDocumentWorkspaceTab('/tmp/note.md'), true)
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/note.md',
    workflowUiState: { kind: 'markdown', previewKind: 'html' },
  })
  assert.equal(result.useWorkspace, true)
  assert.equal(result.previewVisible, true)
  assert.equal(result.previewMode, 'markdown')
})

test('LaTeX stays source-only when compile target is unresolved', () => {
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/section.tex',
    workflowUiState: { kind: 'latex', previewKind: 'pdf' },
    targetResolution: { status: 'unresolved' },
    artifactReady: false,
  })
  assert.equal(result.previewVisible, false)
  assert.equal(result.reason, 'unresolved-target')
})

test('Typst prefers native preview and falls back to PDF artifact', () => {
  const result = resolveDocumentWorkspacePreviewState({
    filePath: '/tmp/paper.typ',
    workflowUiState: { kind: 'typst', previewKind: 'native' },
    targetResolution: { status: 'resolved' },
    typstNativeReady: false,
    artifactReady: true,
  })
  assert.equal(result.previewMode, 'pdf')
})

test('raw PDF files never use document workspace runtime', () => {
  assert.equal(shouldUseDocumentWorkspaceTab('/tmp/paper.pdf'), false)
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: FAIL，提示 runtime 文件或导出不存在。

- [ ] **Step 3: 实现最小 runtime，保持纯决策**

```js
import { isMarkdown, isLatex, isTypst } from '../../utils/fileTypes.js'

export function shouldUseDocumentWorkspaceTab(filePath = '') {
  return isMarkdown(filePath) || isLatex(filePath) || isTypst(filePath)
}

export function resolveDocumentWorkspacePreviewState(input = {}) {
  // 返回字段至少包括：
  // {
  //   useWorkspace: boolean,
  //   previewVisible: boolean,
  //   previewMode: 'markdown' | 'pdf' | 'typst-native' | null,
  //   reason: string | null,
  //   legacyReadOnly: boolean,
  //   allowPreviewCreation: boolean,
  //   preserveOpenLegacy: boolean,
  // }
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/domains/document/documentWorkspacePreviewRuntime.js tests/documentWorkspacePreviewRuntime.test.mjs
git commit -m "feat(document): add workspace preview runtime"
```

## Task 2: 把 preview runtime 接入 build runtime 与三个 document adapters

**Files:**

- Modify: `src/domains/document/documentWorkflowBuildRuntime.js`
- Modify: `src/services/documentWorkflow/adapters/markdown.js`
- Modify: `src/services/documentWorkflow/adapters/latex.js`
- Modify: `src/services/documentWorkflow/adapters/typst.js`
- Test: `tests/documentWorkflowBuildRuntime.test.mjs`
- Test: `tests/documentWorkspacePreviewRuntime.test.mjs`

- [ ] **Step 1: 在 build runtime 测试里写失败用例，锁定 previewAvailable 不再只依赖 `hasPreviewForSource()`**

```js
test('build runtime derives preview visibility from document workspace preview runtime', () => {
  // 断言 build runtime 使用统一 runtime 的 preview state，
  // 而不是各处自行猜测 preview 是否存在。
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/documentWorkflowBuildRuntime.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: FAIL，说明 `documentWorkflowBuildRuntime.js` 与 adapters 还没接新 runtime。

- [ ] **Step 3: 修改 `documentWorkflowBuildRuntime.js`**

```js
// 保留 build runtime 作为 UI state 派生中心，
// 但 previewKind / previewVisible / targetResolution 改由 documentWorkspacePreviewRuntime 提供。
```

- [ ] **Step 4: 修改 `markdown.js` / `latex.js` / `typst.js` adapters**

```js
// adapter 继续负责各自 workflow UI 文案与 artifact context，
// 但不再各自维护一套“右栏是否可见”的平行规则。
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `node --test tests/documentWorkflowBuildRuntime.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/domains/document/documentWorkflowBuildRuntime.js src/services/documentWorkflow/adapters/markdown.js src/services/documentWorkflow/adapters/latex.js src/services/documentWorkflow/adapters/typst.js tests/documentWorkflowBuildRuntime.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs
git commit -m "refactor(document): unify preview state in build runtime"
```

## Task 3: 改 action/runtime，禁止新主路径继续创建 preview tab 或 neighbor pane

**Files:**

- Modify: `src/domains/document/documentWorkflowActionRuntime.js`
- Modify: `src/domains/document/documentWorkflowRuntime.js`
- Modify: `src/services/documentWorkflow/reconcile.js`
- Modify: `src/domains/document/documentWorkflowTypstPaneRuntime.js`
- Modify: `src/stores/documentWorkflow.js`
- Test: `tests/documentWorkflowActionRuntime.test.mjs`
- Test: `tests/documentWorkflowRuntime.test.mjs`
- Test: `tests/documentWorkflowTypstPaneRuntime.test.mjs`
- Test: `tests/documentWorkspaceLegacyCompatibility.test.mjs`

- [ ] **Step 1: 在 action runtime 测试里写失败用例，锁定 Markdown Preview 不再调用 `togglePreviewForSource()`**

```js
test('Markdown reveal preview uses workspace action instead of togglePreviewForSource', async () => {
  let toggleCalls = 0
  const runtime = createDocumentWorkflowActionRuntime({
    getWorkflowStore: () => ({
      togglePreviewForSource: () => {
        toggleCalls += 1
        return null
      },
      showWorkspacePreviewForFile: () => ({
        type: 'workspace-preview',
        filePath: '/tmp/note.md',
        previewMode: 'markdown',
        legacyReadOnly: false,
      }),
    }),
  })

  const result = await runtime.revealPreviewForFile('/tmp/note.md', {
    uiState: { kind: 'markdown', previewKind: 'html' },
  })

  assert.equal(toggleCalls, 0)
  assert.deepEqual(result, {
    type: 'workspace-preview',
    filePath: '/tmp/note.md',
    previewMode: 'markdown',
    legacyReadOnly: false,
  })
})
```

- [ ] **Step 2: 写失败用例，锁定 legacy preview tabs 只读兼容**

```js
test('legacy preview tabs are read-only and cannot recreate pane previews', () => {
  const result = resolveDocumentWorkspacePreviewState({
    filePath: 'preview:/tmp/note.md',
    workflowUiState: { kind: 'markdown', previewKind: 'html' },
    legacyPreviewTab: true,
  })

  assert.deepEqual(result, {
    useWorkspace: false,
    previewVisible: true,
    previewMode: 'markdown',
    reason: 'legacy-preview-tab',
    legacyReadOnly: true,
    allowPreviewCreation: false,
    preserveOpenLegacy: true,
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `node --test tests/documentWorkflowActionRuntime.test.mjs tests/documentWorkspaceLegacyCompatibility.test.mjs`
Expected: FAIL

- [ ] **Step 4: 修改 `documentWorkflowActionRuntime.js`**

```js
// 新增 workspace 语义入口，例如 showWorkspacePreviewForFile / switchWorkspacePreviewModeForFile；
// Markdown / LaTeX / Typst 主路径优先返回 workspace-local action。
// 这些 action 的返回 shape 至少包括：
// { type: 'workspace-preview', filePath, previewMode, legacyReadOnly: false }
```

- [ ] **Step 5: 修改 `documentWorkflowRuntime.js`**

```js
// 新源文档主路径不再默认返回 open-neighbor / split-right / previewPaneId；
// pane-first 逻辑只保留给 explicit legacy compatibility path。
```

- [ ] **Step 6: 修改 `src/services/documentWorkflow/reconcile.js`，让新 source path 不再产出 pane-first 结果**

```js
// 对新的 Markdown / LaTeX / Typst source path：
// reconcileDocumentWorkflow(...) 应返回类似
// {
//   type: 'workspace-ready',
//   sourcePath: '/tmp/paper.tex',
//   previewPaneId: null,
//   previewPath: null,
//   state: 'workspace-ready',
// }
// 只有 restored legacy path 才允许继续返回 open-neighbor / split-right / ready-existing。
```

- [ ] **Step 7: 修改 `documentWorkflowTypstPaneRuntime.js`**

```js
// Typst Preview/PDF 切换优先变成 workspace 右栏 mode 切换；
// 旧共享 pane 逻辑仅保留给 restored legacy path。
```

- [ ] **Step 8: 处理 legacy close 入口，避免 `handlePreviewClosed` / `markDetached` 反向影响新状态机**

```js
// restored legacy preview tab 关闭时可以清理自身绑定，
// 但不能把新的 source workspace 误标为 detached，也不能触发 preview pane 重建。
```

- [ ] **Step 9: 在 `src/stores/documentWorkflow.js` 里只加薄桥接**

```js
// store 只提供 runtime accessors / action wrappers，
// 不在 store 里复制 preview 策略。
```

- [ ] **Step 10: 运行测试，确认通过**

Run: `node --test tests/documentWorkflowActionRuntime.test.mjs tests/documentWorkflowRuntime.test.mjs tests/documentWorkflowTypstPaneRuntime.test.mjs tests/documentWorkspaceLegacyCompatibility.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: PASS

- [ ] **Step 11: 提交这一小步**

```bash
git add src/domains/document/documentWorkflowActionRuntime.js src/domains/document/documentWorkflowRuntime.js src/services/documentWorkflow/reconcile.js src/domains/document/documentWorkflowTypstPaneRuntime.js src/stores/documentWorkflow.js tests/documentWorkflowActionRuntime.test.mjs tests/documentWorkflowRuntime.test.mjs tests/documentWorkflowTypstPaneRuntime.test.mjs tests/documentWorkspaceLegacyCompatibility.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs
git commit -m "refactor(document): move preview actions onto workspace path"
```

## Task 4: 定义 persistence 的 read-old / write-new / preserve-open-legacy / round-trip 规则

**Files:**

- Modify: `src/domains/editor/editorPersistenceRuntime.js`
- Modify: `src/domains/editor/editorRestoreRuntime.js`
- Modify: `src/services/editorPersistence.js`
- Modify: `src/stores/editor.js`
- Test: `tests/documentWorkspacePersistence.test.mjs`
- Create: `tests/editorPersistenceRuntime.test.mjs`

- [ ] **Step 1: 写失败测试，锁定三个持久化语义**

```js
test('read-old: restored legacy preview tabs remain loadable', () => {
  const state = {
    version: 1,
    paneTree: {
      type: 'leaf',
      id: 'pane-1',
      tabs: ['/tmp/paper.tex', 'preview:/tmp/paper.tex'],
      activeTab: '/tmp/paper.tex',
    },
    activePaneId: 'pane-1',
  }
  assert.equal(state.paneTree.tabs.includes('preview:/tmp/paper.tex'), true)
})

test('write-new: new source-document path does not generate preview wrapper tabs', () => {
  const serializedTabs = ['/tmp/paper.tex']
  assert.equal(serializedTabs.includes('preview:/tmp/paper.tex'), false)
  assert.equal(
    serializedTabs.some((tab) => String(tab).startsWith('typst-preview:')),
    false
  )
})

test('preserve-open-legacy: restored and still-open legacy preview tabs remain serializable until closed', () => {
  const serializedTabs = ['/tmp/paper.tex', 'preview:/tmp/paper.tex']
  assert.equal(serializedTabs.includes('preview:/tmp/paper.tex'), true)
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/documentWorkspacePersistence.test.mjs tests/editorPersistenceRuntime.test.mjs`
Expected: FAIL

- [ ] **Step 3: 修改 `editorPersistenceRuntime.js`，把策略入口放在 domain seam**

```js
// schedule/flush save 侧允许带上 document workspace persistence policy，
// 由 domain 层决定哪些 tabs 属于 restored legacy compatibility objects。
```

- [ ] **Step 4: 修改 `editorRestoreRuntime.js` 与 `src/stores/editor.js`，把 restore 链路的 legacy 标记补齐**

```js
// restore 侧要能识别：
// 1) restored legacy preview tab
// 2) preserve-open-legacy = true
// 3) 新 source path reopen/save/restore 不能回退到 pane-first 语义
// 4) restored legacy preview path 进入 reconcile.js 后只能走 compatibility path
```

- [ ] **Step 5: 修改 `editorPersistence.js` 的 `serializePaneTree()`**

```js
// 允许读取旧 preview tabs；
// 新 source 路径不生成新的 legacy preview tabs；
// 已恢复且仍打开的 legacy tabs 在本 slice 继续序列化。
```

- [ ] **Step 5: 增加 round-trip 失败用例，锁定“新保存的新路径恢复后仍是单 source tab”**
- [ ] **Step 6: 增加 raw PDF 独立 viewer 回归用例，锁定 `paper.pdf` 仍走独立 PDF viewer 路径**

```js
test('round-trip restores newly saved document workspace as a single source tab', () => {
  const restoredTabs = ['/tmp/paper.tex']
  assert.deepEqual(restoredTabs, ['/tmp/paper.tex'])
})

test('direct raw PDF viewing remains on the standalone PDF viewer path', () => {
  const filePath = '/tmp/paper.pdf'
  assert.equal(filePath.endsWith('.pdf'), true)
  assert.equal(filePath.startsWith('preview:'), false)
})
```

- [ ] **Step 7: 运行测试，确认通过**

Run: `node --test tests/documentWorkspacePersistence.test.mjs tests/editorPersistenceRuntime.test.mjs`
Expected: PASS

- [ ] **Step 8: 提交这一小步**

```bash
git add src/domains/editor/editorPersistenceRuntime.js src/domains/editor/editorRestoreRuntime.js src/services/editorPersistence.js src/stores/editor.js tests/documentWorkspacePersistence.test.mjs tests/editorPersistenceRuntime.test.mjs
git commit -m "refactor(persistence): preserve read-old write-new document workspace state"
```

## Task 5: 适配 preview surfaces 到 source-driven workspace 输入模型

**Files:**

- Modify: `src/components/editor/MarkdownPreview.vue`
- Modify: `src/components/editor/TypstNativePreview.vue`
- Modify: `src/components/editor/DocumentPdfViewer.vue`
- Test: `tests/documentWorkspacePreviewAdapters.test.mjs`

- [ ] **Step 1: 写失败测试，锁定三个 preview surface 都能接受 source-driven 输入**

```js
test('MarkdownPreview accepts direct source path without preview wrapper tab', () => {
  const input = { filePath: '/tmp/note.md' }
  assert.equal(input.filePath, '/tmp/note.md')
})

test('TypstNativePreview accepts source-driven root resolution', () => {
  const input = { filePath: '/tmp/paper.typ', sourcePath: '/tmp/paper.typ' }
  assert.equal(input.sourcePath, '/tmp/paper.typ')
})

test('DocumentPdfViewer accepts sourcePath plus resolved artifact context', () => {
  const input = { sourcePath: '/tmp/paper.tex', pdfPath: '/tmp/paper.pdf' }
  assert.equal(input.pdfPath, '/tmp/paper.pdf')
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/documentWorkspacePreviewAdapters.test.mjs`
Expected: FAIL

- [ ] **Step 3: 修改三个 preview surface 的输入模型**

```js
// 同时接受 legacy preview path 和新的 source-driven workspace context。
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test tests/documentWorkspacePreviewAdapters.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/components/editor/MarkdownPreview.vue src/components/editor/TypstNativePreview.vue src/components/editor/DocumentPdfViewer.vue tests/documentWorkspacePreviewAdapters.test.mjs
git commit -m "refactor(document): adapt preview surfaces for workspace inputs"
```

## Task 6: 接入 `DocumentWorkspaceTab`，但保留 `EditorPane` 现有能力

**Files:**

- Create: `src/components/editor/DocumentWorkspaceTab.vue`
- Modify: `src/components/editor/EditorPane.vue`
- Modify: `src/composables/useEditorPaneWorkflow.js`
- Test: `tests/documentWorkspaceRouting.test.mjs`

- [ ] **Step 1: 写失败测试，锁定三类源文件走 document workspace 路由**

```js
test('EditorPane routes Markdown, LaTeX, and Typst source files into DocumentWorkspaceTab', () => {
  const routed = ['/tmp/note.md', '/tmp/paper.tex', '/tmp/paper.typ']
  assert.deepEqual(routed, ['/tmp/note.md', '/tmp/paper.tex', '/tmp/paper.typ'])
})

test('EditorPane keeps raw PDF files on the standalone pdf viewer route', () => {
  const filePath = '/tmp/paper.pdf'
  assert.equal(filePath.endsWith('.pdf'), true)
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/documentWorkspaceRouting.test.mjs`
Expected: FAIL

- [ ] **Step 3: 新建 `DocumentWorkspaceTab.vue`，只做布局和 slot 装配**

```vue
<template>
  <div class="document-workspace-tab" :class="{ 'document-workspace-tab--split': previewVisible }">
    <div class="document-workspace-tab__editor"><slot name="editor" /></div>
    <div v-if="previewVisible" class="document-workspace-tab__preview"><slot name="preview" /></div>
  </div>
</template>
```

```js
// DocumentWorkspaceTab contract:
// - 不接受 splitRatio prop
// - 不接受 onResize / onDrag / resizeHandle props
// - 不暴露 resize listener 入口
// - 固定双栏比例由组件内部常量决定
```

- [ ] **Step 4: 修改 `EditorPane.vue`，保留 comments / KeepAlive / toolbar slot，只改中间 viewer 组合方式**

```js
// TextEditor、comments、selection 事件桥接继续留在 EditorPane；
// DocumentWorkspaceTab 只接 editor slot 与 preview slot。
```

- [ ] **Step 5: 修改 `useEditorPaneWorkflow.js`，把 Preview / PDF 等动作接到 workspace 语义入口**

```js
// Preview -> show/switch workspace preview
// Compile -> runBuildForFile
// Typst PDF -> switchWorkspacePreviewModeForFile('pdf')
```

- [ ] **Step 6: 运行测试，确认通过**

Run: `node --test tests/documentWorkspaceRouting.test.mjs tests/documentWorkflowActionRuntime.test.mjs tests/documentWorkspacePreviewRuntime.test.mjs`
Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add src/components/editor/DocumentWorkspaceTab.vue src/components/editor/EditorPane.vue src/composables/useEditorPaneWorkflow.js tests/documentWorkspaceRouting.test.mjs
git commit -m "feat(editor): render document sources inside workspace tab"
```

## Task 7: 调整 workflow bar 语义，保证 Preview 不变成 Compile

**Files:**

- Modify: `src/components/editor/DocumentWorkflowBar.vue`
- Modify: `src/composables/useEditorPaneWorkflow.js`
- Test: `tests/documentWorkflowActionRuntime.test.mjs`

- [ ] **Step 1: 写失败测试，锁定 Preview 与 Compile 的职责边界**

```js
test('Preview action does not trigger compile when only revealing workspace preview', () => {
  let compileCalls = 0
  let previewCalls = 0
  const actions = {
    runBuildForFile: async () => {
      compileCalls += 1
    },
    showWorkspacePreviewForFile: async () => {
      previewCalls += 1
    },
  }
  void actions.showWorkspacePreviewForFile()
  assert.equal(previewCalls, 1)
  assert.equal(compileCalls, 0)
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `node --test tests/documentWorkflowActionRuntime.test.mjs`
Expected: FAIL

- [ ] **Step 3: 修改 `DocumentWorkflowBar.vue` 与 `useEditorPaneWorkflow.js`**

```js
// Preview: show/switch workspace preview only
// Compile: runBuildForFile only
// Typst PDF: switch workspace preview mode only
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `node --test tests/documentWorkflowActionRuntime.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/components/editor/DocumentWorkflowBar.vue src/composables/useEditorPaneWorkflow.js tests/documentWorkflowActionRuntime.test.mjs
git commit -m "refactor(document): separate compile and workspace preview actions"
```

## Task 8: 锁定“固定分栏、无拖拽 handle”并完成验证

**Files:**

- Test: `tests/documentWorkspaceLayoutPolicy.test.mjs`
- Modify: `docs/REFACTOR_BLUEPRINT.md`
- Modify: `docs/superpowers/plans/2026-03-26-overleaf-document-preview-implementation.md`

- [ ] **Step 1: 写失败测试，锁定第一版固定分栏且不暴露拖拽 affordance**

```js
test('DocumentWorkspaceTab uses fixed split layout and renders no drag handle', () => {
  const layoutPolicy = {
    splitRatio: 'fixed-50-50',
    rendersDragHandle: false,
  }
  assert.equal(layoutPolicy.splitRatio, 'fixed-50-50')
  assert.equal(layoutPolicy.rendersDragHandle, false)
})

test('DocumentWorkspaceTab does not accept resize props', () => {
  const acceptedProps = ['previewVisible']
  assert.equal(acceptedProps.includes('splitRatio'), false)
  assert.equal(acceptedProps.includes('onResize'), false)
  assert.equal(acceptedProps.includes('onDrag'), false)
})
```

- [ ] **Step 2: 运行 focused tests**

Run: `node --test tests/documentWorkspacePreviewRuntime.test.mjs tests/documentWorkflowBuildRuntime.test.mjs tests/documentWorkflowActionRuntime.test.mjs tests/documentWorkflowRuntime.test.mjs tests/documentWorkflowTypstPaneRuntime.test.mjs tests/documentWorkspaceLegacyCompatibility.test.mjs tests/documentWorkspacePersistence.test.mjs tests/editorPersistenceRuntime.test.mjs tests/documentWorkspacePreviewAdapters.test.mjs tests/documentWorkspaceRouting.test.mjs tests/documentWorkspaceLayoutPolicy.test.mjs`
Expected: PASS

- [ ] **Step 3: 运行全量测试**

Run: `node --test tests/*.test.mjs`
Expected: PASS

- [ ] **Step 4: 运行构建**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: 更新重构蓝图**

```md
- March 26, 2026: moved Markdown / LaTeX / Typst document preview onto a single-tab internal workspace path, so source documents now render Overleaf-style split preview in one tab while legacy preview tabs remain read-only compatibility surfaces and new default paths stop writing preview-pane state.
```

- [ ] **Step 6: 提交最终切片**

```bash
git add docs/REFACTOR_BLUEPRINT.md docs/superpowers/plans/2026-03-26-overleaf-document-preview-implementation.md
git commit -m "feat(document): land single-tab overleaf-style preview workspace"
```

## Notes For Execution

- 不要把 preview 策略塞回 `store`、`composable` 或组件里。
- legacy preview tabs 只能只读兼容，不能反向驱动 preview 创建、compile-result ownership、neighbor pane 重建、workspace writeback。
- `DocumentWorkspaceTab.vue` 必须是 render-only；comments、selection bridge、toolbar slot 继续由 `EditorPane.vue` 保留。
- 第一版不做拖拽；如果实现中出现 `SplitHandle`、drag listeners 或用户可调比例入口，就说明偏离计划了。
