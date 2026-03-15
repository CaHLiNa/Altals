# Findings & Decisions

## Requirements
- 用户先要求对整个项目做一次从头开始、细致的全面检查。
- 在审查结果给出后，用户进一步要求直接开始修复。
- 交付需要同时覆盖问题证据、修复结果和验证结果。

## Resolved Findings
| Finding | Fix Summary | Evidence |
|---------|-------------|----------|
| AI `run_command` 原本可直接落到整机级 shell | 新增 `run_workspace_command`，要求工作区内执行、禁止 shell 链式语法和高风险程序，并按真实退出码返回结果 | `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/fs_commands.rs`, `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/security.rs`, `/Users/math173sr/Documents/GitHub项目/Altals/src/services/chatTools.js` |
| AI 文件工具路径校验存在 `startsWith` 前缀绕过 | 将前端路径解析改为绝对路径规范化 + 目录边界判断 | `/Users/math173sr/Documents/GitHub项目/Altals/src/services/chatTools.js` |
| `fetch_url` fallback 可访问 `localhost` / 内网 | 新增公共 URL 校验并对 redirect 逐跳重新校验 | `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/security.rs`, `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/fs_commands.rs` |
| 聊天输入 `@` mention 触发逻辑被错误替换 | 将触发字符和检测逻辑恢复为真实 `@` 路径 | `/Users/math173sr/Documents/GitHub项目/Altals/src/components/shared/RichTextInput.vue` |
| 评论建议会按全文首个匹配替换，可能改错位置 | 改为只在 comment anchor 范围内查找并替换，找不到时提示 re-anchor | `/Users/math173sr/Documents/GitHub项目/Altals/src/stores/comments.js` |
| PTY kill 不会真正杀进程，退出后 session 也可能残留 | 保存 `killer`，新增 wait 线程清理 session，并发送退出事件 | `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/pty.rs` |
| `run_shell_command` 忽略退出码，失败会被当作成功 | 统一经过 `format_command_output`，非零退出码直接报错 | `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/fs_commands.rs` |
| 内部图片落盘/清理依赖 shell 命令 | 改为 `write_file_base64` 和显式 `delete_path` / `read_dir_shallow` | `/Users/math173sr/Documents/GitHub项目/Altals/src/services/rmdKnit.js`, `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/EditorPane.vue` |
| 环境探测命令默认在 `.` 执行，容易脱离工作区上下文 | 改为优先使用当前工作区路径，再回退到全局配置目录 | `/Users/math173sr/Documents/GitHub项目/Altals/src/stores/environment.js` |

## Verification Findings
- 根前端 `npm run build` 通过，仍有大量动态导入与大 chunk 告警。
- Rust `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
- `web/` 下 `npm run build` 通过。

## Remaining Known Risks
- 根前端打包产物依旧偏大，`dist/assets/index-CONXqqQ8.js` 和 `dist/assets/superdoc.es-Dplj1OpB.js` 仍在 3.6-3.8 MB 量级。
- 仓库仍缺少自动化测试，本轮只能用构建检查和定向代码验证兜底。
- 更底层的通用文件命令仍然是高权限能力；本轮已把 AI 暴露面的关键越界点封住，但如果要做更彻底的权限模型收口，需要额外梳理导入、克隆、外部文件打开等合法场景。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 先修复确认可复现的高风险问题，再保留结构性优化为后续工作 | 避免大改期间引入新的回归 |
| 对安全边界采用“前端路径约束 + 后端工作区命令/URL 校验”双层防护 | 既封住 AI 工具入口，也减少未来接入点分叉 |
| 保持现有工作流兼容，不把所有文件操作都硬封进工作区 | 导入、克隆、打开外部文件等流程需要额外产品级设计 |

## Resources
- `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/security.rs`
- `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/fs_commands.rs`
- `/Users/math173sr/Documents/GitHub项目/Altals/src-tauri/src/pty.rs`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/App.vue`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/services/chatTools.js`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/components/shared/RichTextInput.vue`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/stores/comments.js`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/services/rmdKnit.js`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/components/editor/EditorPane.vue`
- `/Users/math173sr/Documents/GitHub项目/Altals/src/stores/environment.js`
