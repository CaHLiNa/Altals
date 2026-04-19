# ScribeFlow AI 研究评测集

日期：2026-04-19  
状态：启用中  
适用范围：桌面端 AI runtime、research task、evidence、artifact、verification

---

## 1. 评测目标

这组 eval 不用于评测“聊天自然度”，而用于评测 ScribeFlow AI 是否已经具备学术研究专家所需的任务闭环能力。

每条任务都要覆盖四个层面：

- `Task`：是否生成了明确的 research task
- `Evidence`：是否挂载了可追溯证据
- `Artifact`：是否产出了合适的研究工件
- `Verification`：是否在关键路径上给出可信验证

通过标准不是“模型回答得像不像”，而是“系统能否把研究任务走通”。

---

## 2. 执行原则

- 统一在真实 workspace 中执行，不使用脱离项目上下文的纯 prompt 对话。
- 每次评测都记录任务标题、artifact 类型、evidence 数量、verification verdict。
- 若评测涉及引用、bibliography 或 LaTeX，必须使用真实 reference library 与真实文档文件。
- 若某条评测因环境缺失无法执行，必须记录阻塞原因，不得直接视为通过。

---

## 3. 评测任务

### Eval 1：从当前选区生成 reading note

输入：

- 打开一个 Markdown 或 LaTeX 文档
- 选择一段论文内容或项目内阅读摘录
- 触发 `summarize-selection`

预期：

- 创建或绑定一个 `research task`
- 生成 evidence，至少包含当前文档和当前选区
- 产出 `reading_note_bundle` 或 `note_draft`
- 应用 artifact 后生成 verification record
- task 的 `verificationVerdict` 应更新为 `pass`、`block` 或 `fail`

人工验收：

- 右侧 AI 面板能看到 task 标题与 verification summary
- Artifact 卡片能看到 evidence 来源
- 打开的草稿文件真实存在

### Eval 2：为段落查找 supporting references

输入：

- 打开含有论断但缺少引用的段落
- 选中该段落
- 选择一个或多个候选 reference
- 触发 `find-supporting-references`

预期：

- evidence 中包含当前选区和 reference context
- 产出以下至少一种 artifact：
  - `citation_insert`
  - `reference_patch`
  - `evidence_bundle`
- 若返回 `citation_insert`，artifact 卡片应显示 citation key 与来源证据
- 若返回 `evidence_bundle`，artifact 应可作为 review-only 工件展示

人工验收：

- `Sources` 区域能看到 reference label、excerpt 或 citation key
- session rail 副标题包含 evidence 或 verification 信息

### Eval 3：插入 citation 并验证 bibliography

输入：

- 在 LaTeX 或 Markdown 文档中选中需要插入 citation 的句子
- 选中一个真实 reference
- 生成并应用 `citation_insert`

预期：

- 文档中实际写入 citation 文本
- 生成 verification record
- verification 至少检查：
  - citation 文本是否写入
  - citation key 是否可解析
  - reference 是否可 render
  - BibTeX 是否可导出

额外要求：

- 若目标文件为 `.tex` 或 `.latex`，还要继续检查 bibliography 写出与最小 LaTeX compile

人工验收：

- 验证记录显示在 verification summary 卡片中
- task 被更新为 `verification` phase

### Eval 4：修复 reference 条目并回写验证

输入：

- 在 reference library 中选择一个字段有缺失或错误的条目
- 触发 `find-supporting-references` 或其它可生成 `reference_patch` 的研究任务
- 应用 `reference_patch`

预期：

- reference library 中对应字段被真实更新
- verification 检查更新字段是否已落地
- verification 检查 citation render 与 BibTeX export

人工验收：

- 被修改的 reference 条目可重新渲染 citation
- task 的 `blockedReason` 与 `resumeHint` 会随验证结果变化

### Eval 5：生成 related work outline

输入：

- 提供当前写作段落或主题描述
- 选中一个或多个相关 reference
- 触发 `draft-related-work`

预期：

- 若可直接写回段落，则产出 `doc_patch`
- 若更适合规划结构，则产出 `related_work_outline`
- artifact 必须带 evidence preview

人工验收：

- `related_work_outline` 可作为草稿打开
- 卡片中能看到 outline 预览和证据来源

### Eval 6：LaTeX bibliography 工作流验证

输入：

- 使用 `.tex` 项目
- 应用 `citation_insert` 或 `reference_patch`

预期：

- `research_verification_run` 自动尝试写出 `references.bib`
- 自动执行一次最小 LaTeX compile
- 编译失败时 task verdict 至少为 `block` 或 `fail`

人工验收：

- verification details 中能看到 bibliography 写出结果和 compile 结果
- verification summary 卡片能反映阻塞状态

### Eval 7：跨 turn 持续任务

输入：

- 在同一 session 内连续完成两轮研究动作，例如先 `find-supporting-references`，再 `draft-related-work`

预期：

- 两轮动作绑定到同一个 `research task`
- task 的 `artifactIds`、`evidenceIds`、`verificationVerdict` 持续更新
- session rail 默认仍以任务标题表达，不退化为纯聊天标题

人工验收：

- 切换 session 后再切回，research task 仍能恢复
- verification summary 保留最近记录

### Eval 8：review-only evidence artifact

输入：

- 触发一次 `find-supporting-references`
- 模型不返回可直接应用的 patch，仅返回 supporting references 与证据整理

预期：

- 产出 `evidence_bundle`
- artifact 卡片显示为 review-only，不显示 apply 按钮
- 证据内容和来源可以直接审查

人工验收：

- 卡片 badge 显示 `Review only`
- 卡片正文包含 supporting references 或 evidence markdown

---

## 4. 建议验证命令

后端与运行时：

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

前端与桌面界面：

```bash
npm run lint
npm run build
```

若环境具备完整 AI 审查配置，可追加：

```bash
npm run agent:codex-postflight -- --plan docs/2026-04-19-ai-research-expert-plan.md
```

---

## 5. 结果记录模板

每次执行 eval 时，至少记录以下字段：

- `evalId`
- `workspace`
- `taskTitle`
- `artifactType`
- `evidenceCount`
- `verificationVerdict`
- `verificationSummary`
- `status`
- `blockingReason`
- `notes`

建议记录成表格或 issue checklist，便于回归对比。

---

## 6. 当前通过标准

本评测集的最低通过线如下：

- 8 条任务中至少 6 条能在本地环境完整执行
- 所有涉及 artifact application 的路径都能生成 verification record
- 所有涉及引用与 bibliography 的路径都能给出可审查的验证结论
- UI 中能清晰看到 task、evidence、artifact、verification 四层信息

若低于这条线，说明 ScribeFlow AI 仍然更像“有研究外观的 agent”，而不是“研究专家工作代理”。
