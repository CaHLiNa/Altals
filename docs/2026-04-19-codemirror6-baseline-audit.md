# CodeMirror 6 基线体检（2026-04-19）

## 结论

当前文档编辑器已经回到 **CodeMirror 6 单路径**：

- 前端主编辑器入口是 `TextEditor.vue`
- `EditorTextWorkspaceSurface.vue` 直接承载 `TextEditor.vue`
- native editor 兼容层、surface registry、editor runtime store、Tauri native editor bridge 与相关 Rust crate 已移除

本轮基线体检确认：

- `npm run build` 通过
- `cargo check --manifest-path src-tauri/Cargo.toml` 通过
- `npm run lint` 无 error，仅有两个与本轮无关的旧 warning

## 已确认的单路径事实

### 1. 编辑器入口

- `EditorTextWorkspaceSurface.vue` 直接 `import('./TextEditor.vue')`
- 已不存在 `primaryTextSurfaceRegistry.js`
- 已不存在 `PRIMARY_TEXT_SURFACE_TARGETS`
- 已不存在 `editorRuntime.js`
- 已不存在 `NativePrimaryTextSurface.vue`

这说明当前不再是 “CodeMirror 6 / native primary” 双路径兼容，而是单一路径。

### 2. CodeMirror 6 核心能力仍在

`src/editor/setup.js` 中仍启用以下核心扩展：

- `lineNumbers()`
- `highlightActiveLineGutter()`
- `highlightActiveLine()`
- `history()`
- `foldGutter()`
- `drawSelection()`
- `dropCursor()`
- `indentOnInput()`
- `bracketMatching()`
- `closeBrackets()`
- `rectangularSelection()`
- `searchKeymap`

这意味着以下基础能力在代码层仍然存在：

- 行号
- 当前行高亮
- 选区绘制
- drop cursor
- 自动缩进
- 括号匹配
- 自动闭合括号
- 搜索快捷键
- 折叠 gutter

### 3. Markdown / LaTeX 侧编辑增强仍在

`TextEditor.vue` 仍接入了这些能力：

- `wikiLinksExtension`
- `citationsExtension`
- `latexCitationsExtension`
- `createMarkdownDraftSnippetSource`
- Markdown 表格插入与格式化
- Markdown preview forward sync
- LaTeX source reveal / forward sync
- 右键菜单与 citation palette

### 4. 大纲链已恢复到 CodeMirror 6 时代实现

`OutlinePanel.vue` 当前行为：

- Markdown：走 `services/markdown/outline.js`
- LaTeX：组件内本地解析 heading
- 定位：通过编辑器 view 的 offset 直接聚焦源码位置

## 本轮验证结果

### 通过

- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`

### 有 warning 但未阻塞

- `npm run lint`

当前 warning：

- `src/components/editor/PdfIframeSurface.vue`
  - `readWorkspaceTextFile` 未使用
  - `saveWorkspaceTextFile` 未使用

这两个 warning 与本轮 CodeMirror 6 回退无直接关系。

## 未完成的真实交互验证

本轮没有完成真实浏览器 / 桌面自动化交互回归，原因如下：

- 仓库内没有 `webapp-testing` 技能说明里提到的 `scripts/with_server.py`
- 本机 Python 环境没有安装 `playwright`
- 现有 `vite` dev server 监听在 `localhost:1420`，但当前自动化环境未配置现成浏览器测试链

因此本轮属于：

- **代码路径基线确认**
- **构建基线确认**
- **能力开关基线确认**

不属于：

- 鼠标、键盘、IME、右键菜单、preview sync 的真实交互验收

## 下一步建议

优先按以下顺序做真实交互回归：

1. Markdown 基础输入
   - 单击定位
   - 键盘输入
   - 回车
   - 退格
   - 自动闭合括号

2. 选区与菜单
   - 拖选
   - 双击选词
   - 右键菜单
   - citation palette

3. 联动能力
   - Markdown preview sync
   - LaTeX source reveal
   - Outline click reveal

4. 边界输入
   - 中文 IME
   - 大文件滚动
   - Markdown 表格编辑
   - LaTeX citation 编辑

## 当前判断

可以把当前状态视为：

- **结构上已回到 CodeMirror 6 单路径**
- **构建上稳定**
- **功能开关大体仍在**
- **还缺一次真实交互验收**
