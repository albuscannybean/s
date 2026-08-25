# V3 → V4 非破坏性迁移

V4 将 IndexedDB 版本从 3 升级到 4，但不会删除或重建既有 object store。

## 保持不变

- Knowledge、Relation、Representation、Template、Instance 和 Binding 的 UUID。
- Knowledge Notes、Relations、Structure bindings、ownerKnowledgeId。
- V2 遗留 LMN 数据及既有 migration metadata。

## 新增默认字段

每个 Structure Instance 在加载时补齐：

```json
{
  "variables": [],
  "overrides": {
    "addedSlots": [],
    "removedSlotIds": [],
    "addedEdges": [],
    "removedEdgeIds": [],
    "slotPatches": {},
    "edgePatches": {}
  },
  "layoutState": {
    "visualOffsets": {},
    "nodePositions": {},
    "collapsedSlots": []
  },
  "objectHistory": []
}
```

内置模板按 V4 版本更新；非内置自定义模板原样保留。旧 Mod‑12 参数也不会从实例记录中删除，V4 新的 Zi Wei 模板则使用 `hour` 与派生变量定义。

JSON Bundle 的正式 schemaVersion 为 4。V2/V3 Bundle 导入时先进入迁移和校验，再与当前状态按 UUID 合并。
