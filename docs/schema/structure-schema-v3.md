# Structure schema V3

## StructureTemplate

```json
{
  "id": "builtin:regular-polygon",
  "name": "Regular n-gon",
  "version": 1,
  "category": "geometry",
  "nestable": true,
  "computable": true,
  "slotFactory": "regular-polygon",
  "slots": [],
  "edges": [],
  "parameters": [{"id":"n","type":"number","defaultValue":6,"min":3,"max":24}],
  "constraints": [],
  "rules": [],
  "layout": {"type":"radial"},
  "visual": {"accent":"#2F7658"}
}
```

Static Templates list Slots/Edges directly. Dynamic Templates use a known `slotFactory`; materialization still produces the same Slot/Edge contract.

## Slot and Edge

```json
{
  "id": "L2",
  "label": "存在 / Existence",
  "role": "existence",
  "semanticCoordinate": {"column":"L","layer":2,"order":2},
  "accepts": ["knowledge","structure"],
  "cardinality": "one"
}
```

```json
{
  "id": "e2",
  "sourceSlotId": "L2",
  "targetSlotId": "M1",
  "direction": "directed",
  "relationType": "grounds",
  "label": "奠基"
}
```

Allowed directions: `undirected`, `directed`, `bidirectional`, `cyclic`, `conditional`, `derived`.

## StructureInstance and Binding

```json
{
  "id": "uuid",
  "templateId": "builtin:lmn-432",
  "templateVersion": 1,
  "ownerKnowledgeId": "uuid-or-null",
  "bindings": [{
    "id": "uuid",
    "instanceId": "uuid",
    "slotId": "L2",
    "targetType": "knowledge",
    "targetId": "uuid",
    "metadata": {}
  }],
  "parameters": {},
  "runtimeState": {"variables":{},"results":{},"errors":{}},
  "layoutState": {"visualOffsets":{},"collapsedSlots":[]}
}
```

`targetType` is `knowledge`, `structure`, `value`, or `variable`. A Structure binding points to another Structure Instance, allowing heterogeneous recursion. Cyclic nesting is rejected.

## Bundle

A portable export has `schemaVersion: 3` and arrays named `knowledge`, `relations`, `representations`, `structureTemplates`, and `structureInstances`. Import validates referenced Template, Knowledge and Structure IDs, then merges by UUID.
