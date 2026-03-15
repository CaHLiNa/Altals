# Progress Log

## Session: 2026-03-15

### Phase 1: Baseline & Mapping
- **Status:** complete
- Actions taken:
  - 读取 `using-superpowers`、`planning-with-files`、`brainstorming`、`writing-plans`、`verification-before-completion`
  - 扫描仓库结构、`package.json`、README 与 architecture 文档
  - 与用户确认采用激进清理策略，并把“每轮改完立即测试”设为硬约束
  - 生成 `docs/plans/2026-03-15-global-cleanup-design.md`
  - 生成 `docs/plans/2026-03-15-global-cleanup.md`
  - 建立前端主入口可达性扫描和 Tauri 命令注册/调用对照扫描
- Files created/modified:
  - `task_plan.md`
  - `findings.md`
  - `progress.md`
  - `docs/plans/2026-03-15-global-cleanup-design.md`
  - `docs/plans/2026-03-15-global-cleanup.md`

### Phase 2: Frontend Surface Cleanup
- **Status:** complete
- Actions taken:
  - 删除 6 个从 `src/main.js` 完全不可达的前端死文件
  - 移除旧 DOCX citation node / overlay 路径、旧 HTML preview、旧 PDF settings popover、旧 preview sync actions 和废弃 workspace protocol util
  - 运行首轮构建验证
- Files created/modified:
  - `src/components/editor/DocxCitationOverlays.vue` (deleted)
  - `src/components/editor/HtmlPreview.vue` (deleted)
  - `src/components/editor/PdfSettingsPopover.vue` (deleted)
  - `src/components/editor/PreviewSyncActions.vue` (deleted)
  - `src/editor/docxCitations.js` (deleted)
  - `src/utils/workspaceProtocol.js` (deleted)

### Phase 3: Store / Service / Editor Consolidation
- **Status:** complete
- Actions taken:
  - 删除无调用更新 stub、DOCX/OpenAlex 辅助死代码和断链 git wrapper
  - 收拢一批只在文件内使用的 helper，移除多余导出
  - 清理 `services` / `utils` / `stores` 中的无效 API 面
  - 持续在每轮后重跑前端构建与 Rust 编译检查
- Files created/modified:
  - `src/services/appUpdater.js`
  - `src/services/apiClient.js`
  - `src/services/chatModels.js`
  - `src/services/citationStyleRegistry.js`
  - `src/services/codeRunner.js`
  - `src/services/crossref.js`
  - `src/services/documentWorkflow/policy.js`
  - `src/services/documentWorkflow/reconcile.js`
  - `src/services/docxContext.js`
  - `src/services/git.js`
  - `src/services/openalex.js`
  - `src/services/refAi.js`
  - `src/services/telemetry.js`
  - `src/services/workspacePermissions.js`
  - `src/stores/links.js`
  - `src/utils/chatMarkdown.js`
  - `src/utils/errorMessages.js`
  - `src/utils/fileTypes.js`
  - `src/i18n/index.js`

### Phase 4: Rust / Tauri Boundary Cleanup
- **Status:** complete
- Actions taken:
  - 删除前端无调用的 Tauri commands
  - 清理命令删除后遗留的 LaTeX 状态字段与关联结构
  - 删除断链 git init / git diff Rust 命令
  - 更新 `generate_handler!` 注册表
- Files created/modified:
  - `src-tauri/src/git.rs`
  - `src-tauri/src/latex.rs`
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/typst_export.rs`

### Phase 5: Final Verification
- **Status:** complete
- Actions taken:
  - 复跑最后一轮 `npm run build`
  - 复跑最后一轮 `cargo check --manifest-path src-tauri/Cargo.toml`
  - 重新执行前端不可达文件扫描，结果为空
  - 重新执行 Tauri 未调用命令扫描，结果为空
  - 更新记录文件并准备交付

## Test Results
| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 前端构建 Round 1 | `npm run build` | 删除前端死文件后仍可构建 | 通过 | 通过 |
| Rust 检查 Round 1 | `cargo check --manifest-path src-tauri/Cargo.toml` | 删除前端死文件后 Rust 仍可编译 | 通过 | 通过 |
| 前端构建 Round 2 | `npm run build` | 删除未调用 Tauri command 后仍可构建 | 通过 | 通过 |
| Rust 检查 Round 2 | `cargo check --manifest-path src-tauri/Cargo.toml` | 删除未调用 Tauri command 后仍可编译 | 通过 | 通过 |
| 前端构建 Round 3 | `npm run build` | 删除 services/utils 死代码后仍可构建 | 通过 | 通过 |
| Rust 检查 Round 3 | `cargo check --manifest-path src-tauri/Cargo.toml` | 删除 services/utils 死代码后仍可编译 | 通过 | 通过 |
| 前端构建 Round 4 | `npm run build` | 收拢内部 helper API 后仍可构建 | 通过 | 通过 |
| Rust 检查 Round 4 | `cargo check --manifest-path src-tauri/Cargo.toml` | 收拢内部 helper API 后仍可编译 | 通过 | 通过 |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 暂无 | - | - | - |

## Current State
- 本轮大清理已经完成一个安全收束点。
- 主入口不可达文件扫描为空。
- Tauri 已注册但前端未调用的命令扫描为空。
- 目前剩余更高价值但更高风险的工作，已经转向代码分块、动态导入整理和主链路抽象重构。
