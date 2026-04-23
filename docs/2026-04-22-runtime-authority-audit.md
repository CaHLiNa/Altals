# Runtime Authority 审计

## Workspace Authority

- Rust owns: persisted preferences、lifecycle state、normalized defaults、recent workspace 去重与裁剪、打开工作区后的 `lastWorkspace` / `recentWorkspaces` 更新。
- Frontend owns: DOM apply、transient settings panel state、workspace picker / setup wizard UI、optimistic patch 与失败回滚。
- To delete: browser preview write path、duplicate local normalize helpers、前端 recents mutation 规则。

## 当前读写链路

调查命令：

```bash
rg -n "loadWorkspacePreferences|saveWorkspacePreferences|loadWorkspaceLifecycleState|saveWorkspaceLifecycleState" src
```

当前结论：

- `src/stores/workspace.js` 调用 workspace preferences / lifecycle bridge，并负责 optimistic state。
- `src/services/workspacePreferences.js` 调用 `workspace_preferences_load` / `workspace_preferences_save`，同时保留 DOM 字体与 theme apply helpers。
- `src/services/workspaceRecents.js` 调用 `workspace_lifecycle_load` / `workspace_lifecycle_save`，迁移后还会调用 Rust 的 workspace-opened mutation command。
- legacy `localStorage` snapshot 只作为一次性 migration input，不再作为桌面端权威。

## Document Workflow Authority

调查命令：

```bash
rg -n "resolvedWorkflowUiStates|previewBindings|workspacePreviewRequests|workspacePreviewVisibility" src/stores/documentWorkflow.js src/domains/document src/services/documentWorkflow src-tauri/src
```

### Session persistence

- Rust owns: `document-workflow-state.json` schema、preview prefs、session、workspace preview visibility/request、LaTeX preview state 的 normalize 与落盘。
- Frontend owns: hydrate / save 调度、当前窗口内 optimistic cache。
- To delete: service 层对 Rust 返回值再次合并默认 state 的同级 fallback。

### Preview binding

- Rust owns: preview binding schema、`previewPath` 去重、source path / pane id / preview kind normalize。
- Frontend owns: 用户关闭 preview、打开 preview 后把 Rust plan 应用到 editor panes。
- To delete: store 内长期维护的 binding normalize 规则。

### UI state resolve

- Rust owns: Markdown / LaTeX / Python workflow UI state resolve 和 action availability 输入语义。
- Frontend owns: UI state cache、inflight 去重、组件渲染。
- To delete: action module 与 UI state resolve 混放造成的职责混合。

### Build / reveal action availability

- Rust owns: `document_workflow_action_resolve` 对 primary / reveal / open-output / workspace preview action 的产品语义。
- Frontend owns: 执行对应 UI intent、触发 compile、打开系统路径。
- To delete: 前端 store 中直接推导 action availability 的新增路径。

## Legacy Inventory

调查命令：

```bash
rg -n "legacy_|legacy|preserveOpenLegacy|allow_legacy|hasDesktopInvoke" src src-tauri docs
```

### migration-only

- `src-tauri/src/workspace_preferences.rs` 的 `legacy_preferences`：只用于把旧 `localStorage` 偏好迁入 Rust persisted preferences。
- `src-tauri/src/workspace_lifecycle.rs` 的 `legacy_state`：只用于把旧工作区 lifecycle 快照迁入 Rust persisted lifecycle。
- `src-tauri/src/document_workflow_session.rs` 的 `legacy_state`：只用于把旧 document workflow session 快照迁入 `document-workflow-state.json`。

### fallback-only

- `src/services/workspaceRecents.js` 的 browser preview lifecycle fallback：只服务非桌面 demo / browser preview，不再代表桌面 authority。
- `src/services/documentWorkflow/sessionStateBridge.js` 的 browser preview state fallback：只服务 browser preview，本地桌面路径统一走 Rust command。
- `src/services/editorPersistence.js` 的 browser preview fallback：只服务非桌面 restore / recent files 演示。

### temporary compat

- `src-tauri/src/editor_session_runtime.rs` 的 `legacyPreviewPaths`：仅用于恢复旧 `preview:` tab 时过滤脏状态，并在 save/load 间保留必要只读兼容。
- `src-tauri/src/document_workspace_preview_state.rs` 的 `legacy-preview-tab` 分支：仅用于已存在的 `preview:` tab 以只读方式展示 Markdown preview，不再参与主 workflow authority。
- `src/domains/editor/*` 与 `src/services/editorPersistence.js` 中围绕 `legacyPreviewPaths` 的 restore / persist glue：仅为旧会话恢复保留。

### stale and removable

- `document workflow` 中的 `allowLegacyPaneResult` / `previewDelivery=legacy-pane` 主路径切换逻辑：已由 Task 3 删除，新的 runtime 不再主动走 legacy preview pane。
- `document workflow` reconcile 输出中的 `preserveOpenLegacy` / `legacyPreviewPath` / `legacyPreviewPaneId` 主路径字段：已由 Task 3 删除，旧 preview tab 退回只读兼容层。

## Legacy Exit Conditions

| Legacy Path | Current Purpose | Delete When | Owner |
| --- | --- | --- | --- |
| browser preview lifecycle fallback | non-desktop demo / browser preview 演示 | desktop lifecycle path 持续稳定且 browser preview 不再需要写路径 | workspace runtime |
| browser preview document workflow fallback | non-desktop Markdown / workflow 演示 | desktop document workflow smoke test 稳定且 browser preview 不再承载 workflow 演示 | document workflow |
| editor session `legacyPreviewPaths` | 恢复历史 `preview:` tab 时避免脏状态并保留只读会话 | 历史 preview tab 恢复路径完成迁移验证，且新版本不再保存 legacy preview tab | editor session runtime |
| `legacy-preview-tab` read-only resolve | 打开旧 `preview:` tab 时仍可只读查看 Markdown preview | editor session 不再恢复 `preview:` tab，或确认历史会话可安全丢弃该类 tab | document workspace preview |
| workspace preferences localStorage migration | 首次启动迁移旧偏好快照 | 发布周期确认旧偏好快照已完成迁移且不再需要读取历史 key | workspace preferences |
| workspace lifecycle localStorage migration | 首次启动迁移旧 recent/open lifecycle 快照 | 发布周期确认旧 lifecycle key 已完成迁移且不再需要读取历史 key | workspace lifecycle |
