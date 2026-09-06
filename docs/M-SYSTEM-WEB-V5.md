# M System Web V5 架构与兼容说明

M 维护 Knowledge、Content、Relation、Structure 的身份与引用。L 的需求解析与知识编译结果通过 LKL 进入 M；现有 cognitive-runtime 使用已保存的事实生成任务投影，不直接改写 Knowledge。N 的理解和实践仍属于用户。

## 共享层

| 层 | 模块 | 统一职责 |
| --- | --- | --- |
| 对象档案 | packages/domain/object-profile.js | 身份、来源、作者、版本、证据状态与扩展元数据；未知信息不补造 |
| LKL 交换 | packages/lkl3/schema.js、package.js | 完整记录、嵌套目录、验证、冲突计划、命名空间隔离；复用事务提交 |
| 数学计算 | packages/math/linear-algebra.js、structure-engine/plotting.js | 有限矩阵/向量、安全表达式与采样 |
| 结构模型 | packages/structure-engine/semantic-templates.js | 由数学参数生成真实元素、关系、布局和结果 |
| 能力目录 | getStructureCapabilities | 当前库的动态能力；返回给 cognitive-runtime 和外部编译器 |
| 几何呈现 | packages/geometry/scene-geometry.js、ui/structure-renderer.js | 路径、自环、标签、边界、缩放与命中；正文 plot 复用 |
| 文档呈现 | packages/ui/document-editor.js、math-markup.js、inline-plot.js | 知识、正文、关系等共用编辑入口 |
| 库预览 | packages/ui/template-preview.js | 同一物化结构和场景背景生成缩略图 |

## 数学范围

n 元中心表达一个所属知识和无序面向；中心为宿主锚点，不创建第二份知识或反向归属。有限函数检验每个定义域元素恰有一个像，并计算单射/满射。交换图当前是四个等势有限集合上的方形，以像列表逐项核对复合相等。等价类与划分检验各块非空且互斥。笛卡尔积生成完整有序对。置换显示双射箭头、固定点自环和不交循环。

“变换群”实现正 n 边形二面体群的 Cayley 作用；“动力系统”实现 Logistic 离散轨道；“流网络”计算有限有向容量网络的最大流。模板说明明确这些限定。依赖图、证明树、状态机、决策树和格使用符合关系方向的起始拓扑，真实知识内容仍须有证据。

矩阵最多 20×20，使用主元消元和相对尺度。AX=B 只返回唯一解，不将自由变量任意赋零。函数值、导数、积分、极限与有限和为数值结果；采样不能证明收敛、连续或定义域完整。曲面中的非实数区域作为间断处理。区间和视图随完整档案保存。

## LKL 3

第一行 lkl 3，其后是严格 JSON。schema、package 和 records 构成信封；记录包含 kind、id、profile、members、data。data 保存完整运行数据，profile/members 是目录。来源、作者、证据与扩展目录如果与 data 不一致，导入会拒绝。标题和摘要等派生显示字段可规范化更新。

默认导出工作区全部记录，设置不随包导出；LKL 2 保留按根知识导出可达子图的用途。图片嵌入为数据 URL，单张限 5 MB，完整包限 70 MB。未知扩展字段保留在 data 中。

校验包括根入口、关系、模板、绑定、正文、表征、视图、几何操作数和归属图。副本同时改写运行时 ID 与外部命名空间；兼容内置模板复用当前全局显示设置，不修改全局库；模型不兼容则停止提交。不支持任意 JavaScript renderer/factory 注入。

## 兼容与发布

数据库仍读取 schemaVersion 4。升级发现受影响旧模板时，将原定义保存为隐藏 legacy 模板并重定向旧实例；知识、内容和实例 ID 保留，新建实例使用新模型。没有附带旧模板定义的历史文件不能保证还原过去的显示模型，应使用其创建版本的完整备份。

LKL 1/2 解析入口保留，Structure Source 继续使用 LKL 2 简洁语法。旧格式不保证携带所有新增字段，完整保留使用 LKL 3。

发布只打包 apps/web 与 packages。CI 执行单元和 Chromium 浏览器验收；Pages 部署前执行回归测试。本地 Edge 验收相同网页，不构建 Windows。截图与临时样本位于被忽略的 qa-output 中。

