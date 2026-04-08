# Data Model

Altals 的当前数据模型已经收口到文档工作台必需的几类状态。

## Primary Runtime State

- Workspace: 当前工作区路径、最近项目、窗口级偏好
- Files: 文件树、文件内容缓存、加载状态
- Editor: pane tree、活动标签、最近文件、脏文件集合
- Document Workflow: 编译状态、预览目标、运行结果
- Preview State: Markdown、Typst 的派生展示状态

## Storage Locations

- `localStorage`: UI 偏好、侧边栏状态、缩放、主题、字体等
- 工作区 `.shoulders/`: 编辑器布局、最近预览、恢复所需状态
- 项目目录: 文档源文件、生成产物、Git 历史

## Data Rules

- 源文档永远是主数据，预览和编译产物都是派生结果
- 编辑器恢复只保留当前工作台认识的标签类型
- 编译输出与源文件分离存放，不反向覆盖源内容
- 不支持文件只展示兜底信息，不进入文档编辑链路

## Migration Notes

- 旧工作台表面的本地缓存会在加载时被归一化到当前文档工作台
- 旧虚拟标签不会再重新持久化回新的编辑器状态
