# LMN Knowledge System 5.1.4 · M System Web

[打开网页 / Open the app](https://albuscannybean.github.io/s/apps/web/)

M System 是在浏览器中运行的结构化内容工作区。L System 解析需求，通过 LKL 将知识、正文、关系和结构交给 M；N 是用户的理解、学习与实践。数据保存在本机浏览器，支持导入、导出与离线使用。

## 功能

- 首页可以从具体数学问题建立轻量学习文档（概念、证明、解题、整理），并继续最近保存的知识；学习提纲写入现有正文，不强制建立 LMN 结构。
- 「我的数学课程」支持课程 → 章节 → 知识单元 → 习题/证明，及将已有知识归入章节；所有条目仍是普通 Knowledge，层级以原有 placements 保存，可经 LKL3 完整导入导出。
- 内容库统一管理知识、独立正文、结构与内容地址，支持搜索、拖动、剪切复制粘贴、批量删除和撤销。
- 结构库提供参数化数学结构、简笔预览、自定义模板与变量方案；自定义结构和变量方案可批量管理。
- 全局设计优先于局部样式；Boolean 哈斯图默认采用 4:3 对称布局，节点接口与箭头使用统一几何。
- 正文编辑支持 Markdown、LaTeX、图片粘贴及曲线/曲面绘图块。
- 矩阵与向量空间共享数学计算和几何引擎。数值计算使用双精度有限实数，曲线与曲面使用有限采样。
- LKL 3 完整档案保存内容、图片、关系、几何与视图；保留 LKL 1/2 兼容导入及往返验证。

删除先显示确认与影响范围，完成后提供撤销。本仓库只构建和部署网页。

## 本地运行与测试

需要 Node.js 20 或更新版本：

```sh
npm install
npm run build:web
node tests/local-server.mjs 4174
```

访问 [本地网页](http://127.0.0.1:4174/apps/web/)。浏览器 ES Modules 需要 HTTP 服务，不能直接双击 HTML 文件运行。自动测试使用 `npm test`。

浏览器回归使用 Playwright；保持本地服务器运行，在另一终端执行：

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node tests/qa-vnext-web.mjs
node tests/qa-design-system.mjs
node tests/qa-v51-web.mjs
node tests/qa-v511-structures.mjs
node tests/qa-v511-content.mjs
node tests/qa-v512-web.mjs
```

`LMN_QA_URL` 可指定待验证网页。CI 执行同一组检查；Pages 从 `master` 构建并发布 `apps/web` 与 `packages`。

## 使用 Codex 发布

1. 在对应 PR 上确认 **Web CI** 的 `test` 和 `browser` 两个任务均通过，并审阅变更。
2. 将 PR 合并到 `master`；`.github/workflows/pages.yml` 会因 `master` push 自动执行 `npm run build:web`、`npm test` 并部署 GitHub Pages。也可从 GitHub Actions 手动运行 **Deploy Web**。
3. 等待 **Deploy Web** 成功，然后访问 [网页](https://albuscannybean.github.io/s/apps/web/) 检查课程创建、章节归档与笔记编辑。若浏览器仍显示旧界面，请正常刷新以等待新版 service worker 生效。

可直接给 Codex 的发布任务是：「检查此 PR 的 CI 与变更，修复失败项；确认通过后合并至 `master`，等待 Deploy Web 成功，再核对线上学习目录。」注意：**发布代码不会把某个浏览器 IndexedDB 中的个人笔记上传到 GitHub**。换设备或浏览器前请在站内导出 LKL3 知识包。

## 目录

| 路径 | 职责 |
| --- | --- |
| `apps/web` | 网页入口、样式、PWA 与生成的公开合同 |
| `packages/structure-engine` | 数学模板、实例、变量、执行器与迁移 |
| `packages/geometry` | 布局、边界接口、连线路由与几何图元 |
| `packages/navigation` | 内容地址、归属、导航与内容操作 |
| `packages/ui` | 工作区、统一正文编辑器与场景渲染 |
| `packages/lkl*` | LKL 解析、校验、导入导出与完整档案 |
| `tools` | 公开合同与网页离线资源生成 |
| `tests` | 兼容回归、单元测试与当前浏览器验收 |
| `docs` | 用户手册、格式合同及历史架构记录 |

## 文档

[中文入门](docs/LKL-3-入门.md) · [English guide](docs/LKL-3-Guide.md) · [LKL 3 合同](docs/LKL-3-contract.json) · [架构与兼容说明](docs/M-SYSTEM-WEB-V5.md) · [内容库操作说明](docs/M-System-Web-5.1.1.md)

旧版本的迁移与回归测试继续保留，以保证已有内容可读取。当前入口以本页为准；历史架构文档不代表仍在维护独立桌面安装器。

MIT License
