# Codex CLI 运行时重构

## 目标

把 ScribeFlow 的 AI 执行权威从“应用内维护的 provider / model runtime”收敛到“系统 `codex cli`”，让桌面应用只承担：

- 上下文装配
- 研究工作流提示词构建
- skill 管理
- 文档 / 引用 / artifact 集成
- 面板状态与结果呈现

## 重构结论

本次重构采用以下边界：

- 系统 `codex cli` 是唯一执行引擎
- ScribeFlow 设置页不再维护 provider catalog / API key / model list
- ScribeFlow 只维护 Codex launcher defaults
- `~/.config/agents/skills` 是电脑共享全局 skills
- `~/.scribeflow/skills` 是 ScribeFlow 专属 skills

## 配置模型

`ai.json` 现在保留两层信息：

1. `researchDefaults`
   - 默认引用样式
   - evidence strategy
   - completion threshold

2. `codexCli`
   - `commandPath`
   - `model`
   - `profile`
   - `sandboxMode`
   - `webSearch`
   - `useAsciiWorkspaceAlias`

同时新增：

- `runtimeBackend = "codex-cli"`

旧的 provider 配置仍被保留在配置结构里，目的是：

- 避免一次迁移直接破坏旧数据
- 给后续清理阶段留出删除窗口

但它们不再是设置页主入口，也不应继续扩张。

## 运行时改动

### 1. 准备阶段

`ai_agent_prepare_current_config` 现在会优先读取 `runtimeBackend`。

当值为 `codex-cli` 时：

- 构造一个伪 `providerState`
- `providerId` 固定为 `codex-cli`
- `config` 改为读取 `codexCli`
- 不再依赖 provider API key

### 2. 执行阶段

新增 `src-tauri/src/codex_cli.rs`，负责：

- 检测 `codex` 可执行命令
- 解析 Codex launcher config
- 通过 `codex exec --json` 运行任务
- 用 `--output-last-message` 收敛最终回复
- 管理运行中的 PID
- 提供中断能力

### 3. 非 ASCII 路径兼容

由于系统 `codex cli` 在非 ASCII 工作区路径下会出现 header / websocket 断流问题，本次实现加入了 ASCII alias 层：

- 真实工作区有非 ASCII 路径时
- 在 `~/.scribeflow/workspaces/<encoded>/codex-root` 创建安全别名
- 启动 Codex CLI 时使用该别名作为 `-C` 工作目录

这是本次切换里的关键兼容层，否则你的中文路径工作区无法稳定运行。

## 前端设置页

`SettingsAi.vue` 已从 provider 设置页改为 Codex launcher 设置页，保留：

- `Research defaults`
- `Codex runtime`

不再保留：

- provider 列表
- Base URL
- API key
- provider model catalog
- provider connection test

## 面板行为

AI 面板现在按 Codex runtime 语义展示：

- 模型显示优先取显式 `model`
- 否则回退到 `profile`
- 再回退到 “Using Codex defaults”

由于 `codex exec` 不提供之前那套应用内 approval / plan mode 语义，本次切换中：

- 保留原有会话外壳
- 但在 Codex CLI 模式下隐藏旧的 execution policy 切换按钮

## 已知限制

这次切换解决了执行引擎与设置页双权威的问题，但仍保留几个后续收尾点：

1. 旧 provider 后端代码仍在仓库中
2. 旧的 provider credential / catalog 命令仍可被调用，但不再是主路径
3. Codex CLI 运行结果当前以最终消息收敛为主，不复刻旧 runtime 的完整流式细粒度事件

## 下一步清理

后续建议按顺序继续：

1. 删除设置页与 store 中不再使用的 provider catalog / API key 逻辑
2. 评估是否彻底移除旧的 HTTP / SDK 执行路径
3. 如果需要更强交互能力，再评估接 `codex app-server` / `mcp-server`，而不是继续扩张自研 runtime
