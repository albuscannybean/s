# LMN V3 architecture

## Domain boundaries

V3 separates six concepts that V2 partially coupled:

| Concept | Responsibility | May reference |
|---|---|---|
| Knowledge | Stable semantic identity and notes | Relations, owned Structure Instances |
| Relation | Free semantic connection | Knowledge endpoints |
| Structure Template | Reusable formal definition | Slots, edges, parameters, rules, constraints |
| Structure Instance | Runtime use of a template | Owner Knowledge, bindings, parameters |
| Binding | Assignment inside one Slot | Knowledge, Structure, value or variable |
| Layout State | Presentation only | offsets, zoom, collapse state |

Knowledge creation has no Structure side effect. LMN is `builtin:lmn-432`, following the exact same Template/Instance/Binding path as Hasse, a Venn diagram or a cyclic group.

## Runtime flow

```text
Structure Template
  → materialize dynamic slots/edges from parameters
  → validate Instance bindings and constraints
  → resolve parameter + variable scope
  → topologically evaluate JSON-AST rules
  → store results/errors in runtimeState
  → render semantic coordinates and edges
```

The evaluator accepts a small operation whitelist (`add`, `multiply`, `mod`, comparisons, Boolean operators, `if`, `lookup`). It never calls source-code evaluators. Dependency cycles and missing variables become explicit runtime errors.

## Persistence

IndexedDB schema 3 owns these stores:

- `knowledge`, `relations`, `representations`
- `structureTemplates`, `structureInstances`
- `settings`, `migrationState`
- read-compatible legacy `lmns`, `structures`

Repository interfaces in `packages/persistence` keep IndexedDB replaceable by future SQLite/cloud adapters. Bundle import/export operates on domain arrays, not database internals.

## UI composition

```text
AppShell
├─ TopBar (breadcrumb, semantic search, Insert Structure)
├─ Explorer (Knowledge and Structure instances)
├─ Workspace
│  ├─ InstanceTabs
│  ├─ CanvasViewport (pan/zoom)
│  ├─ StructureRenderer
│  └─ NestedStructurePreview
├─ Inspector (semantics, relations, rules, notes, appearance)
└─ StatusBar (depth, selection, runtime, autosave)
```

The renderer dispatches by formal layout (`columns`, `radial`, `hasse`, `venn`, `coordinate`, `table`, generic) while preserving the same slot interaction contract. Nested Structures keep their own template and runtime; no flattening into an LMN node model occurs.

## Desktop

The Windows host is a 64-bit WinForms application using the official WebView2 SDK. `SetVirtualHostNameToFolderMapping` maps packaged web assets to `https://app.lmn.local/`, providing a stable secure origin for ES modules, service workers and IndexedDB. The host is single-instance and has a non-visual `/smoke-test` used during packaging verification.
