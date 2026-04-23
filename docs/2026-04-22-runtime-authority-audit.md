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
