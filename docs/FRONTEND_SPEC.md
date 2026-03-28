# Frontend Spec

Altals 的前端现在只服务一个目标：把 Markdown、LaTeX、Typst 的本地写作流程做成清晰、稳定、可恢复的桌面工作台。

## Shell Layout

- 启动页：打开本地目录或克隆仓库
- 左侧栏：项目文件树
- 中间区：文本编辑、Markdown 预览、Typst 原生预览、PDF 查看、不支持文件提示
- 右侧栏：大纲、文档运行状态
- 底部与设置：围绕字体、主题、预览、文档工具检查

## Supported Document Routes

- Markdown 源文件
- LaTeX 源文件
- Typst 源文件
- Markdown 预览
- Typst 原生预览
- PDF 查看
- 新标签占位页
- 不支持文件兜底页

## Component Responsibility

- 页面与壳层组件负责组装布局和入口切换
- 文档组件负责编辑、预览、运行反馈
- shared 组件负责复用控件与基础交互
- 运行决策放在 `src/domains/document/*`
- 文件、编译、持久化等副作用放在 `src/services/*`

## UI Rules

- 优先复用 shared primitives，不要在业务组件里重复造按钮、输入框、状态条
- 样式值优先走现有 tokens 与 CSS 变量
- 新界面必须覆盖空状态、错误态、加载态、不可用态
- 原生表单控件默认只允许出现在 shared primitives 内；确实需要直接接第三方运行时的场景，要像 PDF viewer 一样明确收口

## Current Important Files

- `src/App.vue`
- `src/components/editor/*`
- `src/components/sidebar/*`
- `src/components/settings/*`
- `src/domains/document/*`
- `src/services/documentWorkflow/*`
- `scripts/frontendBaselineTooling.mjs`

## Verification Baseline

- `npm run format:check`
- `npm run lint`
- `node --test tests/*.test.mjs`
- `npm run build`
