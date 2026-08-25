# LMN Knowledge System V4

LMN V4 是一个 local-first 的递归知识工作空间。Knowledge 保持稳定语义身份；LMN 与其他 Structure 作为可编辑、可计算、可嵌套的结构实例；Notes 是内容；Representation/Layout 只改变观察方式。

V4 的核心变化不是换肤，而是统一了场景几何、交互语法和结构执行模型：

- Navigator + Canvas 双栏工作区；属性编辑改为上下文菜单与浮动面板。
- 节点和边使用同一个世界坐标 Scene Geometry Model，缩放与平移仅作用于 Scene Root。
- 边界锚点支持矩形、圆角矩形、圆与 pill；路由支持 straight、Bezier、orthogonal、radial arc。
- 浏览 / 编辑 / 连接三种明确模式；支持拖动、框选、Shift 多选、右键操作、Undo/Redo、专注模式和真实 Minimap。
- 每个 Structure Instance 可局部新增、删除、重命名节点和边，不修改共享模板。
- Boolean Algebra `Bₙ` 动态生成 `2ⁿ` 个元素与 Hasse 覆盖边，支持 meet、join、complement。
- 通用 Mod‑N 结构与安全公式 AST；Zi Wei 示例以 `hour=7` 驱动文昌、文曲位置。
- `.lkl` 结构语言包含 lexer、parser、AST/Domain validation 和稳定 serializer；JSON 继续作为完整备份格式。
- 结构库还包含正 n 边形、循环群、Cayley 表、Venn、坐标系、矩阵、函数映射、交换图、DAG、状态机、时间轴、格、证明树、笛卡尔积、置换、变换群、动力系统与流网络等模板。

## 使用

Web 部署入口（合并到 `master` 并完成 Pages 后）：

`https://albuscannybean.github.io/s/apps/web/`

本地运行需要静态服务器，因为浏览器 ES Modules 不能直接从 `file://` 加载：

```powershell
python -m http.server 4174
```

然后访问 `http://127.0.0.1:4174/apps/web/`。

Windows 安装包：

```powershell
powershell -ExecutionPolicy Bypass -File apps/desktop/build.ps1
```

产物位于：

- `outputs/windows/LMN_V4_x64_Setup.exe`
- `outputs/windows/portable/LMN.exe`

## 快捷键

| 快捷键 | 行为 |
| --- | --- |
| `V` / `E` / `C` | 浏览 / 编辑 / 连接模式 |
| `N` | 新建 Knowledge |
| `Ctrl+K` | 搜索与命令面板 |
| `Enter` | 打开选中节点 |
| `Space` | 预览 / 属性 |
| `Delete` | 在编辑模式删除当前实例对象 |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Alt+←` / `Alt+→` | 导航后退 / 前进 |
| `Esc` | 关闭浮层、取消选择或退出专注模式 |

## 数据兼容

IndexedDB 升级到版本 4，但沿用原有 store。V2/V3 Knowledge、Relation、Representation、Structure UUID、Binding 和 Notes 均原样保留；V4 只为 Structure Instance 添加 `overrides`、`variables`、`layoutState.nodePositions` 与 `objectHistory` 默认字段。详见 `docs/migration-v3-v4.md`。

## 验证

```powershell
npm test
```

当前自动化覆盖场景几何、坐标变换、锚点与路由、Boolean Bₙ、动态图覆盖、公式解析、Mod‑N、LKL 往返、导航路径、V2/V3 迁移和 Bundle 身份保持。浏览器验收脚本为 `tests/qa-v4.mjs`。

## 目录

- `apps/web`：Web/PWA 外壳、IndexedDB 与 V4 UI。
- `apps/desktop`：Windows WebView2 宿主与安装器。
- `packages/geometry`：Scene Geometry、Layout、Routing、Animation Coordinator。
- `packages/structure-engine`：模板、实例覆盖、公式、执行器、迁移与 Bundle。
- `packages/lkl`：LKL lexer/parser/validator/serializer。
- `packages/navigation`：递归路径与浏览器式历史。
- `packages/ui`：场景渲染器与统一工作区控制器。

MIT License
