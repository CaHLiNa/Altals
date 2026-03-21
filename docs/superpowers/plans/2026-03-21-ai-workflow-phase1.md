# AI Workflow Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Altals 的 AI 从“任务启动器 + 聊天会话”升级为“显式 workflow run + chat 执行界面”的第一版骨架，并覆盖文稿审阅、文献检索、代码调试三条主工作流。

**Architecture:** 复用现有 chat session、tool profile、artifact 和 runtime 体系，在前端增加一层轻量 `aiWorkflowRuns` 状态模型与执行器。工作流元数据先挂在 session 上持久化，入口层从 `taskCatalog/launch` 启动 workflow run，聊天界面增加结构化 run 头部与 checkpoint 卡片。

**Tech Stack:** Vue 3、Pinia、AI SDK Chat、Tauri 前端调用、Node `node:test`

---

## File Map

### Create

- `src/services/ai/workflowRuns/state.js`
  责任：纯状态对象与 reducer 风格状态迁移，避免执行器逻辑和 UI 状态推进耦合。
- `src/services/ai/workflowRuns/templates.js`
  责任：定义 `draft.review-revise`、`references.search-intake`、`code.debug-current` 三个模板及其步骤蓝图。
- `src/services/ai/workflowRuns/planner.js`
  责任：将模板 + 上下文实例化为 run、steps、checkpoints、默认 artifacts。
- `src/services/ai/workflowRuns/executor.js`
  责任：推进步骤、创建 checkpoint、控制自动执行边界、向 chat 写入执行消息。
- `src/stores/aiWorkflowRuns.js`
  责任：Pinia store，持有活跃 run、run 索引、当前 checkpoint、与 session 的关联。
- `src/components/ai/AiWorkflowRunHeader.vue`
  责任：在聊天界面展示 workflow 标题、状态、当前步骤、artifact 数量。
- `src/components/ai/AiWorkflowCheckpointCard.vue`
  责任：渲染用户审批卡片，提供 accept / skip / continue 等决策按钮。
- `tests/aiWorkflowState.test.mjs`
  责任：验证 run / step 状态迁移与 checkpoint 逻辑。
- `tests/aiWorkflowPlanner.test.mjs`
  责任：验证三个模板的实例化结果、默认步骤顺序与审批节点位置。

### Modify

- `src/stores/chat.js`
  责任：为 session 增加 `_workflow` 元数据的持久化、恢复与更新接口。
- `src/services/ai/launch.js`
  责任：增加 workflow run 启动入口，区分 `prefill`、`send` 与 `workflow`。
- `src/services/ai/taskCatalog.js`
  责任：把高价值入口从 prompt task 升级成 workflow template descriptors。
- `src/components/ai/AiWorkbenchHome.vue`
  责任：把主要入口从“starting moves”改为“workflow starts”。
- `src/components/ai/AiQuickPanel.vue`
  责任：显示快捷 workflow，启动后直接创建 run。
- `src/components/editor/AiLauncher.vue`
  责任：兼容旧 launcher，逐步把 AI tab 中的主入口迁移到 workflow。
- `src/components/chat/ChatSession.vue`
  责任：集成 workflow 头部、checkpoint 卡片、状态与 artifact 联动显示。
- `src/stores/aiWorkbench.js`
  责任：补充 session 描述逻辑，使 workbench 可以识别 run 状态与模板标签。

### Optional Follow-Up

- `tests/aiWorkflowLaunch.test.mjs`
  责任：如果 `launch.js` 提取出足够纯的 helper，可补启动行为测试；否则留到 Phase 2。

## Constraints

- 不改工作分区，不创建新 worktree。
- 不重命名现有 `documentWorkflow` 体系；新的 AI 工作流统一使用 `aiWorkflowRuns` 命名。
- 第一版不引入 Rust 侧新命令，不新增数据库。
- 所有持久化先复用 `src/stores/chat.js` 的 session JSON。

## Task 1: 建立工作流状态模型

**Files:**
- Create: `src/services/ai/workflowRuns/state.js`
- Test: `tests/aiWorkflowState.test.mjs`

- [ ] **Step 1: 写状态迁移失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWorkflowRun,
  markRunPlanned,
  markStepRunning,
  createCheckpoint,
  resolveCheckpoint,
} from '../src/services/ai/workflowRuns/state.js'

test('workflow run enters waiting_user when a checkpoint is created', () => {
  const run = createWorkflowRun({ templateId: 'draft.review-revise' })
  const planned = markRunPlanned(run)
  const stepped = markStepRunning(planned, planned.steps[0].id)
  const waiting = createCheckpoint(stepped, {
    stepId: planned.steps[0].id,
    type: 'apply_patch',
  })

  assert.equal(waiting.status, 'waiting_user')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowState.test.mjs`

Expected: FAIL，报 `createWorkflowRun is not a function` 或模块不存在。

- [ ] **Step 3: 实现最小状态模型**

```js
export function createWorkflowRun({ templateId, title = '', context = {}, steps = [] } = {}) {
  return {
    id: crypto.randomUUID?.() || `wf-${Date.now()}`,
    templateId,
    title,
    context,
    status: 'draft',
    steps,
    checkpoints: [],
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    error: null,
  }
}
```

实现至少这些导出：

- `createWorkflowRun`
- `createWorkflowStep`
- `markRunPlanned`
- `markRunRunning`
- `markRunCompleted`
- `markRunFailed`
- `markStepRunning`
- `markStepCompleted`
- `markStepFailed`
- `createCheckpoint`
- `resolveCheckpoint`
- `attachArtifact`

- [ ] **Step 4: 扩充测试覆盖边界**

补 3 个断言：

- run 从 `draft -> planned -> running`
- checkpoint resolve 后回到 `running`
- step 失败后 run 进入 `failed`

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/aiWorkflowState.test.mjs`

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add tests/aiWorkflowState.test.mjs src/services/ai/workflowRuns/state.js
git commit -m "feat: add AI workflow state primitives"
```

## Task 2: 定义模板与 planner

**Files:**
- Create: `src/services/ai/workflowRuns/templates.js`
- Create: `src/services/ai/workflowRuns/planner.js`
- Test: `tests/aiWorkflowPlanner.test.mjs`

- [ ] **Step 1: 写 planner 失败测试**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createWorkflowPlan } from '../src/services/ai/workflowRuns/planner.js'

test('draft review workflow inserts an apply_patch checkpoint after patch generation', () => {
  const plan = createWorkflowPlan({
    templateId: 'draft.review-revise',
    context: { currentFile: '/tmp/draft.md' },
  })

  const labels = plan.steps.map((step) => step.kind)
  assert.deepEqual(labels, [
    'read_context',
    'analyze_goal',
    'generate_review',
    'generate_patch',
    'await_patch_decision',
    'summarize_outcome',
  ])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: FAIL，报 planner 模块不存在或导出缺失。

- [ ] **Step 3: 实现模板声明**

`templates.js` 至少导出：

- `WORKFLOW_TEMPLATE_IDS`
- `WORKFLOW_TEMPLATES`
- `getWorkflowTemplate(templateId)`

每个模板都声明：

- `id`
- `label`
- `role`
- `toolProfile`
- `steps`
- `autoAdvanceUntil`
- `approvalTypes`

- [ ] **Step 4: 实现 planner**

```js
import { createWorkflowRun, createWorkflowStep } from './state.js'
import { getWorkflowTemplate } from './templates.js'

export function createWorkflowPlan({ templateId, context = {} } = {}) {
  const template = getWorkflowTemplate(templateId)
  const steps = template.steps.map((step, index) => createWorkflowStep({
    id: `${templateId}:${index + 1}`,
    kind: step.kind,
    label: step.label,
    requiresApproval: !!step.requiresApproval,
  }))
  return createWorkflowRun({ templateId, title: template.label, context, steps })
}
```

- [ ] **Step 5: 补齐模板测试**

为 3 个模板各补 1 个测试：

- 审阅改写包含 `apply_patch`
- 文献检索包含 `accept_sources`
- 代码调试默认不直接改文件，但生成修复建议步骤

- [ ] **Step 6: 运行测试确认通过**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add tests/aiWorkflowPlanner.test.mjs src/services/ai/workflowRuns/templates.js src/services/ai/workflowRuns/planner.js
git commit -m "feat: add AI workflow templates and planner"
```

## Task 3: 将 workflow 元数据接入 chat session 持久化

**Files:**
- Modify: `src/stores/chat.js`
- Create: `src/stores/aiWorkflowRuns.js`
- Test: `tests/aiWorkflowState.test.mjs`

- [ ] **Step 1: 写 store 级失败测试或纯 helper 测试**

如果不方便直接测 Pinia store，就先给 `chat.js` 提取纯 helper：

- `serializeSessionWorkflow(session)`
- `hydrateSessionWorkflow(data)`

并给这两个 helper 补测试。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowState.test.mjs`

Expected: FAIL，新增 helper 未定义。

- [ ] **Step 3: 在 chat session 中加入 `_workflow`**

最小改动点：

- `createSession()` 默认 `_workflow: null`
- `saveSession()` 序列化 `_workflow`
- `reopenSession()` 恢复 `_workflow`
- 新增 `setSessionWorkflowMeta(id, workflow)`
- 新增 `updateSessionWorkflowMeta(id, updater)`

- [ ] **Step 4: 新建 `aiWorkflowRuns` store**

该 store 至少提供：

- `createRunFromTemplate`
- `bindRunToSession`
- `setActiveRun`
- `applyCheckpointDecision`
- `syncRunToSession`
- `describeRun`

实现要求：

- source of truth 在 run store
- session 只保留可持久化快照

- [ ] **Step 5: 跑测试并手动验证持久化**

Run:

```bash
node --test tests/aiWorkflowState.test.mjs
npm run build
```

Expected:

- 测试 PASS
- 构建通过

手动验证：

- 启动任意 workflow
- 关闭并重新打开聊天
- run 头部状态仍可恢复

- [ ] **Step 6: 提交**

```bash
git add src/stores/chat.js src/stores/aiWorkflowRuns.js tests/aiWorkflowState.test.mjs
git commit -m "feat: persist AI workflow metadata with chat sessions"
```

## Task 4: 升级 launch 与 task catalog

**Files:**
- Modify: `src/services/ai/launch.js`
- Modify: `src/services/ai/taskCatalog.js`
- Test: `tests/aiWorkflowPlanner.test.mjs`

- [ ] **Step 1: 给高价值入口写失败测试或纯映射测试**

目标测试：

- `review.current-draft` 入口映射为 `draft.review-revise`
- `research.paper-search` / `citation.prefill` 升级为 workflow descriptor
- `chat.general` 仍保持普通 chat

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: FAIL，旧入口仍只有 `prefill/send`。

- [ ] **Step 3: 修改 `taskCatalog.js`**

新增 descriptor 形态：

```js
{
  action: 'workflow',
  workflowTemplateId: 'draft.review-revise',
  role: 'reviewer',
  toolProfile: 'reviewer',
}
```

第一批改造这些入口：

- 当前文稿审阅
- 引文/文献检索
- 代码调试

保留这些为普通 chat：

- `General chat`
- 需要自由输入的 open-ended prompt

- [ ] **Step 4: 修改 `launch.js`**

新增：

- `startWorkflowRun(...)`
- `launchWorkflowTask(...)`
- 在 `launchAiTask()` 中识别 `action === 'workflow'`

要求：

- 创建 run
- 创建或绑定 session
- 注入 `_ai` 元数据
- 由 executor 决定是否立即发出第一条消息

- [ ] **Step 5: 运行测试与构建**

Run:

```bash
node --test tests/aiWorkflowPlanner.test.mjs
npm run build
```

Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/services/ai/taskCatalog.js src/services/ai/launch.js tests/aiWorkflowPlanner.test.mjs
git commit -m "feat: launch primary AI tasks as workflow runs"
```

## Task 5: 接入 executor，并把自动推进边界落下来

**Files:**
- Create: `src/services/ai/workflowRuns/executor.js`
- Modify: `src/stores/aiWorkflowRuns.js`
- Modify: `src/services/ai/runtimeConfig.js`
- Test: `tests/aiWorkflowState.test.mjs`

- [ ] **Step 1: 写 executor 失败测试**

目标：

- run 启动后自动推进到第一个需要审批的步骤
- 审阅工作流在 `generate_patch` 后停在 `await_patch_decision`
- 文献工作流在 `accept_sources` 前自动完成搜索与筛选

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowState.test.mjs`

Expected: FAIL，executor 不存在。

- [ ] **Step 3: 实现最小 executor**

建议 API：

```js
export async function executeWorkflowRun({
  run,
  sessionId,
  chatStore,
  workflowStore,
}) {
  // 根据 step.kind 推进状态
}
```

第一版不要做复杂循环。只做：

- 读取下一步
- 标记 step `running`
- 若是自动步骤，创建对应 chat message / artifact
- 若是审批步骤，创建 checkpoint 并停下
- 完成后推进到下一步

- [ ] **Step 4: 把自动推进边界写死为模板策略**

不要让模型自由决定何时停下；模板显式声明：

- `read_context` 自动
- `generate_review` 自动
- `generate_patch` 自动
- `await_patch_decision` 审批

- [ ] **Step 5: 运行测试与构建**

Run:

```bash
node --test tests/aiWorkflowState.test.mjs
npm run build
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/ai/workflowRuns/executor.js src/stores/aiWorkflowRuns.js src/services/ai/runtimeConfig.js tests/aiWorkflowState.test.mjs
git commit -m "feat: add AI workflow executor with approval boundaries"
```

## Task 6: 在 UI 中展示 workflow 头部与审批卡片

**Files:**
- Create: `src/components/ai/AiWorkflowRunHeader.vue`
- Create: `src/components/ai/AiWorkflowCheckpointCard.vue`
- Modify: `src/components/chat/ChatSession.vue`
- Modify: `src/stores/aiWorkbench.js`
- Test: `tests/leftSidebarPanels.test.mjs`

- [ ] **Step 1: 把 UI 计算逻辑提成纯 helper 并写失败测试**

不要直接测 Vue SFC。先在组件旁或 store 中提取纯 helper：

- `describeWorkflowHeader(run)`
- `getPendingCheckpoint(run)`

给 helper 补 node:test。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/leftSidebarPanels.test.mjs tests/aiWorkflowState.test.mjs`

Expected: FAIL，helper 未定义。

- [ ] **Step 3: 实现 `AiWorkflowRunHeader.vue`**

显示：

- workflow title
- template label
- status
- current step label
- artifact count

- [ ] **Step 4: 实现 `AiWorkflowCheckpointCard.vue`**

至少支持 3 个动作：

- `Accept`
- `Skip`
- `Continue later`

触发 store 中的 `applyCheckpointDecision()`。

- [ ] **Step 5: 修改 `ChatSession.vue`**

插入位置：

- 在 `sessionMeta` 区块之后
- artifact 列表之前

要求：

- 有 run 时显示 header
- 有 pending checkpoint 时显示 card
- 无 run 时行为不变

- [ ] **Step 6: 修改 `aiWorkbench.js` 描述 run**

`describeSession(session)` 除现有 role/runtime 外，再暴露：

- `workflowLabel`
- `workflowStatus`
- `workflowStepLabel`

- [ ] **Step 7: 构建验证**

Run: `npm run build`

Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src/components/ai/AiWorkflowRunHeader.vue src/components/ai/AiWorkflowCheckpointCard.vue src/components/chat/ChatSession.vue src/stores/aiWorkbench.js
git commit -m "feat: show AI workflow progress and checkpoints in chat"
```

## Task 7: 改入口文案与启动体验

**Files:**
- Modify: `src/components/ai/AiWorkbenchHome.vue`
- Modify: `src/components/ai/AiQuickPanel.vue`
- Modify: `src/components/editor/AiLauncher.vue`
- Modify: `src/services/ai/taskCatalog.js`
- Test: `tests/aiWorkflowPlanner.test.mjs`

- [ ] **Step 1: 写映射或 helper 失败测试**

目标：

- workbench 主入口优先显示 workflow
- quick panel 点击后直接启动 run
- 仅 `General chat` 保留自由聊天入口

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: FAIL

- [ ] **Step 3: 修改 `AiWorkbenchHome.vue`**

文案方向：

- “Start from current project” 改成更明确的 workflow 文案
- 卡片上展示是否会自动执行以及会停在哪类审批点

- [ ] **Step 4: 修改 `AiQuickPanel.vue` 和 `AiLauncher.vue`**

要求：

- 主操作触发 `launchWorkflowTask`
- 旧的普通 chat 能力仍保留，但降为次级入口

- [ ] **Step 5: 手工验证**

验证 3 条路径：

1. 从 workbench 启动“审阅当前文稿”
2. 从 quick panel 启动“检索并纳入参考文献”
3. 从 launcher 启动“调试当前代码”

都应直接进入一个带 workflow 头部的会话。

- [ ] **Step 6: 构建验证**

Run: `npm run build`

Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add src/components/ai/AiWorkbenchHome.vue src/components/ai/AiQuickPanel.vue src/components/editor/AiLauncher.vue src/services/ai/taskCatalog.js
git commit -m "feat: promote AI workflows across launcher surfaces"
```

## Task 8: 端到端验证与收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-03-21-ai-workflow-design.md`
- Modify: `docs/superpowers/plans/2026-03-21-ai-workflow-phase1.md`

- [ ] **Step 1: 运行所有新增测试**

Run:

```bash
node --test tests/aiWorkflowState.test.mjs tests/aiWorkflowPlanner.test.mjs
```

Expected: PASS

- [ ] **Step 2: 运行前端构建**

Run: `npm run build`

Expected: PASS

- [ ] **Step 3: 做 3 条手工冒烟验证**

检查：

- 审阅工作流会停在 patch 审批
- 文献工作流会停在 sources 接受点
- 代码工作流不会默认直接改文件

- [ ] **Step 4: 回写文档中的实际偏差**

若实现时与 spec 或 plan 有偏差：

- 更新 spec 的“推荐结构”
- 更新 plan 的“实际落地差异”

- [ ] **Step 5: 最终提交**

```bash
git add docs/superpowers/specs/2026-03-21-ai-workflow-design.md docs/superpowers/plans/2026-03-21-ai-workflow-phase1.md tests/aiWorkflowState.test.mjs tests/aiWorkflowPlanner.test.mjs src/services/ai/workflowRuns src/stores/aiWorkflowRuns.js src/stores/chat.js src/services/ai/launch.js src/services/ai/taskCatalog.js src/components/ai/AiWorkflowRunHeader.vue src/components/ai/AiWorkflowCheckpointCard.vue src/components/chat/ChatSession.vue src/components/ai/AiWorkbenchHome.vue src/components/ai/AiQuickPanel.vue src/components/editor/AiLauncher.vue src/stores/aiWorkbench.js
git commit -m "feat: add phase 1 AI workflow runtime"
```

## Execution Notes

- 先实现纯状态和 planner，再碰 UI。
- 任何需要测试的逻辑都优先提取为纯函数，继续沿用仓库现有 `node:test` 风格。
- `taskCatalog` 中不要一次性全改，只改最有价值的 3 条链路。
- 如果 `ChatSession.vue` 变得过重，允许把 workflow UI 逻辑进一步拆到 `src/components/ai/` 下。
- 如果 session `_workflow` 快照开始膨胀，在 Phase 2 再拆独立持久化文件，不在本阶段提前设计。
