# LKL 使用手册

## 1. 从一个知识包开始

LKL 是 LMN 的知识交换文件，扩展名为 .lkl。导入一次即可带入知识、正文、结构和它们之间的引用。你的正文图片与绘图定义也随包保存。

LKL 3 是完整信息档案格式。旧 LKL 2 知识包与 LKL 1 模板仍可导入；Structure Source 继续提供 LKL 2 的简洁编辑语法。

1. 打开右上角菜单，选择“导入知识包”。

2. 粘贴下面的示例，或选择 .lkl 文件。

3. 点击“验证预览”，查看对象数量、错误与同 ID 冲突。

4. 选择合并、覆盖同 ID 对象或创建副本，再确认导入。

5. 在知识库打开“极限”，编辑正文；在“导出 / 备份”选择完整 LKL 3。

## 2. 一个可以直接导入的 LKL 3

```lkl

lkl 3
{
  "schema": "lmn.cognitive-package/3.0",
  "package": {
    "id": "example:limits",
    "title": "我的第一个知识包",
    "roots": [
      "knowledge:limits"
    ]
  },
  "records": [
    {
      "kind": "knowledge",
      "id": "knowledge:limits",
      "profile": {
        "schema": "lmn.object-profile/1",
        "kind": "knowledge",
        "id": "knowledge:limits",
        "title": "极限",
        "summary": "",
        "version": null,
        "authors": [],
        "sources": [],
        "createdAt": null,
        "updatedAt": null,
        "evidenceStatus": "unspecified",
        "scope": "knowledge",
        "extensions": {}
      },
      "members": [],
      "data": {
        "id": "knowledge:limits",
        "title": "极限",
        "content": "极限描述函数值趋近某个值的行为。",
        "sources": []
      }
    }
  ]
}

```

示例只创建一个知识对象；它没有为了填满结构而制造节点或关系。编辑 data.title 或 data.content 可以修改标题与正文，ID 用来维持对象身份。

## 3. 文件由哪些部分组成

- 第一行 lkl 3 声明语言版本；其后为严格 JSON，键与字符串使用双引号，不支持注释和末尾多余逗号。

- schema 标识完整档案契约：lmn.cognitive-package/3.0。

- package 保存包 ID、标题与根知识 ID 列表。完整工作区可以有多个入口。

- records 保存对象档案，每条包含 kind、id、profile、members 和 data。

- profile 是统一信息目录：身份、类型、标题、摘要、来源、作者、版本、时间、证据状态和扩展信息。未知来源或时间保持空缺，导出器不会替你编造。

- members 为变量、容器、几何、动点等嵌套对象提供路径与信息目录。它们的完整定义和引用保存在 data 中。

- data 是对象的完整运行数据。模板、实例参数、几何依赖、视图、样式和正文等不会因导出器未逐一枚举字段而丢失。

目录中的来源、作者、证据状态和扩展信息必须与 data 一致；目录不一致会阻止导入。修改这些信息时，请编辑 data.sources、data.authors 或 data.profile，并重新导出生成目录。仅修改 data.title 或正文时，标题目录会自动更新。

对象类型：knowledge、relation、representation、structure-template、structure-instance、variable-scheme、package、content、view、board、placement、settings。

kind、id 与 data.id 必须一致。引用仍使用稳定 ID；显示名和图形位置不能代替身份。profile 与 members 提供信息目录，修改数学定义或正文应编辑 data 对应字段。

## 4. 正文、图片和自动绘图

所有正文使用同一个 Markdown / LaTeX 编辑器。可以插入图片文件、粘贴剪贴板图片或拖入图片；支持 PNG、JPEG、WebP、GIF，每张最大 5 MB。图片以可移植数据保存，不依赖临时文件路径。

点击“绘图”可把选中表达式变为绘图块，在预览或分屏中自动调用向量空间结构。也可以直接写：

第一行写三个反引号紧接 plot，第二行写 z=sin(x)*cos(y)，第三行写三个反引号。下面是它的预览：

```plot

z=sin(x)*cos(y)

```

可用表达式：y=sin(x)、z=x^2+y^2、x=cos(t); y=sin(t)、x=u; y=v; z=u*v。坐标工作台还提供区间、预设和点/向量创建。

## 5. 正确选择结构

- 一个中心与并列面向：n 元中心。面向顺序不表示依赖，中心复用所属 Knowledge。

- 集合分组：集合划分或等价类；重复元素会被拒绝。

- 有序对：笛卡尔积；完整展示 A×B，不使用泛化的流程箭头。

- 映射：函数映射检验有限函数；交换图逐元素核验两条路径是否相等。

- 置换：输入 1…n 的重排，查看真实映射与循环分解。

- 变换群：当前实现为正多边形的二面体群作用；动力系统为 Logistic 离散轨道，功能范围显示在结构描述中。

- 矩阵：在“矩阵运算”中输入元素，计算转置、加减乘、行列式、逆、秩、行最简形或线性方程。

库预览来自同一数学模型。旧版骨架实例保留其原有定义；新建结构使用新的模型。

## 6. ID、归属、关系与视图

Knowledge 保持稳定意义身份；正文是内容；Relation 需要真实语义依据；Structure 表达和组织这些对象。construct 表示唯一主要归属，reference 允许第二视角复用。中心锚点显示所属 Knowledge，不产生反向 construct 环。

临时任务角色、激活分数和练习表现不等于知识事实。完整档案将对象数据与信息目录保存在对应对象范围；工作区设置默认不随知识导出。

## 7. 导入失败与旧版本迁移

- JSON 格式错误：检查引号、逗号、括号和第一行。

- ID 或引用不一致：从原导出文件保留稳定 ID，检查根、关系、容器和视图所指的对象。

- 数学参数无效：检查分组互斥、置换双射、矩阵形状、函数映射或参数区间。

- 同 ID 冲突：预览会列出冲突数量；合并以传入字段更新，覆盖替换同 ID 对象，副本重建对象 ID 与引用。不会默默清空未出现在包中的整个知识库。

- 导入不能提交：修正诊断后重新验证。完整档案导入先构造计划，再通过同一事务入口保存。

LKL 3 的完整档案导出与旧 LKL 2 的可达知识包导出用途不同；旧格式可能无法携带新对象的全部扩展信息。需要完整保留时使用 LKL 3。

创建副本会同时隔离运行时 ID 和旧 LKL 包命名空间。兼容的内置模板复用当前库的显示设置，不修改全局模板；数学模型不兼容则停止导入。

## 8. 给 AI 与开发者

编译前读取当前 Structure Capability Catalog；不要按学科强制套模板，也不要虚构 renderer 或可执行字段。新 LKL 3 使用严格数据格式，不执行 JavaScript。LKL 2 的语法参考保留在下面，供阅读旧包和 Structure Source 使用。
