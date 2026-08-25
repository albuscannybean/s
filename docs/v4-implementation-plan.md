# V4 实施基线与完成说明

## V3 问题审计

1. 边线通过 `getBoundingClientRect()` 读取 DOM，再除以 zoom 推算坐标；缩放、动画和窗口变化时节点与边可能错位。
2. 每种结构由独立 DOM renderer 布局，没有共享的 Scene Geometry Model。
3. 永久右侧 Inspector 占用核心画布，简单操作也需要进入表单。
4. Navigator 是平面列表，Breadcrumb 不能精确表达 Knowledge / Slot / Structure 递归路径。
5. Structure Instance 只能 Binding，不能保存局部节点/边增删与语义属性覆盖。
6. Mod‑12 renderer 硬编码 A/B，规则只能编辑 JSON AST。
7. Minimap 是占位框；导航历史、对象历史与 Undo/Redo 未分层。
8. JSON 是唯一结构交换格式，缺少可读、可诊断的领域语言。

## V4 信息架构

```text
Application Shell
├── Top bar
│   ├── Back / Forward
│   ├── Recursive Breadcrumb
│   ├── Browse / Edit / Connect
│   └── Command / Insert / Export
├── Navigator
│   ├── Outline
│   ├── Knowledge
│   ├── Library
│   └── Search
├── Document Workspace
│   ├── Notes
│   └── Structure Scene
│       ├── Edge Layer
│       ├── Node Layer
│       ├── Token Layer
│       ├── Context Toolbar
│       └── Minimap
└── Ephemeral UI
    ├── Context Menu
    ├── Floating Properties Panel
    ├── Command Palette
    └── Builder / Import Sheets
```

## 状态分层

- Semantic：Knowledge、Relation、Binding、Slot/Edge semantics、Notes、Structure constraints。
- Instance overrides：added/removed slots、added/removed edges、slot/edge patches、variables。
- Presentation：world node positions、zoom、pan、collapsed state、routing/visual style。
- Navigation：当前文档、递归 path、back/forward history。
- Editing：selection、mode、connect source、undo/redo snapshots。
- Audit：Structure instance object history；不与 navigation history 或 undo stack 混用。

## Scene Geometry Contract

Layout engine 接收 materialized Structure Definition 与 Instance，输出唯一世界坐标结果：

```text
SceneGeometry {
  nodes: { id, x, y, width, height, shape }[]
  edges: { id, start, end, points, path, routing }[]
  tokens: { id, x, y, value }[]
  bounds
}
```

屏幕坐标只由 `screen = world × zoom + pan` 计算。DOM renderer 不参与布局，Pan/Zoom 仅设置 `#sceneRoot` 的 transform。ResizeObserver 通过 RenderScheduler 合并重排。SceneTransition 在 previous/next geometry 间插值，并遵守 reduced-motion。

## 交互规范

- 左键：选择；Shift 左键：多选；编辑模式拖动空白区：框选。
- 双击：进入绑定 Knowledge/Structure；空节点打开快速引用。
- 右键：根据 Node、Edge、Canvas 提供不同真实命令。
- 编辑模式：拖动节点改变 Presentation；Delete 删除实例引用/覆盖，不删除 Knowledge。
- 连接模式：先选 Source，再选 Target，创建实例边并立即打开关系属性。
- 简单操作使用 Context Menu/Toolbar；属性使用浮动面板；库、构建器和导入使用 Sheet。

## 完成阶段

- Phase 1：统一几何、边界锚点、四类路由、动画与 ResizeObserver。
- Phase 2：双栏 UI、Navigator、递归 Breadcrumb、模式、上下文菜单、浮动面板。
- Phase 3：动态图覆盖、Boolean Bₙ、Mod‑N、公式 parser/AST/validation。
- Phase 4：LKL、Quick/Advanced Builder、真实 Minimap、对象历史、导入导出。

高级模板中的专门数学求解器仍是后续扩展点；模板本身已进入结构库，并拥有真实、可编辑的节点与边模型。
