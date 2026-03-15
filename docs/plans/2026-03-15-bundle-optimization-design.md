# Bundle Optimization Design

**Date:** 2026-03-15

## Goal

对 Altals 做一轮以“首屏减重 + 功能级按需加载 + 稳定 vendor 分组”为核心的分包与包体优化，在不打坏 Markdown/LaTeX、DOCX、聊天 AI、终端、GitHub 同步、引用管理、PDF/Typst 等主流程的前提下，明显压缩主入口体积并降低 Vite 的超大 chunk 告警。

## Scope

- 覆盖 Vite 构建配置中的 chunk 分组策略
- 覆盖 `App.vue` 根入口的同步组件装配方式
- 覆盖 `Settings`、左右侧栏、底部终端等“非首屏必需”容器的懒加载边界
- 覆盖 `DOCX / PDF / Markdown / Terminal / AI / Spreadsheet` 等重量级依赖的 vendor 分组
- 不改动业务功能语义，不重写核心编辑器逻辑

## Non-Negotiable Constraints

- 所有现有主流程都不能被打坏
- 每一轮改完都要执行构建验证
- 首屏优化不能以“工作区打开后明显空白或不可用”为代价
- 不为了追求 chunk 数字好看而把共享依赖切成过碎的小包

## Current Findings

- `vite.config.js` 目前没有任何 `manualChunks` 策略
- 根入口 `App.vue` 同步装配了工作区骨架、设置弹窗、版本历史、左右侧栏和底部面板
- `EditorPane.vue` 已经对多种编辑器做了异步加载，但首屏壳层和大量共享能力仍然同步进入主包
- 当前构建中最大的两个前端包分别是主 `index` chunk 和 `superdoc` chunk，另有 `pdf.worker`、`MarkdownPreview`、`xterm`、`citeproc` 等较重功能块

## Recommended Strategy

### 1. Root-shell lazy loading

- 将 `Settings`、`VersionHistory`、`LeftSidebar`、`RightPanel`、`BottomPanel` 收为异步组件
- 保持 `Header`、主 pane 容器和最基本的工作区框架同步加载，避免启动时的布局抖动
- 保守处理首屏必须可用的交互，避免打开工作区后出现明显的“再点一次才加载”的断层体验

### 2. Feature-gated lazy loading

- `Settings` 内部各 section 改成切到对应 tab 时才加载
- `LeftSidebar` 中的 `ReferenceList` 仅在引用面板展开时加载
- `RightPanel` 中的 `Backlinks` 仅在切换到该 tab 时加载
- 保留 `EditorPane` 现有异步边界，并避免重复包进主入口

### 3. Stable vendor chunking

- 在 `vite.config.js` 中按真实功能共现关系配置 `manualChunks`
- 优先拆出：
  - `vendor-vue`
  - `vendor-ai`
  - `vendor-codemirror`
  - `vendor-superdoc`
  - `vendor-pdf`
  - `vendor-markdown`
  - `vendor-xterm`
  - `vendor-spreadsheet`
- 对特别大的编辑器或预览生态优先按功能簇分组，而不是简单一库一包

## Verification Plan

每一轮改动后都执行：

- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

重点关注：

- 主 `index` chunk 是否明显下降
- `superdoc`、`pdf`、`xterm`、`markdown` 是否稳定落入独立 chunk
- 是否出现异步组件首次打开白屏、错误边界缺失或功能失效

## Expected Outcome

- 主入口包明显缩小
- 设置面板、侧栏、终端、版本历史等非首屏能力转为按需加载
- 重量级依赖形成更稳定、可缓存的 vendor chunk
- 构建告警收敛为更少的真正大包，而不是一个巨大主入口包
