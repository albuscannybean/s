# LMN Design System

## 定位与实现

LMN 是本地优先的知识与数学工作区。用户导入/创建知识，书写正文，组织结构和关系，观察与计算，最后导出保真的 LKL 包。设计服务长时间阅读和连续操作；主界面不承担品牌营销。

采用现有原生 ES modules + HTML/CSS + 本地 KaTeX。基础交互复用原生 button/input/select/dialog；现有 `document-editor.js`、`knowledge-navigator.js`、`workspace-controller.js` 负责复合体验。无需新增运行时依赖。复杂新控件应先复用现有实现或平台能力，若平台不能覆盖再引入经验证的库，禁止自行拼装不完整的焦点陷阱。

## Token 与层级

主题色仅定义于 `packages/ui/design-tokens.css`，共享尺寸/状态/布局定义于 `packages/ui/design-system.css`。加载顺序：主题 → 历史 feature CSS → 通用设计系统。历史 CSS 中仍有未迁移的领域表示样式，禁止继续往其中追加新一代通用规则。

| 用途 | Token / 规则 |
| --- | --- |
| 应用底色 | `--ui-app` / `--canvas` |
| 工作内容、正文 | `--ui-workspace` / `--paper` |
| 内容库与状态栏 | `--ui-panel` / `--sidebar` |
| 浮层 | `--ui-overlay` / `--elevated` |
| 可交互悬停 | `--ui-hover`，基于当前主题混合 |
| 选中 | `--ui-selected` / `--green-soft`，搭配强调色线条 |
| 遮罩 | `--ui-scrim`，只用于 modal |
| 正文 / 次要信息 | `--ink` / `--muted` |
| 分隔 / 控件边框 | `--line` / `--line-strong`，1px |
| 主要动作 / 焦点 | `--green` / `--ui-focus` |
| 危险 / 警告 / 信息 | `--danger` / `--gold` / `--blue`，必须同时有文案 |

保留 warm、paper、violet、slate、dark 与既有强调色偏好；新规则通过语义变量跟随主题，不用白底常量修补深色模式。结构几何及用户指定颜色另有领域语义，不机械映射成界面颜色。

## 尺寸、排版与密度

- 间距序列：4、8、12、16、20、24、32、48px，对应 `--space-*`。1px 边框、2px 焦点线、领域几何坐标不属于间距。
- 圆角：4px 控件和列表行，6px 内容容器，8px 对话框。不要为普通容器加阴影；菜单/浮层可用 `--shadow-2`，modal 可用 `--shadow-3`。
- 默认字号 14px，保留用户 11–22px 字号设置。层级使用 rem：标题 1.714rem/600，section 1.143rem/600，正文 1rem/400，metadata/secondary 0.857rem/400，label 1rem/500。正文行高 1.5，长文 1.8；代码使用系统等宽字体，公式仍由 KaTeX 排版。
- 默认按钮/输入框高 32px；图标按钮 32×32px，SVG 16×16px / stroke 1.75。导航行至少 36px，长标题允许换行。不得靠缩小到 8–10px 获得密度。
- 顶栏 56px，文档工具栏 48px，状态栏 28px。内容库默认 300px，可调整 220–620px。所有 inspector 统一 360px，窄屏最大为视口宽度减 16px；切换变量、操作等页面不得改变面板宽高。复杂表单在面板内换行，宽表格在模块内横向滚动。
- 段落保持合理阅读宽度；编辑器保留现有最大宽度。首页和新标签页是左对齐的操作入口，有限列数，不做 Hero。

## 基础组件规则

| 组件 | 必须遵循 |
| --- | --- |
| Button | 原生 button；每个局部操作组最多一个主动作；次要按钮描边，危险按钮使用语义色；保留 disabled 行为 |
| Input / textarea | 原生标签或明确 aria-label；占位符不能替代名称；边框和 focus 可见；错误同时提供恢复提示 |
| Select | 直接使用已有原生 select；不得用非语义 div 模拟下拉 |
| Dialog | 原生 showModal；命名标题；明确取消；提交前验证；破坏性操作沿用影响预览与撤销 |
| Dropdown / context menu | 现有共享 transient manager；方向键/Home/End 导航；Escape 关闭并回焦 |
| Tooltip | 简短辅助说明用 title，关键操作名用文字或 aria-label；复杂交互内容不得塞入 tooltip |
| Tabs | 导航模式使用 tablist/tab/tabpanel、aria-selected 与 roving tabindex；左右键/Home/End 切换 |
| Card | 仅用于确有独立内容边界的结果或表示；普通导航/操作项用行与分隔线，默认无阴影 |
| Panel | 单一标题与 toolbar，内容区负责滚动；复用全局宽度、背景、边框 |

## 状态、可访问性与动效

hover 是轻微背景变化；selected 同时有颜色和线条，不能仅靠 hover 表示。focus 使用 2px outline / 2px offset，覆盖键盘控件、链接与分隔条。disabled 仍保留标签，不触发操作；loading 保持控件尺寸并使用 aria-busy；保存状态用 polite live region，避免高频画布信息不断播报。

正文对比度目标 4.5:1，控件轮廓/焦点目标 3:1；主题切换后须用实际渲染验证，不宣称所有历史视图已通过完整无障碍认证。保留页面缩放与用户字号。所有隐藏导航退出焦点顺序。提供跳到工作区链接。

普通反馈 120ms ease-out，无按钮位移、无装饰性入场；尊重系统与用户 reduced motion。几何动画是产品功能，保留其语义与显式控制。

## 响应式与扩展

≥1200px 时 inspector 停靠右侧，工作区让出实际宽度；小于1200px 使用有边界的侧浮层。≤900px 内容库默认收起，显式打开为覆盖侧栏；保留文档与操作入口，禁止把三栏简单纵向堆叠。≤520px 首页动作单列。表格/源代码横向滚动由局部容器承担，不能撑宽页面。

新增功能顺序：确认任务与现有语义 → 找共享组件和 token → 组合进既有 workspace → 检查主题/键盘/长文本/窄窗口 → 更新有变化的规范与审计。协议层与数学模型不参与纯 UI 重构。
