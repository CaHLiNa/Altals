# Bundle Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 压缩 Altals 的主入口包体，并把重功能模块稳定切到按需加载和独立 vendor chunk 中。

**Architecture:** 先把根壳层中非首屏必需的 UI 容器改为异步组件，再把设置页、侧栏和右面板内部做二级懒加载，最后用 Vite `manualChunks` 把重量级依赖按功能簇稳定分包。每一批都用构建命令验证，避免为了减包体打坏工作区主流程。

**Tech Stack:** Vue 3, Pinia, Vite, Tauri 2

---

### Task 1: Define bundle boundaries

**Files:**
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/vite.config.js`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/task_plan.md`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/findings.md`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/progress.md`

**Step 1: Write the failing test**

当前没有自动化测试，本轮继续以构建输出和 chunk 结果作为守门。

**Step 2: Run test to verify it fails**

现状 `vite.config.js` 没有分包策略，构建输出中主 `index` chunk 和 `superdoc` chunk 过大。

**Step 3: Write implementation for this step**

- 为重量级依赖定义稳定的 `manualChunks`
- 保持最小必要共享依赖留在公共包，避免切得过碎
- 在记录文件中写明本轮分包目标与风险边界

**Step 4: Run test to verify it passes**

Run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both commands succeed

**Step 5: Commit**

```bash
git add vite.config.js task_plan.md findings.md progress.md docs/plans/2026-03-15-bundle-optimization-design.md docs/plans/2026-03-15-bundle-optimization.md
git commit -m "docs: plan bundle optimization"
```

### Task 2: Lazy-load root shell containers

**Files:**
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/App.vue`

**Step 1: Write the failing test**

依赖构建与启动路径检查作为回归验证。

**Step 2: Run test to verify it fails**

现状 `App.vue` 同步装配了多个非首屏必需容器，导致主入口包偏大。

**Step 3: Write implementation for this step**

- 将 `Settings`、`VersionHistory`、`LeftSidebar`、`RightPanel`、`BottomPanel` 改为异步组件
- 保持工作区主骨架、头部和 pane 容器同步加载
- 为可选面板加最小 loading/fallback，避免首次打开体验断裂

**Step 4: Run test to verify it passes**

Run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both commands succeed

**Step 5: Commit**

```bash
git add src/App.vue
git commit -m "refactor(bundle): lazy load app shell panels"
```

### Task 3: Lazy-load secondary panels and settings sections

**Files:**
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/settings/Settings.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/sidebar/LeftSidebar.vue`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/src/components/panel/RightPanel.vue`

**Step 1: Write the failing test**

依赖构建与功能切换路径检查作为回归验证。

**Step 2: Run test to verify it fails**

现状设置页 section、引用列表和 backlink 面板会在入口阶段被提前装进较大的共享包。

**Step 3: Write implementation for this step**

- `Settings` 各 section 改成真正按 tab 访问时再加载
- `ReferenceList` 仅在引用面板展开时加载
- `Backlinks` 仅在切到对应 tab 时加载

**Step 4: Run test to verify it passes**

Run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both commands succeed

**Step 5: Commit**

```bash
git add src/components/settings/Settings.vue src/components/sidebar/LeftSidebar.vue src/components/panel/RightPanel.vue
git commit -m "refactor(bundle): defer secondary panel payloads"
```

### Task 4: Final verification and measurement

**Files:**
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/task_plan.md`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/findings.md`
- Modify: `/Users/math173sr/Documents/GitHub项目/Altals/progress.md`

**Step 1: Write the failing test**

需要确认分包后构建仍然稳定，且主入口体积确实下降。

**Step 2: Run test to verify it fails**

如果异步边界或 vendor 分组有误，构建可能失败或包体不会改善。

**Step 3: Write implementation for this step**

- 对比构建输出中的主 chunk 与重量级功能 chunk
- 记录本轮优化成果、残余大包和后续风险
- 更新计划文件

**Step 4: Run test to verify it passes**

Run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both commands succeed

**Step 5: Commit**

```bash
git add task_plan.md findings.md progress.md
git commit -m "docs: record bundle optimization results"
```
