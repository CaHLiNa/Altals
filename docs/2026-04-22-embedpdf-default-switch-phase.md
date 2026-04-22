# EmbedPDF 默认切换 Phase

## 目标

本 phase 只做一件事：把桌面端 PDF 预览默认 backend 从 `pdfjs` 切到 `embedpdf`，同时保留一条低摩擦、可立即生效的 `pdfjs` 回滚路径。

这不是功能建设 phase，而是一次受控切换 phase。

## 切换范围

本 phase 覆盖：

- `src/services/pdf/pdfViewerBackend.js` 默认 backend 取值
- 默认用户路径下 `PdfArtifactPreview -> PdfEmbedSurface`
- 显式回滚开关的保留与文档说明
- 一次单独的 `pdfjs` 默认路径回归确认

本 phase 不覆盖：

- 删除 `public/pdfjs-viewer/*`
- 删除 `PdfIframeSurface.vue`
- 移除 `pdfjs` 依赖
- 删除 `scribeflow:pdf-backend` override

## 切换决策

决定将 `embedpdf` 设为默认 backend，原因如下：

1. 并行路线已经补齐基础渲染、view state、保存、SyncTeX、文本选择 / 复制、搜索 UI。
2. 最近一轮已完成真实运行态人工验证，没有新增已知阻塞。
3. 当前继续维持 `pdfjs` 为默认值，只会延长双路径维护时间，而不会再带来实质性降风险。

## 回滚策略

### 立即回滚

如果默认切换后出现回归，可以立即切回 `pdfjs`：

- 运行态本地回滚：
  `localStorage['scribeflow:pdf-backend'] = 'pdfjs'`
- 构建态回滚：
  `VITE_SCRIBEFLOW_PDF_BACKEND=pdfjs`

这两条路径都不需要修改代码，也不需要回退 commit。

### 回滚适用场景

以下情况出现任一项，应优先使用回滚开关而不是临时补丁：

- 工作区中的真实 PDF 打不开或渲染异常
- `forward / reverse SyncTeX` 在真实 LaTeX 项目中失效
- 保存链路出现文档损坏或写回失败
- 搜索、选择、复制出现高频不可恢复问题
- 桌面端出现明显的输入、滚动、右键或外链交互回归

### 回滚后的处理原则

- 回滚只用于恢复用户可用性，不作为长期默认值恢复。
- 一旦触发回滚，应在后续独立切片中修复根因，再重新切换默认 backend。

## 开关保留周期

`pdfjs` 回滚开关至少保留到 **2026 年 6 月 30 日**，且需同时满足以下条件后才允许删除：

1. 默认 `embedpdf` 已稳定运行至少一个完整版本周期。
2. 没有新的高优先级 PDF 预览回归持续开放。
3. `pdfjs` override 在最近一轮验证中已不再作为必需逃生路径。

在这之前，以下能力必须保留：

- `PDF_VIEWER_BACKEND_OVERRIDE_KEY`
- `VITE_SCRIBEFLOW_PDF_BACKEND`
- `PdfIframeSurface.vue`

## 验证要求

本 phase 的最低验证组合如下：

- `npm run lint`
- `npm run build`
- `VITE_SCRIBEFLOW_PDF_BACKEND=pdfjs npm run build`

其中第三项用于单独确认 `pdfjs` 默认路径没有因为默认值切换而失去构建可用性。

## 验收结果

本 phase 完成后，应满足：

- 无 override 时默认走 `embedpdf`
- 显式设置 `pdfjs` override 时仍走旧 backend
- 两条路径都能通过前端构建验证
- 回滚方式和保留周期已写入仓库文档

## 后续建议

下一步不要立刻删除旧实现，而是进入短观察窗口：

1. 收集真实工作区中 `embedpdf` 默认路径的反馈。
2. 继续重点观察保存、搜索、SyncTeX 和右键交互。
3. 到 2026 年 6 月 30 日前后再决定是否启动 `pdfjs` 降权 / 删除 phase。
