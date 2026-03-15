# Task Plan: 全量项目审查与修复

## Goal
对 Altals 项目做一次从入口到关键路径的细致审查，并将本轮确认的高风险缺陷直接修复到代码中，最后用构建检查验证修复结果。

## Current Phase
Complete

## Phases
### Phase 1: Discovery & Audit
- [x] 理解用户意图与仓库范围
- [x] 建立记录文件并完成前后端全量审查
- [x] 按风险排序整理关键问题
- **Status:** complete

### Phase 2: Remediation Design
- [x] 确定安全边界收紧方案
- [x] 确定功能性缺陷的最小修复路径
- [x] 明确验证命令与交付标准
- **Status:** complete

### Phase 3: Implementation
- [x] 新增工作区命令/URL 安全校验模块
- [x] 修复 AI 路径解析、命令执行与 URL 抓取边界
- [x] 修复 `@` mention、评论建议定位、PTY 生命周期与内部清理逻辑
- **Status:** complete

### Phase 4: Verification & Delivery
- [x] 运行根前端 `npm run build`
- [x] 运行 Rust `cargo check --manifest-path src-tauri/Cargo.toml`
- [x] 运行 `web/` 下 `npm run build`
- [x] 更新审查与进度记录并准备向用户交付
- **Status:** complete

## Key Questions
1. 哪些问题会直接造成权限越界、错误编辑、进程泄漏或功能硬损坏？
2. 修复时如何收紧 AI 暴露面，同时避免打坏现有合法工作流？
3. 是否有足够的验证证据证明这轮修复至少在构建层面成立？

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 优先修复审查阶段确认的高风险缺陷 | 先把真实会出事故的问题压下去 |
| 对 AI `run_command` 采用“工作区内 + 非 shell 执行 + 明确拒绝高风险模式” | 同时解决越权执行与退出码误判问题 |
| 对 AI 文件路径校验采用规范化后的目录边界判断 | 避免 `startsWith` 前缀绕过 |
| `fetch_url` 只允许公共 HTTP(S) 地址并手动校验 redirect | 阻断 `localhost` / 内网 SSRF 路径 |
| 评论建议只在 comment anchor 范围内替换 | 避免全文件首个匹配导致误改 |
| PTY 保存 killer 并在退出时主动清理 session | 解决终端会话泄漏与 kill 无效问题 |
| 不对所有底层文件命令做一刀切的工作区封禁 | 现有产品流程合法依赖外部路径，需后续能力模型重构后再做更大收口 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `src-tauri/src/security.rs` 编译时报 `use of undeclared type OsStr` | 1 | 补充 `use std::ffi::OsStr;` 后重新 `cargo check` 通过 |

## Notes
- 本轮已完成“审查 + 修复 + 构建验证”闭环。
- 仍有既存非阻断问题：根前端产物包体很大，且仓库缺少自动化测试。
