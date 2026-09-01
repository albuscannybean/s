# LKL 2 Knowledge Package schema

LKL 2 is the package language used by LMN Knowledge System 4.2. It is separate from LKL 1, which remains the Structure Template interchange format.

The import pipeline is deliberately pure until commit:

`source → tokens → AST → package model → diagnostics → ImportPlan → one IndexedDB transaction`

Supported top-level declarations are `package`, `knowledge`, `content`, `structure-template`, `structure-instance`, `relation`, `variable`, `view`, `entry`, and `source`. A package has a stable namespace, a typed root, and optional named entries. Object references use package-scoped stable IDs; local database UUIDs are implementation details.

Persistent source includes Knowledge content, Structure parameters, Container references, Variables, Relations, and explicit Structure Views. Runtime calculation results and casual viewport pan/zoom are excluded.

Conflict strategies:

- `merge`: update explicitly supplied fields while retaining the local object identity.
- `replace`: atomically replace objects in the same package namespace.
- `copy`: import into a new namespace and remap all internal references.

The canonical serializer preserves Markdown and LaTeX source. Semantic round-trip comparison ignores timestamps, database IDs, caches, diagnostics, and runtime results.
