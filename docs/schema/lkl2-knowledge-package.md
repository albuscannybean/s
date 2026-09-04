# LKL 2 Knowledge Package schema

LKL 2.1 is the package language used by LMN Knowledge System 4.3.2. The source header remains `lkl 2`; LKL 1 remains the Structure Template interchange format.

The import pipeline is deliberately pure until commit:

`source → tokens → AST → package model → diagnostics → ImportPlan → one IndexedDB transaction`

Supported top-level declarations are `package`, `knowledge`, `content`, `structure-template`, `structure-instance`, `relation`, `variable`, `view`, `entry`, and `source`. A package has a stable namespace, a typed root, and optional named entries. Object references use package-scoped stable IDs; local database UUIDs are implementation details.

Persistent source includes Knowledge content, Structure parameters, Container references, Variables, Relations, and explicit Structure Views. Runtime calculation results and casual viewport pan/zoom are excluded.

Coordinate structures may persist independent geometric constructions inside a `structure-instance`:

```lkl
geometry g-line-1 {
  type "line"
  point slot A
  point motion M1
  visible true
  stroke "#355f78"
  width 2
}
```

`type` is `line`, `area`, or `volume`, requiring at least 2, 3, or 4 point references. `point` accepts `slot` and `motion` references; every referenced object must exist. These objects populate `instance.geometryPrimitives` and round-trip independently from semantic relations. Plot and motion definitions remain in the existing runtime JSON fields in 2.1.

Conflict strategies:

- `merge`: update explicitly supplied fields while retaining the local object identity.
- `replace`: atomically replace objects in the same package namespace.
- `copy`: import into a new namespace and remap all internal references.

The canonical serializer preserves Markdown and LaTeX source. Semantic round-trip comparison ignores timestamps, database IDs, caches, diagnostics, and runtime results.
