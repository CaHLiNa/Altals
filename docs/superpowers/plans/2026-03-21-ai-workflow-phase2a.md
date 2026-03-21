# AI Workflow Phase 2A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 notebook assistant、reference maintenance、PDF summary、compare sources 迁入现有 AI workflow runtime。

**Architecture:** 继续复用 `src/services/ai/workflowRuns/*`、`src/stores/aiWorkflowRuns.js` 和现有 chat session 持久化。Phase 2A 只扩展模板、executor 和任务入口，不引入后台执行或新的持久化层。

**Tech Stack:** Vue 3、Pinia、AI SDK Chat、Node `node:test`

---

## File Map

### Create

- `docs/superpowers/specs/2026-03-21-ai-workflow-phase2-3-design.md`
  责任：记录 Phase 2A / 2B / 3 的边界和推荐执行顺序。

### Modify

- `src/services/ai/workflowRuns/templates.js`
  责任：新增 Phase 2A workflow templates。
- `src/services/ai/workflowRuns/executor.js`
  责任：新增步骤 narrative、artifact 映射和审批边界。
- `src/services/ai/taskCatalog.js`
  责任：把 Phase 2A 任务入口迁成 workflow descriptors。
- `tests/aiWorkflowPlanner.test.mjs`
  责任：验证新模板、入口映射和 starter 行为。
- `tests/aiWorkflowState.test.mjs`
  责任：验证 executor 对新模板的审批点和自动完成边界。

## Constraints

- 不改工作分区，不创建新 worktree。
- 不引入新的 Rust 命令或后台队列。
- 不为 Phase 3 提前埋复杂并发执行逻辑。
- `General chat` 继续保持为唯一自由聊天入口。

## Task 1: 新增 Phase 2A workflow templates

**Files:**
- Modify: `src/services/ai/workflowRuns/templates.js`
- Test: `tests/aiWorkflowPlanner.test.mjs`

- [ ] **Step 1: 写失败测试，声明 4 个新模板 id**

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: FAIL，提示 template id 不存在。

- [ ] **Step 3: 在 `templates.js` 中加入以下模板**

- `code.notebook-assistant`
- `references.maintenance`
- `pdf.summary-current`
- `research.compare-sources`

- [ ] **Step 4: 为每个模板补步骤蓝图**

- notebook: `inspect_notebook_cells`、`generate_notebook_plan`、`await_notebook_edit_decision`
- references maintenance: `audit_reference_library`、`detect_reference_issues`、`generate_reference_actions`、`await_reference_change_decision`
- pdf summary: `extract_pdf_findings`、`generate_summary`
- compare sources: `compare_source_set`、`generate_proposal_cards`

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: PASS

## Task 2: 扩展 executor 支持新步骤与审批边界

**Files:**
- Modify: `src/services/ai/workflowRuns/executor.js`
- Test: `tests/aiWorkflowState.test.mjs`

- [ ] **Step 1: 写失败测试，覆盖 notebook 和 reference maintenance 的审批边界**

- notebook workflow 停在 `apply_notebook_edits`
- reference maintenance workflow 停在 `apply_reference_changes`
- pdf summary 和 compare sources 自动完成

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowState.test.mjs`

Expected: FAIL，审批类型或状态不匹配。

- [ ] **Step 3: 扩展 `TEMPLATE_EXECUTION_POLICY`**

- `code.notebook-assistant -> apply_notebook_edits`
- `references.maintenance -> apply_reference_changes`
- `pdf.summary-current -> no approval`
- `research.compare-sources -> no approval`

- [ ] **Step 4: 补充 narrative 和 artifact 映射**

- notebook: `summary`, `proposal`
- reference maintenance: `proposal`, `summary`
- pdf summary: `summary`
- compare sources: `proposal`, `summary`

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/aiWorkflowState.test.mjs`

Expected: PASS

## Task 3: 把入口任务迁到 workflow

**Files:**
- Modify: `src/services/ai/taskCatalog.js`
- Test: `tests/aiWorkflowPlanner.test.mjs`

- [ ] **Step 1: 写失败测试，验证入口任务 action 变为 `workflow`**

覆盖：

- `code.notebook-current`
- `citation.maintenance`
- `pdf.summarise`
- `research.compare-sources`

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: FAIL，action 仍为 `send` 或 `prefill`。

- [ ] **Step 3: 修改 `taskCatalog.js`**

- `createNotebookAssistantTask()` 改成 workflow descriptor
- `createReferenceMaintenanceTask()` 改成 workflow descriptor
- PDF 当前文件任务改成 `pdf.summary-current`
- `createSourceComparisonTask()` 改成 workflow descriptor

- [ ] **Step 4: 保持 starter 排序与 boundary copy 一致**

- workflow starters 仍优先于普通任务
- `General chat` 不变

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/aiWorkflowPlanner.test.mjs`

Expected: PASS

## Task 4: 回归验证与文档同步

**Files:**
- Modify: `docs/superpowers/specs/2026-03-21-ai-workflow-design.md`
- Test: `tests/aiWorkflowLaunch.test.mjs`
- Test: `tests/aiWorkflowState.test.mjs`
- Test: `tests/aiWorkflowPlanner.test.mjs`
- Test: `tests/aiWorkflowRuns.test.mjs`
- Test: `tests/leftSidebarPanels.test.mjs`

- [ ] **Step 1: 追加 Phase 2A 落地说明到主设计文档**

- [ ] **Step 2: 运行 workflow 相关测试**

Run: `node --test tests/aiWorkflowLaunch.test.mjs tests/aiWorkflowState.test.mjs tests/aiWorkflowPlanner.test.mjs tests/aiWorkflowRuns.test.mjs tests/leftSidebarPanels.test.mjs`

Expected: PASS

- [ ] **Step 3: 运行构建**

Run: `npm run build`

Expected: PASS，仅允许已有 Vite dynamic import / chunk warning。

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/specs/2026-03-21-ai-workflow-phase2-3-design.md docs/superpowers/specs/2026-03-21-ai-workflow-design.md docs/superpowers/plans/2026-03-21-ai-workflow-phase2a.md src/services/ai/workflowRuns/templates.js src/services/ai/workflowRuns/executor.js src/services/ai/taskCatalog.js tests/aiWorkflowLaunch.test.mjs tests/aiWorkflowState.test.mjs tests/aiWorkflowPlanner.test.mjs tests/aiWorkflowRuns.test.mjs tests/leftSidebarPanels.test.mjs
git commit -m "feat: extend AI workflows for phase 2a tasks"
```

## Notes

- Phase 2B 与 Phase 3 需要在 Phase 2A 验证通过后单独写计划，不合并进本计划。
- 不为 notebook 或 reference maintenance 添加直接 destructive edit 默认行为。
- compare sources 默认产出 proposal / summary，不直接改文稿。
