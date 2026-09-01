# LMN Knowledge System V4.3.0

LMN V4.3.0 是一个 local-first 的结构化知识包运行环境。Knowledge 保持稳定语义身份；所有 Structure Position 都是可承载知识、结构、正文、变量与公式的 Universal Semantic Container；LKL 2 可以完整导入、导出和往返 Knowledge Package；公式由本地 KaTeX 离线渲染；Structure View 只改变观察方式。

V4.3.0 在既有 Knowledge Package、事务化导入、语义 View 与删除撤回基础上，完成关系、向量空间与三项全局入口的整合：

- LMN 的去符号化与去结构化关系修正为 `N1 → M2` 和 `N2 → M3`；双向关系使用同一个双端箭头语义，自建关系可删除并撤销。
- “设计”对模板关系和自建关系统一控制颜色、粗细、线型、箭头与路由，并以 `relation-styles` 写回 LKL 2。
- 向量空间把点、向量、曲线、曲面和动点统一纳入“变量”，把“作图”改组为“操作 / 代数 / 几何”，并支持 xOy、yOz、xOz 与自由三维视角。
- 函数与开放曲面默认随当前可视画布取样；三维对象可投影到任意坐标平面，自由视角可拖动环绕。
- Poset 横排遵循“小元在左、大元在右”，初始模型、关系文本和图示保持双向同步。
- 知识库跟踪当前结构、位置和正文；其他一级知识保持折叠。结构库提供独立“新建结构”入口，标签页加号作为唯一全局新建入口。
- 左侧搜索拆分为结构搭建、全文和 LKL 三种检索；顶栏改为只执行复杂操作的命令行。

- 所有结构默认参数、视觉样式和视图能力都可在结构库中直接通过 LKL 2 编辑；Poset 的关系文本也使用同一条默认设置通道。
- 结构面板合并为“设置”，并新增同时控制全部节点与关系的“设计”；应用全局设计会清除局部遗漏，且完整写回 Structure Source。
- 结构按能力显示“可排列”“可旋转”或“固定视角”：LMN、Poset、Timeline 等使用横向/竖向排列，正多边形和循环结构保留旋转控制。
- 关系标签的 `center` 现在取完整路径的几何中点；Timeline 新增节点后自动创建定向“演化”关系，并把名称置于中央。
- “向量空间 Vector Space”提供自适应刻度的无限画布、规范等距三维坐标、点/向量/曲线删除、显式参数曲线与球面/环面/抛物面。
- 曲线支持区间动点及定向、循环、往返动画；安全数值输入支持 `pi`、`e`，分析工具增加极限和有限级数。
- Structure Source 预览可独立缩放并滚动查看细节；查找下一个仍会同步滚动编辑器、行号与语法层。
- 左侧“导航”更名为“知识库”，一级 Knowledge 具有重命名、复制、导出和删除入口；删除可由横幅或 `Ctrl+Z` 撤回，切换后默认收起旧知识目录。

- Structure Source 的“上一个/下一个”会把编辑器、行号与语法层同步滚动到当前匹配项。
- 解析几何画布支持无限平移、连续缩放和规范三维投影；点采用较小灰底黑描边，同一个点直接表达普通与选中状态。
- 曲线统一使用显式参数语法，如 `circle(cx=0, cy=0, r=3)`；点、向量、基与曲线都可从对象列表重新选择并编辑。
- 数值分析按曲线选择并将点值、极限、导数、区间积分和有限级数分组；Structure 的“信息”“呈现”与“参数”合并为“设置”。
- LMN 的 N 通道按成对反馈语义连接：`N1 → M1 / M2` 与 `N2 → M2 / M3`。
- 修复通用 Grid 布局导致部分实验结构无法打开的问题；原实验模板均升级为可用、可编辑结构。
- 内置与自定义结构都可修改以后新建实例所用的默认视觉样式；只有自定义结构模板可删除。
- 所有变量方案都可编辑默认参数并删除；内置方案以持久删除标记保存，不会被迁移过程自动恢复。
- 左侧导航收敛为“知识库 / 结构库 / 搜索”，一级 Knowledge 直接在知识库顶部切换。

- Notes、容器正文、公式和关系正文统一使用同一个随时可编辑的 Markdown + LaTeX 页面，不再先进入只读页再点击“编辑”。
- 标签固定宽度；导航栏加号、标签加号和顶部加号收敛为浏览器式“新标签页”，提供新建 Knowledge、LMN、Structure、Notes、导入与搜索入口。
- Navigator 改名为“知识库”，自动展开并滚动到当前位置；`construct` 表示唯一结构坐标，`reference` 表示可多次出现的跳转引用。
- 节点、边、Knowledge 与用户模板的重命名使用应用内行内对话框，不依赖可能失效的浏览器 `prompt`。
- Structure Source Workbench 使用内嵌查找/替换栏，支持下一个、上一个、替换、全部替换；预览固定居中，诊断区支持鼠标滚轮。
- 笛卡尔平面与旧 Vector Space 合并为“向量空间 Vector Space”，支持二维/三维、点、向量、标准基、函数、参数曲线、曲面、导数、积分、极限和级数。
- 内置曲线包括心形线、摆线、圆、椭圆、抛物线和三维螺旋线；表达式采用安全解析器，不执行任意 JavaScript。
- Poset 关系文本支持 `a < b < c` 链式写法并真实生成覆盖关系；Boolean Algebra 默认隐藏冗余关系名称；Venn 始终保留集合区域标题并显示承载知识预览。

- LKL 1 继续负责 Structure Template；LKL 2 独立负责完整 Knowledge Package。
- 导入先解析、校验和预览，再以单次事务提交；支持合并、覆盖和创建副本。
- Knowledge、Content、Structure Instance、Container、Relation、Variable、View 与 Entry 都可往返。
- LMN 使用严格的 `lmn-semantic` 中点布局；显示名称统一遵循 Knowledge title 与 local override 优先级。
- Modular Structure 提供结构模式与排盘模式，方向和旋转属于 View，不触发重算。
- Notes、Content、Relation 与公式预览共用本地 KaTeX 渲染器。
- 删除 Knowledge、Structure 或正文后会显示“撤回”，并支持 `Ctrl+Z`。
- 所有位置支持独立的本地显示名；规范 ID、数学语义与共享模板身份保持不变。
- Modular 公式写作普通表达式，结果由 Result Space 统一归一化；排盘标记显示变量名称并与变量表双向联动。
- Variable Scheme 具有内置、领域示例、我的方案三类生命周期，并支持复制、收藏、导入、导出和更新。
- 关系样式按“边覆盖 > 类型 > 当前结构 > 全局”级联；多选修改只产生一次撤销记录。
- Structure Source Workbench 提供 LKL 2 着色编辑、实时预览、诊断、格式化、查找替换和双向应用。

- Knowledge、Structure、Container 与 Content 都以单击打开；Relation 单击选择；双击不再触发隐藏导航。对象操作统一放在 `•••` 或右键菜单。
- Canvas 只呈现数学结构和关系；Container Page 只呈现持久内容与确实存在的动态结果，删除二次单击速览、原位展开和悬浮上下文工具条。
- 每个 Structure Position 统一为 Semantic Container，可同时承载多个 Knowledge、Structure、正文、公式、链接和变量；内容卡片整卡可点击，采用统一的纯文本摘要与公式预览。
- 正文与关系正文拥有独立的沉浸式阅读页，以及编辑、预览、分屏三种模式；空草稿取消后不会写入垃圾对象。
- Back、Forward、Breadcrumb 与文档标签共同使用可恢复的对象路径，并同步浏览器 `pushState` / `popstate`。
- 能力模型细分显示名、语义角色、视觉位置、语义位置、端点、方向、关系类型、规范删除、外观和正文权限。
- 规范 LMN 的位置与关系拓扑保持锁定，但显示名、正文和外观仍可编辑；需要改拓扑时可复制为自定义 LMN。
- 关系类型始终具有非空值，LMN 语义类型进入类型列表；关系正文、显示公式和线条样式分别编辑。
- 视觉层使用更清晰的文字与边线、暖纸背景、低干扰阴影、缩放预设、真实外观偏好、高清晰度与减少动画模式。
- Knowledge、Relation、Structure、Variable 和容器局部正文共享 Object Content 字段，并通过兼容适配器继续读取旧 Binding、Notes 与变量 metadata。
- Modular Ring 默认不创建变量；变量表采用紧凑行编辑、240ms 输入去抖、行内公式错误、按需详情与只读依赖视图，计算结果成为所属模位置的 runtime child。
- Poset / Hasse 默认空白，支持菱形、集合包含、整除、数值序与关系文本起始模型；工作台提供环检测、覆盖边传递约简、极值、上下界、sup/inf 与格检测。
- 结构交互和呈现由专用适配器描述：固定数学结构不会暴露错误的通用节点操作，Navigator 与标题也按结构语义呈现。
- 结构库加入类别筛选 chips，并把变量方案作为独立复用配置；全局“更多”菜单只保留工作区、外观、视图、偏好与帮助。
- Navigator 支持逐结构真实折叠、折叠全部、展开当前路径、循环引用提示和语义摘要；折叠不会关闭当前文档。
- 参数化模板先进入预览与配置，再插入 Structure；已有实例可从“结构设置”修改核心参数并保留仍然有效的绑定。
- 循环群统一为 `Cyclic Group · Cₙ`，展示元素阶、生成子群、轨道数量与合法生成元；Finite Operation Table 不再错误暗示群公理已成立。
- 原“Zi Wei Mod‑12”合并到通用 Modular Ring；紫微变量作为可复用 Variable Scheme，公式随 `modulus` 参数计算。
- Variable 支持输入、派生、常量分组，以及新增、编辑、重命名、复制、排序、显示/隐藏和带影响分析的删除。
- Knowledge、Structure 和用户模板具有稳定的重命名、复制、导出、删除入口；关闭标签只关闭视图，不删除对象。
- 已删除全局 Edit Mode；拖动、连接、重命名和删除均由当前对象的能力与规范拓扑保护决定。
- 结构库按基础、参数化、数学、逻辑、几何、图论、实验和变量方案组织，并提供真实缩略预览。
- 节点和边使用同一个世界坐标 Scene Geometry Model，缩放与平移仅作用于 Scene Root。
- 边界锚点支持矩形、圆角矩形、圆与 pill；路由支持 straight、Bezier、orthogonal、radial arc。
- 支持拖动、框选、Shift 多选、右键操作、Undo/Redo、专注模式和真实 Minimap。
- 每个 Structure Instance 可局部新增、删除、重命名节点和边，不修改共享模板。
- Boolean Algebra `Bₙ` 动态生成 `2ⁿ` 个元素与 Hasse 覆盖边，支持 meet、join、complement。
- 通用 Modular Ring 与安全公式 AST；变量方案可由 `hour` 等输入驱动文昌、文曲位置。
- `.lkl` 结构语言包含 lexer、parser、AST/Domain validation 和稳定 serializer；JSON 继续作为完整备份格式。
- 结构库还包含正 n 边形、循环群、Cayley 表、Venn、坐标系、矩阵、函数映射、交换图、DAG、状态机、时间轴、格、证明树、笛卡尔积、置换、变换群、动力系统与流网络等模板。

## 使用

Web 部署入口（合并到 `master` 并完成 Pages 后）：

`https://albuscannybean.github.io/s/apps/web/`

本地运行需要静态服务器，因为浏览器 ES Modules 不能直接从 `file://` 加载：

```powershell
node tests/local-server.mjs 4174
```

然后访问 `http://127.0.0.1:4174/apps/web/`。

Windows 安装包：

```powershell
powershell -ExecutionPolicy Bypass -File apps/desktop/build.ps1
```

产物位于：

- `outputs/windows/LMN_V4_3_0_x64_Setup.exe`
- `outputs/windows/portable/LMN.exe`

## 快捷键

| 快捷键 | 行为 |
| --- | --- |
| `C` | 从当前选中位置开始一次临时连接 |
| `N` | 打开新标签页 |
| `Ctrl+K` | 搜索与命令面板 |
| `Ctrl+F` / `Ctrl+H` | 在 Structure Source 中查找 / 替换 |
| `Enter` | 打开选中节点 |
| `Space` | 预览 / 属性 |
| `Delete` | 删除当前允许删除的实例对象；规范对象会保持保护 |
| `Ctrl+S` | 在 Structure Source Workbench 应用有效源码 |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Alt+←` / `Alt+→` | 导航后退 / 前进 |
| `Esc` | 关闭浮层、取消选择或退出专注模式 |

## 数据兼容

IndexedDB 版本 5 的 `variableSchemes` store 继续复用；Semantic Container 与 Object Content 随现有对象和 Structure Instance 保存，不增加破坏性 store 迁移。V2/V3/V4 Knowledge、Relation、Representation、Structure UUID、Binding 和 Notes 均保留；旧 Binding 与 Slot Note 会投影为兼容容器子项，旧 Mod‑12 实例保持身份并把固定模数公式改写为 `modulus` 参数。详见 `docs/migration-v3-v4.md`。

## 验证

```powershell
npm test
```

当前自动化测试覆盖 Universal Container、Object Content、构造/引用语义、统一编辑器、局部显示名、Result Space、Variable Scheme、关系样式级联、Structure Source、二维/三维表达式作图、数值导数与积分、Poset 链式文本、全部可见结构模板、Venn、Boolean Bₙ、LKL 往返与 Bundle 身份保持。浏览器验收脚本 `tests/qa-v4-2-3.mjs` 覆盖源码命中滚动、三维坐标对象、曲线编辑、合并面板、结构库菜单、变量方案与三级导航。

## 目录

- `apps/web`：Web/PWA 外壳、IndexedDB 与 V4 UI。
- `apps/desktop`：Windows WebView2 宿主与安装器。
- `packages/geometry`：Scene Geometry、Layout、Routing、Animation Coordinator。
- `packages/structure-engine`：模板、实例覆盖、公式、执行器、迁移与 Bundle。
- `packages/lkl`：LKL lexer/parser/validator/serializer。
- `packages/navigation`：递归路径、Navigator 语义模型与浏览器式历史。
- `packages/ui`：场景渲染器与统一工作区控制器。

MIT License
