# LMN Knowledge System

A local-first, recursive knowledge workspace where a single word can become stable Knowledge, accumulate persistent Relations, and gain Text, Graph, LMN and mathematical Structure representations without losing its identity.

## Product purpose

LMN combines the immediacy of mind maps, depth of notes, identity and reuse of knowledge graphs, and precision of formal structures. It implements the Layer–Mediation–Nexus 4·3·2 model while keeping structure emergent rather than mandatory at capture time.

## What works — V2

- Create, edit, search and reuse UUID-based Knowledge; duplicate titles are allowed.
- Create persistent Relations and reconstruct bounded connected neighborhoods.
- Edit Markdown and inline/display LaTeX source with offline preview.
- Enter a unified three-pane LMN Workspace with vertical L/M/N columns, recursive Breadcrumb, Back/Forward history, semantic zoom and Focus Mode.
- Every newly named Knowledge automatically receives a strict L1–L4, M1–M3, N1–N2 Root LMN; existing V1 data is migrated non-destructively.
- Select, multi-select, drag, connect, inline-assign, context-click, enter or expand Position Cards while keeping Presentation separate from semantics.
- Edit Information, Relations, Presentation and GoodNotes-style Markdown/LaTeX Notes in the Inspector with autosave and global Undo/Redo.
- Create Generic Graph, Tree/Mind Map and Poset Structures; derive a Hasse view by transitive reduction.
- Autosave to IndexedDB, review deletion impact, import/export versioned JSON, and work offline.
- Run the same UI and domain engine as a PWA or Windows `.exe` host.

## Architecture

The monorepo shares `packages/domain` between `apps/web` and `apps/desktop`. Knowledge is the semantic identity; Relations are persistent; Representations are views; LMN positions and Structure objects reference UUIDs. See [architecture](docs/architecture.md) and [ADRs](docs/adr/).

## Development setup

No npm or NuGet dependencies are required. Use Node.js 18+ for tests; Windows includes the .NET Framework compiler used for the desktop build.

```bash
npm test
powershell -ExecutionPolicy Bypass -File apps/desktop/build.ps1
```

For Web development, serve the repository root with any static HTTP server and open `/apps/web/`. Direct `file://` use is not supported because modules and IndexedDB origins require HTTP.

## Windows build

```bash
powershell -ExecutionPolicy Bypass -File apps/desktop/build.ps1
```

Run `LMN.exe`. It starts a private `127.0.0.1` server and opens the workspace in the default browser. No package installation is required. GitHub Actions publishes the complete Windows artifact directory.

## Web build and deployment

There is no compilation step. GitHub Pages deploys `apps/` and `packages/`; the application URL ends in `/apps/web/`. Enable Pages with “GitHub Actions” as the source.

## Tests

`npm test` protects Knowledge identity, relation reuse, connected graph reconstruction, cycle safety, the LMN schema, Hasse reduction, import/export round trips and deletion impact. The critical A→B then C→existing-A scenario asserts exactly three Knowledge entities and two Relations.

## Import/export

Exports contain `schema_version` plus all semantic stores. Import validates the schema and endpoints, previews counts, merges by UUID, and preserves semantic identity. Keep backups before destructive database changes.

## Roadmap

V1 establishes the complete maintainable baseline. Next increments: drag/persist freeform layout, full CommonMark/KaTeX rendering, richer relation editing, formal tree validation, conflict-aware sync adapters, indexed full-text search, browser E2E tests, migration fixtures, installer/signing, and optional embedded WebView2 shell. AI is deliberately not a core dependency.
