# Altals AI Workflow Design

日期：2026-03-21

状态：Draft

## 背景

Altals 当前已经具备一套不错的 AI 能力基础：

- 有统一的 chat session 与持久化机制
- 有 `taskId`、`role`、`toolProfile`、`allowedTools`
- 有可复用的工具体系、artifact 体系、运行时适配层
- 有 `AiQuickPanel`、`AiWorkbenchHome`、`ChatSession` 等入口与承载界面

但当前产品形态仍主要是“任务启动器 + 聊天代理”：

- 很多 AI 入口只是把预设 prompt 塞进输入框
- 用户需要频繁手动确认发送
- 系统知道“开了一个聊天”，但不知道“一个任务现在做到第几步”
- 产物、步骤、审批点、失败恢复都依附在消息流里，缺少显式工作流状态

这使得 AI 更像一个带模板的聊天窗口，而不是一个可持续推进研究任务的工作流系统。

## 目标

本设计的目标不是做一个全自动后台代理，而是把 Altals 升级为“显式工作流驱动的 AI 协作系统”。

第一版目标：

- 将 AI 从“预填 prompt”升级为“可执行的工作流 run”
- 让用户明确看到目标、步骤、当前状态、产物、审批点
- 让 AI 自动串行完成低风险步骤，而不是每一步都退回输入框
- 保持现有 chat、tool、artifact、runtime 资产可复用
- 优先覆盖 3 条高价值链路：文稿审阅改写、文献检索纳入、代码或 notebook 调试

第一版非目标：

- 不做后台长期自主运行的常驻代理
- 不做通用 BPMN/流程编排器
- 不引入新的后端数据库或复杂任务队列
- 不一次性重写现有 chat 架构

## 设计原则

1. 工作流是产品对象，聊天是执行界面。
2. 默认自动推进，只有关键节点才停下等用户。
3. 低风险动作自动执行，高风险动作显式审批。
4. 优先复用现有 `taskCatalog`、`launch`、`runtimeConfig`、`toolRegistry`、artifact 体系。
5. 第一版先做强约束模板化工作流，不做开放式自治 agent。

## 核心对象模型

### WorkflowTemplate

定义一种工作流模板，对应用户可见的“AI 工作流入口”。

建议字段：

- `id`
- `label`
- `description`
- `domain`
- `entryContext`
- `defaultRole`
- `defaultToolProfile`
- `stepBlueprints`
- `approvalPolicy`
- `artifactPolicy`

第一版建议模板：

- `draft.review-revise`
- `references.search-intake`
- `code.debug-current`

### WorkflowRun

一次具体执行实例。它是 AI 工作流的一等对象。

建议字段：

- `id`
- `templateId`
- `title`
- `goal`
- `status`
- `createdAt`
- `updatedAt`
- `context`
- `plan`
- `steps`
- `artifacts`
- `checkpoints`
- `linkedSessionId`
- `summary`
- `error`

状态机：

- `draft`
- `planned`
- `running`
- `waiting_user`
- `completed`
- `failed`
- `cancelled`

### WorkflowStep

可追踪的单步执行单元。

建议字段：

- `id`
- `kind`
- `label`
- `status`
- `startedAt`
- `finishedAt`
- `input`
- `output`
- `requiresApproval`
- `dependsOn`
- `error`

状态机：

- `pending`
- `running`
- `waiting_user`
- `completed`
- `failed`
- `skipped`

### WorkflowArtifact

工作流显式产物，不再只是聊天副产物。

建议字段：

- `id`
- `type`
- `title`
- `summary`
- `payload`
- `sourceStepId`
- `createdAt`

第一版重点复用现有 artifact 类型：

- `review`
- `proposal`
- `citation_set`
- `patch`
- `compile_diagnosis`
- `summary`

### WorkflowCheckpoint

需要用户介入的审批点。

建议字段：

- `id`
- `runId`
- `stepId`
- `type`
- `title`
- `prompt`
- `decision`
- `options`
- `createdAt`
- `resolvedAt`

第一版重点审批类型：

- `apply_patch`
- `accept_sources`
- `continue_external_search`
- `run_destructive_command`
- `rerun_with_broader_scope`

### WorkflowContext

启动时冻结的结构化上下文，避免后续只靠 prompt 猜上下文。

建议字段：

- `workspacePath`
- `currentFile`
- `selection`
- `recentFiles`
- `referenceKeys`
- `modelId`
- `role`
- `toolProfile`
- `runtimeId`
- `userInput`

## 生命周期设计

一次工作流从启动到结束应遵循以下路径：

1. 用户从 launcher、quick panel、chat tools 或上下文动作启动模板。
2. 系统创建 `WorkflowRun`，并生成或绑定一个 chat session。
3. 系统根据模板和上下文生成初始 `plan` 与 `steps`。
4. Run 进入 `running`，自动执行低风险步骤。
5. 执行过程中，AI 可持续向 chat 写入过程说明，但 run 自身维护结构化状态。
6. 如遇关键决策，创建 `WorkflowCheckpoint`，run 进入 `waiting_user`。
7. 用户确认后，继续执行后续步骤。
8. 结束时生成结果摘要与显式 artifact，run 进入 `completed` 或 `failed`。

关键原则：

- 不再把“发第一条消息前的确认输入”作为默认步骤
- `waiting_user` 只能由审批点触发，而不是由产品 UI 惯性触发

## 与现有 Chat 架构的关系

第一版不新建独立存储系统，而是将工作流元数据挂接到现有 chat session 持久化中。

建议做法：

- 在 session 上新增 `_workflow` 字段
- `saveSession()` / `reopenSession()` 一并持久化与恢复 `_workflow`
- `linkedSessionId` 始终指向当前工作流所用 chat session
- 聊天仍负责消息流与工具调用，工作流负责步骤流与审批流

这样可以最大限度复用当前：

- `src/stores/chat.js`
- `src/services/ai/launch.js`
- `src/services/ai/runtimeConfig.js`
- `src/services/ai/toolRegistry.js`
- `src/stores/aiArtifacts.js`

## 执行器设计

第一版引入一个轻量 `workflow executor`，位于前端服务层即可，不必先下沉 Rust。

建议新增：

- `src/services/ai/workflows/templates.js`
- `src/services/ai/workflows/executor.js`
- `src/services/ai/workflows/planner.js`
- `src/stores/aiWorkflows.js`

职责划分：

- `templates.js`：声明模板、步骤蓝图、审批规则
- `planner.js`：根据上下文把模板实例化为 run 与 steps
- `executor.js`：推进步骤状态、发消息、等待工具结果、创建 checkpoint
- `aiWorkflows.js`：持有当前活跃 run、run 列表、审批状态、UI 视图模型

执行策略：

- 每个模板先定义有限状态步骤，而不是开放式“让模型自己规划一切”
- AI 负责完成步骤内推理与工具使用
- 系统负责步骤顺序、审批门槛、状态推进、失败恢复

这比“纯 agent 自主决定一切”更稳定，也更符合研究写作产品的可控性要求。

## 风险分级与自动化边界

### 自动执行

以下动作默认自动推进：

- 读取当前文件、选区、notebook、工作区元数据
- 搜索本地 references
- 外部网页与文献搜索
- 生成 review、summary、proposal、citation candidates
- 编译检查、诊断报告
- 生成补丁提案但不直接应用

### 需要审批

以下动作进入 `waiting_user`：

- 应用文件修改
- 批量导入外部参考文献到本地库
- 执行可能改变工作区状态的命令
- 扩大搜索范围导致成本显著上升
- 覆盖已存在结论或替换用户已有内容

## 三条首批工作流

### 1. 文稿审阅与改写

模板：`draft.review-revise`

典型步骤：

1. 读取当前文稿和活跃评论
2. 识别文档类型与任务目标
3. 生成 review artifact
4. 将问题归类为结构、论证、语气、引用、措辞
5. 对可直接修改的问题生成 patch artifact
6. 在应用修改前触发 checkpoint
7. 应用后给出变更摘要与残余问题

默认自动执行到“生成 patch artifact”为止，只在应用修改前停下。

### 2. 文献检索与纳入

模板：`references.search-intake`

典型步骤：

1. 识别主题、已有文稿或待支撑主张
2. 先查本地 references
3. 如不足，再做外部搜索
4. 产出 proposal / citation_set artifact
5. 解释每个候选来源的适配理由
6. 在导入参考文献前触发 checkpoint
7. 导入后可继续进入“插入 citation”或“补写证据链”

默认自动执行到“候选来源筛选完成”为止，只在真正纳入库中时停下。

### 3. 代码或 Notebook 调试

模板：`code.debug-current`

典型步骤：

1. 读取当前文件或 notebook
2. 提取任务目标、报错、最近上下文
3. 运行安全诊断动作
4. 形成问题假设列表
5. 生成修复 patch 或 notebook 编辑建议
6. 若需修改文件，触发 checkpoint
7. 修改后可选执行验证步骤

默认自动完成定位、解释、修复建议，不默认直接改代码。

## UI 设计

### 入口层

现有入口不消失，但语义升级：

- `AiWorkbenchHome`：展示“工作流模板”
- `AiQuickPanel`：展示“快捷工作流”
- `ChatInput` tools 菜单：展示“从这里启动某个工作流”

不要再把主要入口表述成 “starting moves, continue the conversation below”，而要明确表述成：

- 任务目标
- 当前上下文
- 自动执行范围
- 需要你确认的节点

### 会话层

`ChatSession` 上方增加工作流头部区域：

- 当前 workflow title
- 当前状态
- 当前步骤
- 已产出 artifact 数
- 是否等待用户确认

聊天流继续保留，但消息上方有结构化 run 面板。

### 审批层

审批点不要退回输入框，而要有明确卡片：

- 问题是什么
- AI 建议是什么
- 可选决策按钮是什么
- 选完后执行什么

这会比“AI 说一段话，你再自己输入 yes”稳定得多。

## 与现有 taskCatalog 的升级方式

当前 `taskCatalog` 不必废弃，而是分三层：

- `workflow templates`：真正的工作流入口
- `quick actions`：轻量即时动作
- `chat prompts`：保留少量自由聊天入口

升级原则：

- 原先 `action: 'prefill'` 的高价值任务，优先转成 `workflow`
- 只有明确适合自由输入的入口才保留 `prefill`
- `send` 型任务可逐步并入 workflow executor

## 持久化与恢复

第一版建议直接在 chat session JSON 中加入 `_workflow`：

- 可随聊天一起保存
- 关闭应用后可恢复工作流状态
- 不需要新增数据库迁移

最小字段建议：

- `run`
- `steps`
- `checkpoints`
- `artifacts`
- `ui`

如果后续 run 与 session 关系变复杂，再拆成独立 `workflows/*.json`。

## 失败恢复

第一版必须显式支持：

- 模型报错后保留已完成步骤
- 外部搜索失败后允许重试该步
- 用户拒绝某次审批后允许切换分支，例如“只保留 review，不应用 patch”
- 会话恢复后能看到工作流停在何处

失败不可只在聊天消息里出现，必须同步到 `WorkflowRun.error` 与对应 step 状态。

## 分阶段落地计划

### Phase 1

目标：让工作流成为产品骨架，但只覆盖 3 条模板。

范围：

- 新增 `aiWorkflows` store
- 给 session 增加 `_workflow`
- 把 `draft.review-revise`、`references.search-intake`、`code.debug-current` 做成模板
- `AiWorkbenchHome` 与 `AiQuickPanel` 改为启动 workflow run
- `ChatSession` 增加 workflow 头部与 checkpoint 卡片

### Phase 2

目标：让更多现有任务迁移到工作流体系。

范围：

- notebook assistant
- reference maintenance
- TeX / Typst compile-and-fix
- PDF summary / compare sources

### Phase 3

目标：加入有限后台代理能力。

范围：

- 可后台运行的长任务
- 批量检查与夜间巡检
- run 级通知与恢复入口

## 为什么不直接做长期代理

对 Altals 这种研究工作台来说，当前最缺的是“任务结构化推进”，不是“无限自主代理”。

如果在没有显式 run、step、checkpoint 的前提下直接做长期代理，会立刻遇到这些问题：

- 用户不知道 AI 在做什么
- 修改风险不可控
- 失败后无法恢复到中间状态
- UI 只能继续退化成一堆聊天消息

所以正确顺序是：

先把工作流对象化，再逐步增加自主性。

## 推荐结论

Altals 应采用的不是“模板 prompt 产品”，也不是“全自动后台 agent”，而是：

一个以 `WorkflowRun` 为核心对象、以 chat 为执行界面、以 checkpoint 为安全边界、以 artifact 为结果载体的显式 AI 工作流系统。

这条路径与当前代码结构最兼容，也最符合研究写作、文献管理、代码调试三类任务的真实需求。
