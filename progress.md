# Progress

## 2026-03-19

- 初始化本轮修复的 `task_plan.md`、`findings.md`、`progress.md`
- 已读取用户问题清单，进入代码定位阶段
- 已完成首轮代码勘察：确认自动保存缺少脏状态/关闭确认，版本历史缺少 git 初始化，`@` 文件搜索缺少排序与上下文增强，LaTeX 中文路径仍需继续定位
- 已完成 4 项修复实现并通过 `npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`
- 已继续修复版本历史回归问题：定位到 `git2` 在部分工作区的本地历史链路上不稳定，导致历史列表被吞成空数组，且首次初始化可能报 `invalid path`
- 已将版本历史依赖的本地 `git init / add / status / commit / log / show` 切到系统 `git` CLI 路径，并重新通过 `npm run build`、`cargo check --manifest-path src-tauri/Cargo.toml`
