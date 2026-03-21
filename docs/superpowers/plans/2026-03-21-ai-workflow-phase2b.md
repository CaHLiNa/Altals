# AI Workflow Phase 2B Implementation Plan

状态：Completed on 2026-03-21

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前文件级的 TeX / Typst compile diagnose/fix 任务迁入现有 AI workflow runtime。

**Architecture:** 继续复用 `src/services/ai/workflowRuns/*`、`prepareTexTypFixTask()` 与现有 compile diagnosis artifact。只迁移带明确文件路径的 diagnose/fix 入口；无文件上下文的 `Compile assistant` 暂时保留为 prefill。

**Tech Stack:** Vue 3、Pinia、AI SDK Chat、Node `node:test`

---

## File Map

### Modify

- `src/services/ai/workflowRuns/templates.js`
  责任：新增 TeX / Typst diagnose/fix workflow templates。
- `src/services/ai/workflowRuns/executor.js`
  责任：新增 compile diagnose narrative、artifact 与 patch approval 边界。
- `src/services/ai/taskCatalog.js`
  责任：把 `createTexTypDiagnoseTask()` / `createTexTypFixTask()` 改成 workflow descriptor。
- `tests/aiWorkflowPlanner.test.mjs`
  责任：验证模板、入口映射与 starter 语义。
- `tests/aiWorkflowState.test.mjs`
  责任：验证 compile diagnose/fix workflow 的自动完成与审批边界。

## Notes

- `compile.assistant` 保留 `prefill`，直到 Phase 3 再考虑无上下文后台/恢复语义。
- `prepareTexTypFixTask()` 继续负责 compile diagnosis 预热，不下沉到 workflow planner。
- 实际落地后，`diagnose.tex-typ` 自动完成并产出 `compile_diagnosis`，`fix.tex-typ` 停在 `apply_patch`。
