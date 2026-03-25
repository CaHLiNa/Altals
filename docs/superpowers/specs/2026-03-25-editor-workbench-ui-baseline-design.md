# Editor Workbench UI Baseline Design

## Goal

把前端规范从 `settings/shared/shell` 继续推进到高频的 `editor / sidebar / notebook / pdf toolbar` 入口，减少裸按钮、裸输入、局部视觉皮肤和组件内直接 AI launch。

## Scope

- `src/components/editor/TabBar.vue`
- `src/components/editor/NotebookEditor.vue`
- `src/components/editor/PdfViewer.vue`
- `src/components/editor/DocumentWorkflowBar.vue`
- `src/components/sidebar/ReferenceList.vue`
- `src/components/layout/WorkbenchRail.vue`
- `src/components/layout/ToastContainer.vue`
- `src/components/layout/SyncPopover.vue`
- `src/App.vue`
- `src/shared/shellResizeSignals.js`
- `src/domains/editor/pdfViewerRuntime.js`
- `src/services/ai/workbenchTaskLaunchers.js`
- `tests/aiLaunchBoundaryAudit.test.mjs`
- `tests/pdfViewerRuntime.test.mjs`
- `tests/shellResizeSignals.test.mjs`

## Design

1. 不新增另一套视觉系统，继续复用 `UiButton / UiInput / UiSelect`。
2. `TabBar` 从散装图标按钮和 `inline style` 收成 token 化 class + shared button。
3. `ReferenceList` 的 header/search/filter/style/compare 入口统一切到 shared primitive。
4. `NotebookEditor` 的 toolbar、status chip、setup prompt 和 kernel picker 切到 shared primitive。
5. `PdfViewer` 只改顶部 toolbar / search / tools menu / annotation actions / context menu 这些高频控件，不碰 viewer 内核和渲染 runtime。
6. 把 `ReferenceList` 和 `NotebookEditor` 的直接 `launchAiTask` 提成命名 launcher seam，组件只表达意图。
7. `DocumentWorkflowBar`、`WorkbenchRail`、`ToastContainer`、`SyncPopover` 继续复用同一套 `UiButton` 语义，顺手消掉旧的裸按钮皮肤和硬编码 toast z-index。
8. 更新 AI launch boundary audit，使测试断言新的命名 launcher seam，而不是继续把 presentation 层直接调用 generic launcher 当成真相。
9. `PdfViewer` 的首屏打开新增一个轻量握手：等待 viewer app 真正可用、给 viewer 一个 resize/render nudge，并在首轮 DOM 页面没有落地时只重试一次，而不是直接把偶发空白状态暴露给用户。
10. 左右侧栏开关不再绕开现有 drag-time `shell-resize` 链路，而是复用同一套多来源 resize 信号，让 PDF 在开关和拖拽两种场景里都能进入同样的降载路径。
11. `SidebarChrome` 高度压到与 `TabBar` 相同的 32px 基线，让左右侧栏顶部的下边线与标签栏下边线对齐。

## Risks

- `PdfViewer` 文件体积大，这次只收控件层，不做大拆分。
- shared primitive 套进历史样式后，需要额外验证尺寸和 hover/focus 状态没有回归。
- lint 范围只能逐步外扩，不能一次拉满整个历史仓库。

## Validation

- 对新增 launcher seam 增加 focused test。
- 对 AI launch boundary audit 更新断言。
- 对 PDF render-readiness 和 multi-source shell-resize 行为增加 focused test。
- 对这批文件跑 targeted ESLint。
- 跑 `npm run lint`
- 跑 `npm run format:check`
- 跑 `node --test tests/*.test.mjs`
- 跑 `npm run build`
