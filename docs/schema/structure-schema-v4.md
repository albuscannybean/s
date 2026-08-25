# Structure Schema V4

## Template / Definition

```text
StructureTemplate
  id, name, description, version, category
  slots[]       semantic node definitions
  edges[]       semantic connections
  parameters[]  typed instance parameters
  variables[]   input or derived variable declarations
  constraints[]
  rules[]
  layout        layout strategy, not semantic identity
  visual        presentation defaults
```

Slot includes `id`, `label`, `role`, `semanticCoordinate`, `accepts`, `cardinality` and optional visual shape. Edge includes endpoints, direction, relationType, label, routing, semanticAxis and optional visual data.

## Instance

```text
StructureInstance
  id, templateId, templateVersion, ownerKnowledgeId
  bindings[]
  parameters{}
  variables[]
  runtimeState { variables, results, errors }
  overrides {
    addedSlots[], removedSlotIds[], slotPatches{}
    addedEdges[], removedEdgeIds[], edgePatches{}
  }
  layoutState { nodePositions{}, visualOffsets{}, collapsedSlots[] }
  objectHistory[]
```

Materialization 顺序固定为：Template Factory → remove base objects → add instance objects → apply patches → remove dangling instance edges。Template 不会被实例编辑反向修改。

## Formula AST

允许 literal、variable、`+ - unary- * / %`、`mod`、`if`、`lookup`。Parser 不使用 `eval` 或 `Function`，运行器只解释白名单 AST operation。

## LKL

LKL v1 是一行一个 directive 的稳定文本格式，支持 `structure`、`slot/node`、`edge/relation`、parameter、variable、constraint、rule、layout 与 visual。Lexer 的每个 token 都携带 line/column；Parser 错误可直接定位。Serializer 的输出可再次解析得到等价 Domain Definition。
