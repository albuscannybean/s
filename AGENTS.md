# LMN 网站开发约束

任何 UI 开发前，按顺序阅读 `docs/design/DESIGN_SYSTEM.md`、`PRODUCT_UI.md`、`INTERACTIONS.md`、`DO_NOTS.md`；需要设计参考时读 `REFERENCES.md`，需要了解迁移边界时读 `AUDIT.md`。

- 产品是本地优先的知识工作区：知识身份、结构语义、正文、图形、LKL 往返与 IndexedDB 数据保真优先。
- 沿用原生 ES modules、CSS、HTML、原生 dialog/select 和现有共享编辑器。当前无需 React、Tailwind、shadcn 或 Radix；不得为外观迁移框架。
- 先复用 `packages/ui/design-tokens.css` → `design-system.css` / `workspace-chrome.js` → 现有 editor/navigator/workbench → 页面。不要再创建按版本叠加的 refinement 样式表。
- `design-tokens.css` 是主题色的唯一来源；`design-system.css` 是通用控件、密度与 workspace 布局的权威。feature CSS 只负责真实领域表示及组件局部结构。
- 先判断是否已有可用规则；确实需要新 token/交互时，同步更新设计文档并说明现有规则不足在哪里。不要写相似色、随机间距或页面私有按钮。
- 结构节点、连接端口、几何点、关系、用户保存的视觉配置属于领域表示，不得用通用 UI 的圆角、间距或图标规则破坏几何/语义。
- 复用原生 modal 的焦点约束与 Escape；菜单和 tabs 必须支持键盘；图标按钮必须有可访问名称；隐藏面板必须退出 Tab 顺序。
- 实质修改后运行 `node --test tests/*.test.js`、`node tools/generate-contract.mjs`、`node tools/generate-web-assets.mjs`。涉及工作区 UI 时运行 `node tests/qa-design-system.mjs` 与受影响的现有浏览器回归。
- 浏览器 QA 使用 Playwright，可通过 `PLAYWRIGHT_MODULE`、`LMN_BROWSER_EXECUTABLE`、`LMN_QA_URL` 指定已安装环境。服务命令为 `node tests/local-server.mjs 4174`。
- 离线资产清单由生成器维护，禁止手改 `apps/web/sw.js`；新增 CSS/JS 后必须重建，保证离线和线上使用同一版本。
- 完成检查后报告真实结果、未迁移领域与发布状态；本地源码改变不等于 GitHub Pages 已发布。
