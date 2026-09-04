# Changelog

## V4.3.2 — 2026-09-05

### Cognitive Compilation Runtime

- 以当前 Task 与 Domain 约束驱动确定性的知识编译流程，不修改 Knowledge 本体。
- 新增 Role Inference 与 Topology Induction，把候选知识的任务角色和已有语义关系编译为可解释的投影拓扑。
- 新增 Projection Ranking 与 Justification，使候选投影具有稳定排序，并能说明选择、关系与组织依据。
- 新增 Gap / Completeness 分析，明确展示当前组织的覆盖程度、缺失角色和未满足条件。
- 将角色推断、拓扑归纳、投影排序与完整性结果收敛为自动组织流程；临时结果仍须由用户明确保存才会持久化。
- 保持 V4.3 工作区数据、LKL 2.1、既有 Cognitive Runtime、Structure Engine 与导入导出往返兼容。

## V4.3.1 — 2026-09-04

### Cognitive Runtime Foundation

- 新增独立于 Knowledge 本体的 Cognitive Task Context，用于记录当前目标、任务类型、领域约束、关注点、活跃知识和可选学习者状态；上下文仅保存在本机会话中。
- 新增统一语义索引，覆盖知识、正文对象、关系、语义容器、标签、别名、来源与结构角色；现有全文搜索 API 继续兼容，并迁移到同一检索底座。
- 新增确定性、local-first 的 Knowledge Activation，以有限候选集、激活分数、激活原因和关系路径表达当前任务真正需要的知识。
- 新增 Derived / Ephemeral Projection：复用现有 Structure Engine 与内置模板动态组织活跃知识，默认不写入知识库，只有明确选择“保存为结构”后才持久化。
- 补充语义邻域、有向遍历、依赖闭包和最短有意义路径等轻量关系能力，以及可组合的任务模式与领域配置接口。
- 保持 V4.3.0 工作区数据、LKL 2.1、Semantic Container、construct/reference、Geometry、变量、结构导入导出和往返语义兼容。

## V4.3.0 — 2026-09-01

V4.3.0 将此前多轮 RC 验证收敛为正式稳定版，重点完成：

### 正式版热修复

- **V4.3.0-HF2：**修复 LKL 2 Structure Instance 无法解析已由 LKL 1 安装的 `custom:*` Structure Template；验证与导入计划现在使用同一解析优先级，缺失模板会阻止提交，实例自定义标题也会完整持久化。
- **V4.3.0-HF1：**删除 Knowledge、Structure 或 Knowledge Package 时，沿 `construct` 所有权一次计算并原子删除完整构造子树；`reference` 与普通 relation 只清理链接，不传播删除。知识库新增带筛选、全选、影响预览和会话撤销的批量删除模块。
- 修复线上旧数据、自包含知识、循环构造或孤立组件会让知识库根目录消失、只剩“当前位置”一栏的问题；知识包根和所有未覆盖内容现在都会获得稳定的可导航入口。
- 更新离线缓存版本，使 GitHub Pages 客户端在刷新后取得修复后的导航代码。

### 正式版功能

- 全局知识坐标与知识库导航，支持嵌套内容跟踪、迁移、横向滚动和侧栏缩放。
- 浏览器式标签管理，包括关闭、排序、多标签新建和可靠的已打开文档列表。
- 关系方向、双向箭头、撤销删除与全局设计/LKL 2 样式级联。
- 向量空间二维/三维视角、投影、变量统一管理、曲线动点和受约束的点/向量交互。
- Poset、Proof Tree、矩阵/网格、循环群、LMN 等结构的布局、变量和可视化修复。
- 结构搜索、全文搜索、LKL 搜索、可视化结构构建与 LKL 1 高级模板工作流。
- 正式版 Web/PWA 元数据、Windows 安装包与自动化发行流程。

完整功能说明与使用方式见 [README.md](README.md)。
