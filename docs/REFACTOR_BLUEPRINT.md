# Refactor Blueprint

## Overview

Altals 仍处于从“广泛研究工作台”向“本地优先、以项目目录为中心的学术写作工作区”收缩的早期阶段。

当前仓库已经具备项目打开、文件浏览、文档编辑、参考文献、构建预览、变更查看与 AI 入口，但这些能力仍主要挂在平铺式的 `components/services/stores` 结构上，根组件和多个 Pinia store 依然承担过多编排职责。

本蓝图现已从占位模板更新为基于仓库现状的执行计划，后续每个切片都必须同步维护。

## Product Direction

目标产品定义不变：

> A local-first, project-directory-centered academic writing workspace.

主工作流应收敛为：

1. 打开本地项目
2. 浏览项目文件
3. 编辑文档
4. 管理参考文献
5. 构建并预览输出
6. 查看与恢复变更
7. 在可审计、补丁优先的约束下使用 AI

当前偏离点：

- 工作区、Git、AI、设置、终端等次级系统在入口层暴露过多实现细节
- 根组件仍直接编排工作区生命周期、快捷键、外链处理、版本历史触发等跨域逻辑
- 文档体系尚未建立，产品边界只能从代码推断

## Architectural Principles

- 新边界优先落在 `src/app` 或未来的 `src/domains/*` 下，而不是继续扩充 `src/App.vue` 或平铺式 `src/services`
- 根组件只负责组合 UI，不负责工作区启动、恢复、关闭、后台任务编排
- store 继续保留现状时，也要优先把跨 store 的 orchestration 抽到明确模块中
- Rust 端逐步从平铺式 `src-tauri/src/*.rs` 迁向 `commands/core/services/models/errors`
- 自动保存、本地快照、Git 提交、远程同步必须继续拆分，不再混为一个“历史”概念
- AI 工作流优先走 proposal/patch/review，而不是隐藏式直接修改

## Current State Assessment

### Frontend structure

- 前端目前以 `src/App.vue` 为根入口，`src/main.js` 仅做 Vue/Pinia 挂载与遥测初始化
- 已建立首个 `src/app` 入口层模块：`src/app/workspace/useWorkspaceLifecycle.js`
- 已建立第二个 `src/app` 入口层模块：`src/app/shell/useAppShellEventBridge.js`
- 已建立第三个 `src/app` 入口层模块：`src/app/changes/useWorkspaceHistoryActions.js`
- 已建立第四个 `src/app` 入口层模块：`src/app/teardown/useAppTeardown.js`
- 已建立首个 `src/domains/*` 模块：`src/domains/changes/workspaceHistory.js`
- 目录仍以 `src/components`、`src/services`、`src/stores`、`src/composables` 为主，`src/app` 目前承接了工作区生命周期、app-shell 事件编排、changes/history 入口动作、footer 状态同步与 app teardown，`src/domains/*` 只完成了 `changes` 的起步边界
- `src/services` 已经出现按主题分组的早期迹象（如 `ai/`、`documentWorkflow/`、`terminal/`、`latex/`、`typst/`），但顶层仍非常平铺

### Largest frontend bottlenecks

- `src/App.vue` 已从 938 行降到 280 行，当前主要保留模板组合与各入口层模块拼接
- `src/app/workspace/useWorkspaceLifecycle.js` 340 行：已承接工作区启动恢复、打开/关闭、后台任务调度、可见性/焦点刷新，后续需要继续沉淀为更细操作边界
- `src/app/shell/useAppShellEventBridge.js` 289 行：已承接全局快捷键、应用事件桥接、外链激活与版本历史事件入口，后续可继续切成 shortcut / external-link / window-event 更细模块
- `src/app/changes/useWorkspaceHistoryActions.js` 71 行：现在主要负责 UI 适配和入口层 wiring
- `src/app/teardown/useAppTeardown.js` 27 行：已承接根级 cleanup 顺序与 sidecar shutdown 桥接
- `src/app/editor/useFooterStatusSync.js` 15 行：已承接 footer 状态同步回调
- `src/domains/changes/workspaceHistory.js` 106 行：已承接 changes/history 的核心逻辑，是当前唯一一个 domain-first 边界
- 已建立 `src/domains/reference/referenceMetadata.js`，承接参考文献 workflow metadata 规范化与字段更新
- 已建立 `src/domains/reference/referenceWorkbench.js`，承接 collections / saved views 的规范化与 mutation
- 已建立 `src/domains/reference/referenceSearchExport.js`，承接 reference sort / filter / search / BibTeX / RIS 导出
- 已建立 `src/domains/reference/referenceImportMerge.js`，承接 import 预处理、duplicate audit 与 merge payload 生成
- 已建立 `src/domains/reference/referenceStorageIO.js`，承接 reference storage IO、citation style 读取与 legacy storage 准备
- `src/stores/references.js` 已从 1658 行降到 1089 行，当前主要剩 watcher、self-write bookkeeping、state sync 与少量 persistence bridge
- `src/stores/editor.js` 1244 行：编辑器 pane/tab/workbench 行为过度集中
- `src/stores/files.js` 996 行、`src/stores/workspace.js` 809 行、`src/stores/chat.js` 854 行、`src/stores/terminal.js` 889 行：多个横切 store 仍过大
- `src/components/editor/PdfViewer.vue` 4394 行：PDF 相关能力高度耦合，后续需要单独拆域

### Backend structure

- Rust 端仍是平铺式 `src-tauri/src/*.rs`
- 体量最大的后端文件包括：
  - `src-tauri/src/latex.rs` 2266 行
  - `src-tauri/src/fs_commands.rs` 1145 行
  - `src-tauri/src/kernel.rs` 1027 行
  - `src-tauri/src/pdf_translate.rs` 1005 行
  - `src-tauri/src/git.rs` 997 行
- 说明命令处理、核心逻辑与服务分层尚未建立

### Docs state

- 当前 `docs/` 下只有 `docs/REFACTOR_BLUEPRINT.md`
- `docs/PRODUCT.md`、`docs/ARCHITECTURE.md`、`docs/DOMAINS.md`、`docs/OPERATIONS.md` 等必需文档尚未建立

### Safety model observations

- `src/services/workspaceAutoCommit.js` 与版本历史入口仍表明 Git 历史和应用内变更安全模型存在耦合
- `App.vue` 中的版本历史触发会在需要时启用 auto-commit，说明“快照 / Git 提交 / 历史查看”边界还不清晰

## Phase Plan

### Phase 0 - Inventory and Truthful Documentation

- 记录仓库真实结构、瓶颈文件、缺失文档
- 用蓝图取代占位描述
- 标明哪些是当前主入口，哪些是后续删除目标

Status: 已启动，当前轮次完成首轮现实审计

### Phase 1 - App and Domain Skeleton

- 建立 `src/app` 入口层边界
- 从 `App.vue` 抽离工作区生命周期与全局编排职责
- 为后续 `src/domains/project|document|reference|build|changes|ai|git|terminal` 迁移铺路

Status: 进行中

### Phase 2 - Store Boundary Reduction

- 缩小 `editor`、`references`、`workspace`、`files` 等大 store 的责任面
- 将跨 store orchestration 迁到显式模块或操作层

### Phase 3 - Project / Document / Build / Change Loop

- 稳定打开项目、编辑文档、保存、构建、查看变更的主闭环
- 统一诊断与结果可见性

### Phase 4 - Safety Model Separation

- 明确 autosave、local snapshot、git commit、remote sync 四层边界
- 降低 auto-commit 与历史查看耦合

### Phase 5 - AI Workflow Discipline

- 将 AI 行为压缩到 proposal/patch/review 的显式路径
- 限制 whole-repo 级上下文和直接副作用

### Phase 6 - Cleanup and Stabilization

- 删除旧路径
- 建立缺失文档
- 增加验证与测试

## Task Backlog

- [ ] 继续扩展 `src/app` 入口层，使 `App.vue` 进一步收缩到模板组合和最少量 UI 状态
- [ ] 抽离 `App.vue` 的根级 cleanup 编排
- [ ] 将 `src/app/shell/useAppShellEventBridge.js` 继续拆成更窄的 app-shell 子模块
- [ ] 将 `src/app/changes/useWorkspaceHistoryActions.js` 向显式 changes/history operation 收敛
- [ ] 为 `src/stores/references.js` 制定拆分方案并先切 metadata / import / library UI orchestration
- [ ] 为 `src/stores/editor.js` 切分 pane-tree 管理与 surface 切换逻辑
- [ ] 将 `workspaceAutoCommit` 与版本历史触发关系整理到显式安全模型文档
- [ ] 建立 `docs/PRODUCT.md`
- [ ] 建立 `docs/ARCHITECTURE.md`
- [ ] 建立 `docs/DOMAINS.md`
- [ ] 建立 `docs/OPERATIONS.md`
- [ ] 规划 `src-tauri/src/latex.rs` 的命令与核心逻辑分层

## In Progress

- `src/app` 入口层与 `src/domains/changes` 起步边界已经建立
- 第一个大型 store/domain 拆分 phase 已在 `references` 上完成一轮稳定收敛
- `references` 域逻辑已被拆到 metadata / workbench / search-export / import-merge / storage-io 五个模块
- `references` store 当前主要剩 store-specific 生命周期、watcher 与 self-write bookkeeping；这些被记录为后续 infra 清理，而不是继续阻塞下一个产品域拆分

## Completed

- 将 `docs/REFACTOR_BLUEPRINT.md` 从占位模板更新为基于当前仓库状态的执行蓝图
- 确认前端当前主要瓶颈位于 `App.vue` 与多个大型 Pinia store
- 确认 Rust 端仍为平铺式模块，尚未进入目标分层
- 建立 `src/app/workspace/useWorkspaceLifecycle.js`，承接工作区启动恢复、打开/关闭、后台任务调度、可见性/焦点刷新
- 将 `src/App.vue` 从 938 行缩减到 640 行，移除大块工作区生命周期编排代码
- 使用 `npm run build` 完成一次新鲜构建验证
- 建立 `src/app/shell/useAppShellEventBridge.js`，承接全局快捷键、`window` 级应用事件、外链激活与版本历史事件入口
- 将 `src/App.vue` 从 640 行进一步缩减到 381 行，移除大块 document/window 事件注册与 handler 编排
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/app/changes/useWorkspaceHistoryActions.js`，承接保存并提交、版本历史打开与 auto-commit 启动桥接
- 将 `src/App.vue` 从 381 行进一步缩减到 288 行，移除 changes/history 入口动作实现
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/app/teardown/useAppTeardown.js`，承接根级 cleanup 顺序与 sidecar shutdown 桥接
- 将 `src/App.vue` 从 288 行进一步缩减到 285 行，移除根级 teardown 编排
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/domains/changes/workspaceHistory.js`，承接 changes/history 核心逻辑
- 将 `src/app/changes/useWorkspaceHistoryActions.js` 收窄为 UI 适配层
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/app/editor/useFooterStatusSync.js`，承接 footer 状态同步回调
- 将 `src/App.vue` 从 285 行进一步缩减到 280 行，移除残留 footer 状态同步逻辑
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/domains/reference/referenceMetadata.js`，承接参考文献 workflow metadata 的规范化与字段更新逻辑
- 将 `src/stores/references.js` 中的 reading state / priority / rating / summary / reading note / tags 更新逻辑改为调用 domain 模块
- 将 `src/stores/references.js` 从 1658 行缩减到 1552 行，移除一批 metadata 规范化与 mutation 细节
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/domains/reference/referenceWorkbench.js`，承接 workbench collections / saved views 的规范化与 mutation
- 将 `src/stores/references.js` 中的 collection / saved view 创建、删除与引用关系更新逻辑改为调用 domain 模块
- 将 `src/stores/references.js` 从 1552 行进一步缩减到 1445 行
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/domains/reference/referenceSearchExport.js`，承接 reference sort / filter / search / BibTeX / RIS 导出逻辑
- 将 `src/stores/references.js` 中的查询、排序与导出逻辑改为调用 domain 模块
- 将 `src/stores/references.js` 从 1445 行进一步缩减到 1306 行
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/domains/reference/referenceImportMerge.js`，承接导入前预处理、duplicate audit 与 merge payload 生成
- 将 `src/stores/references.js` 中的 import / dedup / merge 逻辑改为调用 domain 模块
- 将 `src/stores/references.js` 从 1306 行进一步缩减到 1222 行
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- 建立 `src/domains/reference/referenceStorageIO.js`，承接 reference storage IO、citation style 读取与 legacy storage 准备
- 将 `src/stores/references.js` 中的文件读取、样式读取与 legacy storage 准备逻辑改为调用 domain 模块
- 将 `src/stores/references.js` 从 1222 行进一步缩减到 1089 行
- 再次运行 `npm run build`，构建通过，未引入新的构建错误
- `references` 作为第一个大型 store/domain 拆分对象，已形成五个清晰子模块与一个明显收缩后的 store 桥接层

## Blocked / Risks

- 工作区打开/关闭流程同时触达多个 store 与服务，轻率重排可能造成回归
- `workspaceAutoCommit` 与版本历史流程仍有耦合，后续拆分必须先补清晰文档
- `PdfViewer.vue` 与 `references/editor` 大 store 体量很大，但不适合在缺乏骨架的情况下直接大拆
- 目前缺少系统化测试，验证主要依赖构建与手动行为回归
- `references` store 仍保留 watcher、自写入计数、load generation 与 state sync，这些属于基础设施桥接，不再是优先产品域逻辑
- 若继续收缩 `references`，下一刀必须把 watcher、自写入计数与 load generation 一起作为“reference store runtime bridge”处理，不能零碎抽离

## Next Recommended Slice

1. 开始第二个大型 store/domain 拆分，从 `src/stores/editor.js` 入手
2. 第一刀优先抽离 pane/workbench layout 与 surface 切换逻辑，避免直接碰编辑器 I/O 与预览编排
3. 保持 `editor` store 只做 state 持有与少量 bridge，不继续堆叠 pane 结构计算细节
4. 构建验证后，再决定下一刀是 tab/session 还是 editor workspace orchestration

## Validation Checklist

- [x] 蓝图已反映当前仓库真实结构
- [x] 新边界已建立且不是把逻辑简单复制到另一个巨型文件
- [x] `App.vue` 体量和职责得到实际缩减
- [x] 工作区打开/关闭主流程仍可构建
- [x] 遗留在 `App.vue` 的职责已被明确记录
- [x] 下一切片已更新

## Migration Notes

- 本轮优先建立 `src/app` 入口层，而不是直接重写 store
- `App.vue` 已将工作区生命周期委托给 `src/app/workspace/useWorkspaceLifecycle.js`
- `App.vue` 已将 document/window 级事件注册与快捷键编排委托给 `src/app/shell/useAppShellEventBridge.js`
- `App.vue` 已将保存并提交与版本历史入口动作委托给 `src/app/changes/useWorkspaceHistoryActions.js`
- `App.vue` 已将根级 teardown 委托给 `src/app/teardown/useAppTeardown.js`
- `App.vue` 已将 footer 状态同步委托给 `src/app/editor/useFooterStatusSync.js`
- 当前已建立首个 `src/domains/changes` 边界，后续应避免回到纯 app-layer 横向拆分
- 第一个大型 store/domain 拆分已明确从 `references` 开始，第一刀先切 workflow metadata，避免跨到 import/search/watcher
- `references` 的 workflow metadata 已迁入 `src/domains/reference/referenceMetadata.js`，store 当前仍保留 workbench 与 persistence 逻辑
- `references` 的 workbench collections / saved views 已迁入 `src/domains/reference/referenceWorkbench.js`，store 当前仍保留 search/export、import 与 persistence/watcher
- `references` 的 search / export 已迁入 `src/domains/reference/referenceSearchExport.js`，store 当前主要剩 import/dedup 与 persistence/watcher
- `references` 的 import / dedup / merge 已迁入 `src/domains/reference/referenceImportMerge.js`，store 当前主要剩 persistence / watcher / self-write bookkeeping
- `references` 的 storage IO 已迁入 `src/domains/reference/referenceStorageIO.js`，store 当前主要剩 watcher、self-write bookkeeping 与 state sync
- 任何新抽离的入口层模块都应只负责 orchestration，不再吞入更多 domain 逻辑
