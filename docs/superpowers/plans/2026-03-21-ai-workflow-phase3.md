# AI Workflow Phase 3 Implementation Plan

状态：Completed on 2026-03-21

**Goal:** 在不引入常驻代理的前提下，为现有 workflow runtime 增加有限后台执行、恢复入口和应用内通知。

**Architecture:** 继续复用 `src/stores/aiWorkflowRuns.js`、`src/components/ai/workflowUi.js`、workbench/chat 现有结构。Phase 3 不新增 Rust 队列、系统级后台守护或多 run 调度器。

**Tech Stack:** Vue 3、Pinia、AI SDK Chat、Node `node:test`

---

## File Map

### Modify

- `src/services/ai/workflowRuns/state.js`
  责任：给 run 增加 execution mode、heartbeat 和 resume hint 字段。
- `src/services/ai/workflowRuns/planner.js`
  责任：把 background-capable 元数据带进 workflow plan。
- `src/stores/aiWorkflowRuns.js`
  责任：支持 background run 列表、execution mode 切换、状态通知和 snapshot 回填。
- `src/components/ai/workflowUi.js`
  责任：把 background 相关字段暴露给 UI。
- `src/components/ai/AiWorkflowRunHeader.vue`
  责任：展示 background pill 和恢复提示。
- `src/components/ai/AiWorkflowCheckpointCard.vue`
  责任：让 `Continue later` 真正把 run 切到后台并持久化。
- `src/components/ai/AiWorkbenchHome.vue`
  责任：新增 background workflows 恢复区块。
- `src/components/ai/AiWorkbenchSurface.vue`
  责任：在 recent chats 中显示 workflow 状态与 background 提示。
- `src/components/chat/ChatSession.vue`
  责任：用户继续交互时把 run 切回 foreground。
- `tests/aiWorkflowRuns.test.mjs`
  责任：验证 background run 元数据回填、切换与恢复入口。
- `tests/leftSidebarPanels.test.mjs`
  责任：验证 workflow header 摘要结构扩展。

## Notes

- `Continue later` 不会继续推进 executor；它只是把当前 run 显式转成 background 并等待恢复。
- 通知只做应用内 toast，不做系统通知或持久后台守护。
- background workflows 仍绑定既有 chat session，而不是创建新的 run inbox 或守护进程。
