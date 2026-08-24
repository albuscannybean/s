# LMN Knowledge System V3

LMN V3 is a local-first knowledge workspace in which **Knowledge is semantic identity** and **Structure is a reusable, nestable and optionally executable formal system**. LMN 4–3–2 is now one built-in Structure Template—not a mandatory container created for every Knowledge.

## V3 capabilities

- Create UUID-based Knowledge without automatically creating an LMN or any other Structure.
- Insert multiple Structure Instances into one Knowledge and bind a Slot to Knowledge, values, variables or another heterogeneous Structure.
- Use built-in LMN 4–3–2, directed/undirected graphs, Tree, Poset/Hasse, Mod‑12, two/three-set Venn, Cartesian coordinates and custom structures.
- Use the expanded geometry/algebra library: parameterized regular n-gons, cyclic groups `Zₙ`, finite Cayley operation tables and vector-space bases.
- Edit parameters and run dependency-ordered JSON-AST rules without `eval` or `new Function`; errors remain visible in runtime state.
- Search text, formal Structure semantics and edge patterns.
- Migrate V2 Root LMNs to LMN Structure Instances non-destructively while preserving UUIDs and a legacy copy.
- Export/import a complete `schemaVersion: 3` bundle.
- Work in the same UI on GitHub Pages/PWA and in a real, independent Windows WebView2 window.

## Repository map

```text
apps/web                 V3 browser/PWA shell and IndexedDB adapter
apps/desktop             native WebView2 host, build and Setup.exe source
packages/domain          Knowledge and Relation identity
packages/structure-engine templates, instances, bindings, evaluator, migration
packages/search-engine   text / structure / pattern search
packages/persistence     repository boundaries
packages/ui              canvas renderer and workspace controller
docs/schema              V3 schema contract
tests                    domain, engine and browser acceptance checks
```

See [V3 architecture](docs/architecture-v3.md), [Structure schema](docs/schema/structure-schema-v3.md), [migration](docs/migration-v2-v3.md), and the [pre-implementation product specification](docs/v3-implementation-plan.md).

## Develop and test

Node.js 18+ is required for unit tests. Serve the repository root (not only `apps/web`) because browser modules are shared from `packages/`.

```bash
npm test
npm run web
```

Then open `/apps/web/`.

## Windows build

```powershell
powershell -ExecutionPolicy Bypass -File apps/desktop/build.ps1
```

The build pins Microsoft WebView2 SDK `1.0.4129.50`, downloads it from the official NuGet feed, and produces:

```text
outputs/windows/portable/LMN.exe
outputs/windows/LMN_x64_Setup.exe
```

`LMN.exe` is a native WinForms host with an embedded WebView2 control and a stable local virtual origin. It does not start a localhost server or open the default browser. Current Windows installations normally include the WebView2 Runtime.

## Deployment

Pushes to `master` run tests, build the Windows artifact, and deploy `apps/` plus `packages/` to GitHub Pages. The deployed application entry is `/apps/web/`. Cache generation is V3-specific, so the service worker replaces V2 assets after reload.

## Security and data

- No arbitrary JavaScript execution is used for Structure rules.
- Knowledge, Relations and Structure bindings are semantic data; zoom, pan and layout offsets are presentation data.
- Deleting a Relation never deletes endpoint Knowledge.
- V2 migration preserves old Knowledge/Relation/LMN UUIDs and leaves legacy stores intact.
- IndexedDB and the desktop WebView2 profile are local to the user.
