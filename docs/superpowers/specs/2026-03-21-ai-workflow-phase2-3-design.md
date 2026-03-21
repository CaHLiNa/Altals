# Altals AI Workflow Phase 2-3 Design

日期：2026-03-21

状态：Implemented through Phase 3 on 2026-03-21

## 背景

Phase 1 已经把 Altals 的 AI 从“任务启动器 + 聊天会话”推进到了显式 `workflow run + chat` 骨架：

- `draft.review-revise`
- `references.search-intake`
- `code.debug-current`

同时，workflow session 现在会自动发送真实首条任务请求，而不是只把 prompt 预填进输入框。

但 Phase 1 仍然只覆盖 3 条主链路。大量高频任务依旧停留在 `send` 或 `prefill` 级别，这会重新把用户拉回“像工作流，但还不是工作流”的体验。

## 范围检查

Phase 2 和 Phase 3 不能作为一个实现批次直接推进。它们至少包含 3 个相互依赖但边界不同的子项目：

1. `Phase 2A`
   迁移更多高频任务到现有 workflow runtime
2. `Phase 2B`
   把 TeX / Typst compile-and-fix 接到同一套 workflow 与审批边界
3. `Phase 3`
   在前两者稳定后，再加入有限后台执行与恢复入口

结论：必须拆阶段执行，不能 big bang。

## 方案比较

### 方案 A：一次性实现 Phase 2 + Phase 3

优点：

- 一次性把 roadmap 做满

缺点：

- 范围过宽
- executor、入口迁移、后台运行会同时变更
- 很难定位回归来源

### 方案 B：沿现有 runtime 逐段扩展，先 2A，再 2B，最后 3

优点：

- 复用现有 `aiWorkflowRuns`
- 每段都能单独验证
- 背景执行建立在已验证的 workflow 模板之上

缺点：

- 需要多次小批次演进

### 方案 C：先做 Phase 3，再反推模板迁移

优点：

- 更早出现“agent”感

缺点：

- 背景能力会建立在尚未完成模板化的任务之上
- 容易把产品重新拉回开放式聊天代理

## 推荐

采用方案 B。

顺序固定为：

1. `Phase 2A`: notebook / reference maintenance / PDF summary / compare sources
2. `Phase 2B`: TeX / Typst compile-and-fix
3. `Phase 3`: background execution / notifications / restore entry

## Phase 2A 设计

### 目标

把现有高频但仍是 `send` / `prefill` 的研究任务迁入 workflow 体系，并保持 Phase 1 的交互原则：

- 默认自动推进
- 只在高风险动作前暂停
- 继续复用 chat session、artifacts、runtimeConfig、toolProfile

### 新增模板

#### `code.notebook-assistant`

用于当前 notebook 的分析、调试与编辑建议。

步骤：

1. `read_context`
2. `analyze_goal`
3. `inspect_notebook_cells`
4. `generate_notebook_plan`
5. `await_notebook_edit_decision`
6. `summarize_outcome`

审批点：

- `apply_notebook_edits`

默认行为：

- 自动读取 notebook 上下文并产出分析/修改建议
- 不默认直接改 notebook 单元格

#### `references.maintenance`

用于文献库维护、重复项清理、元数据补全、缺失 PDF 排查。

步骤：

1. `read_context`
2. `analyze_goal`
3. `audit_reference_library`
4. `detect_reference_issues`
5. `generate_reference_actions`
6. `await_reference_change_decision`
7. `summarize_outcome`

审批点：

- `apply_reference_changes`

默认行为：

- 自动审计与归纳问题
- 不默认直接批量改 reference metadata

#### `pdf.summary-current`

用于当前 PDF 的结构化总结。

步骤：

1. `read_context`
2. `analyze_goal`
3. `extract_pdf_findings`
4. `generate_summary`
5. `summarize_outcome`

审批点：无

默认行为：

- 自动完成，产出 `summary`

#### `research.compare-sources`

用于比较论文、方法或候选来源。

步骤：

1. `read_context`
2. `analyze_goal`
3. `search_local_references`
4. `search_external_sources`
5. `compare_source_set`
6. `generate_proposal_cards`
7. `summarize_outcome`

审批点：无

默认行为：

- 自动完成，产出 `proposal` / `summary`

### 入口迁移

以下任务从普通聊天入口迁成 workflow descriptor：

- `code.notebook-current`
- `citation.maintenance`
- `pdf.summarise`
- `research.compare-sources`

保留原有标签、角色和 tool profile，不改用户心智，只改运行语义。

### 执行器扩展

Phase 2A 不引入新执行引擎，只扩展现有 `workflowRuns/executor.js`：

- 新增步骤 narrative
- 新增 artifact 产出映射
- 新增 `apply_notebook_edits` / `apply_reference_changes` 两类审批边界

executor 仍然是“结构化推进器”，而不是后台自治代理。

## Phase 2B 设计

### 目标

把 TeX / Typst 的诊断与修复任务纳入 workflow，而不是单独保留在专用 task path。

### 模板

新增：

- `compile.tex-typ-fix`

步骤：

1. `read_context`
2. `diagnose_compile_issue`
3. `generate_patch`
4. `await_patch_decision`
5. `summarize_outcome`

审批点：

- `apply_patch`

### 原则

- 保留现有 compile / diagnose 辅助能力
- 不在 Phase 2B 重写 document workflow
- 只统一 AI 任务的 workflow 语义与审批点

## Phase 3 设计

### 目标

加入有限后台执行能力，但不做常驻自治代理。

### 范围

#### 后台可运行的 workflow run

run 增加：

- `executionMode`: `foreground | background`
- `backgroundCapable`
- `lastHeartbeatAt`
- `resumeHint`

#### 恢复入口

用户需要能够从以下位置找回后台 run：

- AI workbench
- 会话列表
- run header / banner

#### 通知

第一版只做应用内通知与状态徽标，不做系统级持久后台守护进程。

触发场景：

- run completed
- run failed
- run waiting_user

### 非目标

- 不做脱离应用生命周期的 daemon
- 不做无限时长自治代理
- 不做多 run 并发调度器

## 测试策略

### Phase 2A

- 模板/入口映射测试
- executor 审批边界测试
- workflow starter 排序回归测试

### Phase 2B

- compile diagnose/fix workflow 模板测试
- patch approval 边界测试

### Phase 3

- background run 状态切换测试
- session 恢复与 run 绑定测试
- 通知触发条件测试

## 执行顺序

1. 实现 Phase 2A
2. 验证入口迁移没有破坏 Phase 1
3. 实现 Phase 2B
4. 稳定 workflow 模板集合
5. 最后再实现 Phase 3 的后台运行能力

## 决策记录

- 不把 Phase 2 和 Phase 3 合并为单次实现
- 不先做后台代理，再补模板
- 不为 Phase 3 提前引入 Rust 队列或数据库
- Phase 3 继续建立在现有 `chat session + workflow run` 架构上

## 实际落地说明

### Phase 2B

- 新增 `compile.tex-typ-diagnose` 与 `compile.tex-typ-fix` 两个 workflow templates。
- `diagnose.tex-typ` / `fix.tex-typ` 现已改为 workflow descriptor；它们继续复用 `prepareTexTypFixTask()` 的 compile diagnosis 预热。
- compile diagnose 自动完成并产出 `compile_diagnosis`；compile fix 在 `apply_patch` 之前暂停。
- 无文件上下文的 `compile.assistant` 暂不迁移，继续保持 `prefill`。

### Phase 3

- `workflow run` 新增 `executionMode`、`backgroundCapable`、`lastHeartbeatAt`、`resumeHint`。
- `Continue later` 现在会把 run 切到 `background` 并持久化 snapshot，不会丢失 open checkpoint。
- AI workbench 首页新增 background workflows 恢复区块，recent chats 也会显示 workflow 状态与 background 提示。
- `AiWorkflowRunHeader` 会展示 background pill 和恢复提示。
- 应用内通知会在 `waiting_user`、`completed`、`failed` 三种关键状态触发。
