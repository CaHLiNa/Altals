# ScribeFlow AI 学术研究专家化改造计划

日期：2026-04-19  
状态：拟执行主计划  
范围：桌面端 AI runtime、研究上下文、文献证据链、artifact、验证闭环、AI 面板交互  
关联文档：

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/AI_CODEX_DESKTOP_REPLICATION.md`
- `docs/CODEX_CLI_ALIGNMENT_PLAN.md`

---

## 1. 计划目标

把当前 ScribeFlow 的 AI 从“具备 Codex 风格 runtime 的桌面 agent 面板”推进为“面向学术研究工作流的专家型研究代理”。

这次规划不追求把产品做成通用聊天壳子，也不追求先在表面上继续模仿 Codex Desktop。核心目标只有一个：

- 让 AI 在学术研究任务中，能基于真实项目上下文、真实文献证据和真实验证结果完成高质量工作。

最终应具备的体验不是“AI 会说什么”，而是：

- AI 知道当前研究任务是什么
- AI 知道应引用哪些证据以及为什么
- AI 知道应该输出哪种研究工件
- AI 知道什么时候算完成，什么时候必须继续验证
- 用户能追踪 AI 的证据来源、修改理由和未完成项

---

## 2. 当前基线判断

截至当前仓库状态，AI 基线已经明显高于普通“编辑器内嵌 LLM”方案。

### 2.1 已经具备的能力

- Rust 持有 runtime thread / turn / approval / ask-user / exit-plan / plan-mode / persistence 语义。
- 已具备最小本地执行链：`read_file`、`list_files`、`search_files`、`apply_patch`、`exec_command`、`write_stdin`、`request_user_input`。
- 已开始对齐 Codex 风格的 runtime session rail、tool events 与审批流。
- 已具备 skill catalog、MCP discovery 与 tool catalog 的基础能力。
- 已具备研究导向 artifact 雏形，如 `doc_patch` 与 `note_draft`。
- 已具备参考文献与引用运行时基础，包括 reference import、citation formatting、BibTeX 导出与 Crossref / DOI 接缝。

关键落点如下：

- [src-tauri/src/codex_runtime/mod.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/codex_runtime/mod.rs)
- [src-tauri/src/codex_runtime/protocol.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/codex_runtime/protocol.rs)
- [src-tauri/src/codex_runtime/tools.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/codex_runtime/tools.rs)
- [src-tauri/src/ai_agent_prepare.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/ai_agent_prepare.rs)
- [src-tauri/src/ai_agent_run.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/ai_agent_run.rs)
- [src-tauri/src/references_runtime.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/references_runtime.rs)
- [src/stores/ai.js](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src/stores/ai.js)

### 2.2 当前最大缺口

当前 AI 的骨架已经接近 Codex 风格 runtime，但距离“学术研究专家”还缺少五个决定性能力：

1. 没有一等公民的 `研究任务` 状态机。
2. 没有一等公民的 `证据链` 与 `来源可追溯`。
3. artifact 类型过少，仍偏“文本建议”，不够“研究工作对象”。
4. 验证闭环还没有成为 runtime 硬约束。
5. 当前 AI 的很多入口仍然是 provider / model / prompt 驱动，而不是任务 / 证据 / 工件驱动。

换句话说，系统已经像一个 agent，但还不像一个研究专家。

---

## 3. 成功标准

本计划执行完成后，ScribeFlow AI 应达到以下标准。

### 3.1 用户层标准

- 用户可以发起明确的研究任务，而不是只能发一条 prompt。
- AI 的每个核心结论都能回溯到文档、PDF、引用条目、笔记或项目文件。
- AI 输出不只是一段文本，还能是 citation 建议、related work 草纲、参考文献修复、编译修复、证据包等可执行工件。
- AI 在修改论文、Markdown、LaTeX 或 bibliography 前，会显式说明依据与影响范围。
- AI 不能在未验证关键结果的情况下宣称“完成”。

### 3.2 架构层标准

- runtime 权威继续保留在 Rust。
- 前端只负责渲染、交互和可读的派生状态。
- 研究任务、证据链、artifact、验证结果必须有稳定 schema。
- 研究上下文检索与引用决策逻辑不能散落在组件或 store 中。

### 3.3 产品边界标准

- 不把产品做成通用 PKM。
- 不把 AI 面板做成聊天产品。
- 不为“看起来更像 Codex”而牺牲研究工作流。
- 不增加与当前研究工作台无关的新产品表面。

---

## 4. 总体策略

采用四条并行但有主次的改造线：

1. `任务化`
   把一次 AI 使用从“发 prompt”改造成“执行研究任务”。
2. `证据化`
   把一次 AI 输出从“生成文本”改造成“基于证据的研究结论或建议”。
3. `工件化`
   把一次 AI 结果从“消息内容”改造成“可应用、可审查、可回滚的研究工件”。
4. `验证化`
   把一次 AI 完成从“模型说完成”改造成“验证结果允许完成”。

---

## 5. 要添加的能力

以下内容应明确视为“新增能力”，而不是零碎优化。

### 5.1 新增研究任务层

新增一层位于 `thread / turn` 之上的 `research task` 抽象。

任务应至少包含：

- `taskId`
- `kind`
- `title`
- `goal`
- `successCriteria`
- `status`
- `phase`
- `workspacePath`
- `activeDocumentPaths`
- `referenceIds`
- `evidenceIds`
- `artifactIds`
- `verificationSummary`
- `blockedReason`
- `resumeHint`

建议的任务类型：

- `summarize-paper`
- `find-supporting-references`
- `draft-related-work`
- `revise-with-citations`
- `repair-bibliography`
- `fix-latex-compile`
- `extract-claims-and-evidence`
- `build-reading-note`
- `compare-papers`

建议新增模块：

- `src-tauri/src/research_task_runtime.rs`
- `src-tauri/src/research_task_protocol.rs`
- `src-tauri/src/research_task_storage.rs`
- `src/domains/ai/researchTaskViewModel.js`

任务层的作用：

- 为 AI 提供稳定目标
- 让用户看到当前到底在完成什么任务
- 支持中断恢复与跨 turn 连续工作
- 为验证与验收提供明确目标

### 5.2 新增证据链与研究上下文图

新增 `evidence bundle` 与 `research context graph`。

最小证据单元应支持：

- 文档选区
- PDF 页码或段落
- reference record
- citation key
- 笔记片段
- workspace 文件内容
- 编译日志片段
- 用户明确输入

每个 AI 结论或 artifact 都应能关联：

- `sourceType`
- `sourcePath`
- `sourceRange`
- `referenceId`
- `citationKey`
- `confidence`
- `whyRelevant`

建议新增模块：

- `src-tauri/src/research_evidence_runtime.rs`
- `src-tauri/src/research_context_graph.rs`
- `src/services/documentIntelligence/workspaceGraph.js` 的 AI 侧接线增强

这一步是让系统从“会生成”变成“会举证”的关键。

### 5.3 新增研究专用 artifact 类型

当前 artifact 主要是 `doc_patch` 与 `note_draft`，不足以覆盖学术研究主路径。

应新增以下 artifact：

- `citation_insert`
  给出推荐插入位置、引用条目、插入理由、潜在歧义。
- `reference_patch`
  修复 BibTeX / CSL 条目中的字段缺失、重复或格式问题。
- `related_work_outline`
  产出 related work 小节的结构草图与证据映射。
- `claim_evidence_map`
  把当前段落中的 claim 和 supporting references 对齐。
- `reading_note_bundle`
  从一篇论文生成结构化阅读笔记、核心贡献、限制、可引用句段。
- `compile_fix`
  指向具体 LaTeX / bibliography / preview 问题的修复建议。
- `evidence_bundle`
  记录一次回答所依赖的全部证据对象。
- `comparison_table`
  对多篇论文给出可导出的对比工件。

建议新增模块：

- `src-tauri/src/ai_artifact_runtime.rs` 扩展
- `src-tauri/src/ai_agent_run.rs` 中的 artifact normalization 扩展
- 前端 artifact 渲染组件，如 `src/components/ai/*`

### 5.4 新增研究验证器

新增一层 `research verification runtime`，使验证成为 AI 的默认后置步骤。

研究任务不同，验证也不同：

- 引用类任务：检查 citation key 是否存在、引用样式是否匹配、bibliography 是否可导出。
- 写作类任务：检查 patch 是否仍适用于当前文档、证据是否仍有效、是否引入裸断言。
- 编译类任务：检查 `latexmk` 或等价链路是否恢复成功，日志中错误是否消失。
- 文献类任务：检查条目是否重复、字段是否缺失、PDF / fulltext path 是否可读。

建议新增模块：

- `src-tauri/src/research_verification_runtime.rs`
- `src-tauri/src/research_verification_protocol.rs`
- `src-tauri/src/research_verification_checks/*`

### 5.5 新增研究评测集

新增固定回归任务集，而不是只依赖主观试用。

至少覆盖以下场景：

- 从当前选区生成摘要并附带证据链
- 基于选区查找 supporting references
- 为段落插入 citation 并更新 bibliography
- 修复一个 bibliography 冲突或条目缺失
- 修复一次可复现 LaTeX 编译失败
- 生成一份结构化 reading note
- 生成 related work 草纲并标注证据来源

建议新增：

- `docs/AI_RESEARCH_EVALS.md`
- `fixtures/ai-research-evals/*`
- 对应的 Rust / JS 测试夹具

---

## 6. 要修改的能力

以下内容不是新增模块，而是现有能力的职责重构或行为升级。

### 6.1 把 AI 准备阶段从“prompt 拼装器”改成“任务准备器”

当前 [src-tauri/src/ai_agent_prepare.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/ai_agent_prepare.rs) 仍然偏向：

- 解析 prompt 里的 `@file` / `#tool`
- 选择 skill
- 注入上下文

这在 agent baseline 阶段成立，但对研究专家化不够。

应改为：

- 先解析用户意图属于哪个 `research task`
- 再决定需要哪些上下文和证据
- 再决定需要哪些 tools / skills / references
- 最后才生成 provider request

也就是说，prepare 的核心输出不应只是 provider-ready payload，而应是：

- `resolvedTask`
- `requiredEvidence`
- `selectedArtifacts`
- `verificationPlan`
- `providerPayload`

### 6.2 把 skill 体系从“工具包”升级为“研究能力包”

当前 skill catalog 与 Codex / Claude 风格兼容是对的，但研究场景下还需要更强的类型信息。

每个 skill 建议补充：

- 适用研究任务类型
- 所需证据类型
- 输出 artifact 类型
- 验证要求
- 风险提醒

这样 skill 不只是“prompt 附件”，而是研究工作能力的声明。

涉及模块：

- [src-tauri/src/ai_skill_catalog.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/ai_skill_catalog.rs)
- [src-tauri/src/ai_skill_text.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/ai_skill_text.rs)
- settings 中的 skill 管理入口

### 6.3 把 references runtime 从“独立文献模块”接成 AI 的一等能力

当前 references runtime 已经存在，但与 AI 的整合仍不够深。

应把以下能力直接暴露给 AI runtime：

- 根据选区检索候选 references
- 根据 citation key 或 title 查重与补全
- 把 paper / reference 转成可引用证据对象
- 输出 cite-ready 片段与插入建议
- 在 bibliography 变更后触发验证

涉及模块：

- [src-tauri/src/references_runtime.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/references_runtime.rs)
- [src-tauri/src/references_backend.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/references_backend.rs)
- [src-tauri/src/references_import.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/references_import.rs)
- [src-tauri/src/references_citation.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/references_citation.rs)

### 6.4 把 session rail 从“运行会话列表”升级为“任务轨道”

当前 [src-tauri/src/ai_runtime_session_rail.rs](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src-tauri/src/ai_runtime_session_rail.rs) 的核心还是 session 维度。

应修改为：

- 默认展示 `任务标题`
- 其次展示 `当前阶段`
- 再展示 `阻塞原因 / 待审批 / 待验证`
- 允许从同一任务进入历史 turn

这会让 UI 的主心智从“聊天会话”转为“研究任务”。

### 6.5 把 AI store 从厚协调层继续瘦身

当前 [src/stores/ai.js](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src/stores/ai.js) 仍然承载大量状态归一化和运行时协调逻辑。

后续应继续降权：

- 把 runtime 真相留在 Rust
- 把研究任务 / 证据 / 验证的归一化放在 Rust
- 前端 store 只消费稳定 payload 与本地 UI 状态

这符合项目的 Rust-first 迁移原则。

### 6.6 把 Settings 的 AI 入口从 provider-first 调整为 workspace-first

当前 [src/components/settings/SettingsAi.vue](/Users/math173sr/Documents/GitHub项目/ScribeFlow/src/components/settings/SettingsAi.vue) 主要强调 provider/base URL/model/API key。

这对系统配置有必要，但不应继续作为 AI 体验的主入口。

建议改造方向：

- Settings 保留 provider 配置，但降低其心智权重。
- 在 AI 面板主路径中，优先呈现 workspace context、references、skills、任务与验证状态。
- 新增研究配置项，如默认 citation style、默认 evidence 策略、任务完成阈值。

---

## 7. 要删除或降权的能力

这里的“删除”包括真正删除和明确降权，不要求在同一阶段一次做完，但必须成为执行方向。

### 7.1 删除“聊天壳子心智”的默认路径

要删除的不是消息列表本身，而是“AI 主要是聊天”的产品暗示。

具体包括：

- 继续强化纯聊天式默认空态
- 继续围绕 prompt 文案微调而不是任务结构优化
- 把多轮消息当作主要产物，而不是把 artifact 和验证结果当主要产物

### 7.2 删除 provider-first 的主体验地位

provider 设置应保留，但不应主导主体验。

要降权的内容：

- 在主交互中反复强调 provider / model 选择
- 把模型切换当作主要问题解决方式
- 让用户把“挑模型”而不是“给任务和证据”当成主要操作

### 7.3 删除只有文本、没有证据的高风险输出默认通过

必须删除以下隐性默认：

- 未附证据的 related work 段落直接视为可用
- 未关联 citation key 的引用建议直接视为可用
- 未经过当前文档版本检查的 patch 直接视为可应用
- 未经编译验证的 LaTeX 修复被标记为完成

### 7.4 删除前端侧长期桥接真相

应逐步删除或降权以下形态：

- 前端自己维护研究任务真相
- 前端自己解释 approval / verification 的最终语义
- 前端自己拼装关键 artifact schema

这些应继续回收进 Rust runtime。

### 7.5 删除与学术研究目标无关的扩张方向

在本路线内明确不做：

- 通用 PKM 功能扩张
- 通用聊天产品化
- 与研究写作工作流无关的 agent “炫技”
- 为了兼容过多外部 agent 生态而牺牲 ScribeFlow 自身研究心智

---

## 8. 目标架构

目标架构应收敛为以下分层。

### 8.1 Rust runtime 层

Rust 持有：

- research task runtime
- codex runtime thread / turn / approval / tool orchestration
- evidence graph
- artifact normalization
- research verification
- reference-aware retrieval
- persistence

建议模块图：

- `src-tauri/src/codex_runtime/*`
- `src-tauri/src/research_task_*`
- `src-tauri/src/research_evidence_*`
- `src-tauri/src/research_verification_*`
- `src-tauri/src/references_*`

### 8.2 前端渲染层

前端负责：

- 任务列表与任务详情渲染
- evidence bundle 可视化
- artifact 预览与应用控件
- verification 状态显示
- 最小本地输入与交互编排

不负责：

- 任务语义真相
- approval 语义真相
- artifact schema 真相
- verification 判定真相

### 8.3 AI 能力心智模型

用户面对的主心智应从：

- session
- prompt
- provider

调整为：

- task
- evidence
- artifact
- verification

---

## 9. 分阶段执行计划

### Phase A：任务化改造

目标：建立 `research task` 一等公民。

主要工作：

- 定义 research task schema
- 建立 task 创建、更新、恢复、完成、失败协议
- 在 UI 上引入任务视图
- 将现有 session 与 turn 绑定到 task

涉及文件：

- 新增 `src-tauri/src/research_task_protocol.rs`
- 新增 `src-tauri/src/research_task_runtime.rs`
- 新增 `src-tauri/src/research_task_storage.rs`
- 修改 `src-tauri/src/ai_agent_prepare.rs`
- 修改 `src-tauri/src/ai_runtime_session_rail.rs`
- 修改 `src/stores/ai.js`

验收：

- 可以创建、恢复、完成一个研究任务
- 同一任务可跨多个 turn 继续执行
- session rail 默认按任务表达，而不是按聊天表达

### Phase B：证据化改造

目标：让 AI 输出具备显式证据链。

主要工作：

- 建立 evidence object schema
- 把 PDF、reference、文档选区、编译日志等映射为 evidence
- 把 artifact 与结论绑定到 evidence bundle

涉及文件：

- 新增 `src-tauri/src/research_evidence_runtime.rs`
- 新增 `src-tauri/src/research_context_graph.rs`
- 修改 `src-tauri/src/ai_agent_run.rs`
- 修改 `src-tauri/src/references_runtime.rs`

验收：

- 研究类输出都能查看 evidence bundle
- citation 建议能显示来源 reference 与相关段落
- 无证据输出默认不能标记为高置信结果

### Phase C：工件化改造

目标：让 AI 输出成为研究工作对象。

主要工作：

- 扩展 artifact 类型
- 为 artifact 加入 apply、dismiss、verify、rollback 语义
- 改造 artifact 渲染 UI

涉及文件：

- 修改 `src-tauri/src/ai_artifact_runtime.rs`
- 修改 `src-tauri/src/ai_agent_run.rs`
- 新增前端 artifact 组件

验收：

- 至少支持 `citation_insert`、`reference_patch`、`related_work_outline`、`evidence_bundle`
- artifact 可单独审查和应用
- artifact 与 task / evidence 关联稳定

### Phase D：验证化改造

目标：让“完成”变成一个可验证结论。

主要工作：

- 建立 research verification runtime
- 针对引用、bibliography、编译、patch 应用建立检查器
- UI 上显示验证摘要与阻塞原因

涉及文件：

- 新增 `src-tauri/src/research_verification_runtime.rs`
- 新增 `src-tauri/src/research_verification_checks/*`
- 修改 `src-tauri/src/codex_runtime/providers.rs`

验收：

- AI 在关键任务完成前自动跑对应验证
- 未通过验证时任务状态为 blocked 或 failed，而不是 completed
- 用户能看到失败原因与下一步建议

### Phase E：研究专家体验收口

目标：把交互从 agent runtime 收束为研究工作台体验。

主要工作：

- 调整 AI 面板默认空态与主路径
- 降低 provider-first 暴露
- 强化 task / evidence / artifact / verification 四层 UI
- 建立回归评测集

涉及文件：

- 修改 AI 面板相关组件
- 修改 `src/components/settings/SettingsAi.vue`
- 新增 `docs/AI_RESEARCH_EVALS.md`

验收：

- 用户打开 AI 面板时，主路径是研究任务而不是单纯聊天
- 至少 5 条研究 eval 路径可重复执行
- 面板能清晰表达“当前任务、使用证据、产出工件、验证状态”

---

## 10. 建议的数据与协议新增

至少新增以下 schema。

### 10.1 ResearchTask

- `id`
- `kind`
- `title`
- `goal`
- `status`
- `phase`
- `successCriteria`
- `threadId`
- `latestTurnId`
- `artifactIds`
- `evidenceIds`
- `verification`
- `blockedReason`
- `resumeHint`
- `createdAt`
- `updatedAt`

### 10.2 EvidenceRecord

- `id`
- `type`
- `label`
- `sourcePath`
- `sourceRange`
- `referenceId`
- `citationKey`
- `excerpt`
- `confidence`
- `whyRelevant`
- `createdAt`

### 10.3 VerificationRecord

- `id`
- `taskId`
- `kind`
- `status`
- `summary`
- `details`
- `blocking`
- `createdAt`

### 10.4 Artifact 扩展字段

所有 artifact 统一补充：

- `taskId`
- `evidenceIds`
- `verificationRequired`
- `verificationStatus`
- `riskLevel`

---

## 11. UX 改造方向

### 11.1 AI 面板默认视图

默认应显示：

- 当前任务
- 任务阶段
- 关键证据
- 当前 artifact
- 当前验证状态

而不是默认显示：

- provider 信息
- 一串松散消息
- 类聊天空态

### 11.2 任务详情视图

任务详情页或任务内面板至少应有四个区块：

- `Task`
- `Evidence`
- `Artifacts`
- `Verification`

### 11.3 Artifact 交互

每个 artifact 应明确支持：

- 为什么生成
- 基于哪些证据
- 风险是什么
- 如何应用
- 应用后如何验证

### 11.4 验证反馈

验证失败不能只显示 toast，应有：

- 失败摘要
- 失败详情
- 失败来源
- 下一步建议

---

## 12. 验证与回归计划

本计划落地后，每个 phase 至少应运行：

- `npm run lint`
- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

额外验收：

- 至少一条真实 Markdown 研究路径
- 至少一条真实 LaTeX 编译路径
- 至少一条 citation / bibliography 路径
- 至少一条 reference import / dedupe 路径

对 AI 研究专家化路线，应新增专项验收：

- 引用建议必须可回溯
- patch 必须与当前文档版本一致
- bibliography 修复必须有验证结果
- 编译修复必须重新编译通过
- related work 结果必须附带 evidence bundle

---

## 13. 风险与约束

### 13.1 风险

- 把系统做得更像通用 agent，而不是更像研究专家。
- 把大量研究语义继续堆在前端。
- artifact 类型扩张过快，缺少统一协议。
- 证据链只停留在 UI 展示，没有真正影响模型与验证。
- 评测集缺失导致能力提升只靠体感。

### 13.2 约束

- 不改变桌面端作为唯一主产品的定位。
- 不破坏项目树优先与右侧研究上下文优先的产品边界。
- 不为了快速试验继续增加长期前端桥接真相。
- 不引入长期双权威。

---

## 14. 执行优先级

按投入产出比排序，推荐如下：

1. `P0`
   研究任务层
   证据链 schema
   验证 runtime
2. `P1`
   artifact 扩展
   references 与 AI 深度整合
   AI 面板任务化
3. `P2`
   eval 集
   workspace-first settings 调整
   研究专用 skill 元数据升级

如果资源有限，必须优先做 `P0`。  
没有 `P0`，后续任何“更聪明”的 AI 都仍然缺少专家工作所需的任务、证据与验证基础。

---

## 15. 最终判断

ScribeFlow 当前 AI 的正确方向不是继续增强“像 Codex”的通用代理感，而是沿着已经建立的 Rust-first runtime，把系统推进为“研究任务驱动、证据驱动、工件驱动、验证驱动”的学术研究专家。

对这个产品来说，最重要的不是让 AI 更会聊天，而是让它：

- 更会做研究任务
- 更会引用证据
- 更会产出研究工件
- 更会自证结果

这份计划的执行结果应是：

- 用户把 ScribeFlow AI 当作研究协作者使用
- 而不是把它当作一个放在侧栏里的通用模型入口

