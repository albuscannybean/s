# V3 pre-implementation product specification

This document records the required pre-code analysis and the decisions used by the V3 implementation.

## 1. Existing UI problems

V2 made LMN visually strong but treated every Knowledge as an LMN owner. Generic Structures remained secondary representations, formal parameters had no common runtime, nested heterogeneous structures were not first-class, and the browser-launching desktop host was not an independent application window.

## 2. Information architecture

The first level is Workspace → Knowledge / Structures / Search. Opening Knowledge shows its list of Structure Instances; opening an Instance enters one canvas. Structure Library and Structure Builder create formal definitions/instances. Notes and Relations remain contextual inspector dimensions.

## 3. Main Workspace wireframe

```text
┌ Brand ─ Breadcrumb ─ Semantic Search ─ Insert Structure ┐
├ Explorer ┬──────────── Canvas / Instance Tabs ──────────┬ Inspector ┤
│Knowledge │  semantic nodes, edges, nested structures    │5 tabs    │
│Structures│  pan · zoom · focus · executable feedback    │          │
└──────────┴───────────────────────────────────────────────┴──────────┘
```

## 4. Component tree

`AppShell` owns `TopBar`, `Explorer`, `Workspace`, `Inspector`, dialogs and `StatusBar`. `Workspace` owns `InstanceTabs`, `CanvasViewport`, `StructureRenderer` and `NestedPreview`. The renderer owns layout-specific views but all consume the same Slot contract.

## 5. State model

Semantic state: Knowledge, Relation, StructureTemplate, StructureInstance, Binding, parameter values and rule results. Presentation state: selected slot, active instance, pan, zoom, focus mode and visual offsets. Navigation state stores Knowledge, nested Structure path and inspector tab.

## 6. Structure Position / Slot specification

A Slot has immutable template identity, label, role, semantic coordinate, accepted target types and cardinality. Empty/selected/nested visual states are shared across layouts. Click selects and opens contextual binding when empty; double click enters a nested Structure.

## 7. Relation interaction specification

Template Edges are formal and direction-aware; Knowledge Relations stay independent. Binding a Knowledge does not synthesize a Relation. Edge search uses relation type, direction and endpoint roles. Future drag-connect operations must choose explicitly between Template editing and free Knowledge Relation creation.

## 8. Inspector specification

Five stable tabs: Semantics, Relations, Rules, Notes, Appearance. Semantics edits Knowledge identity/summary or describes Slot coordinates. Rules edits typed parameters and reports deterministic results/errors. Appearance never mutates semantic bindings.

## 9. Recursive navigation specification

A Slot may bind another Structure Instance. Entering it appends a breadcrumb step; the child retains its own Template/runtime. Cycle detection prevents a Structure from becoming its own descendant. The status bar names this `Recursive Depth`.

## 10. Structure / Representation specification

Structure is no longer a display mode for LMN. A Template defines formal semantics; an Instance binds actual targets. Layout is only one part of the Template/Instance presentation. Multiple Instances can belong to one Knowledge, and standalone Instances are allowed.

## 11. Semantic zoom specification

The canvas supports 25–250% zoom. At current V3 scope, the layout remains readable through geometric scaling; renderer hooks keep semantic labels separate so density-aware visibility can be extended without changing Structure data.

## 12. Design tokens

Warm paper background `#FAF9F5`, white surface, quiet green `#2F7658`, amber `#C8922E`, violet `#7657A8`, blue structural accent, 7/11/16 px radii, subtle three-level shadows, 150–220 ms transitions, Segoe UI / Microsoft YaHei UI / Inter stack.

## 13. Responsive strategy

At ≤1100 px Explorer and Inspector become off-canvas panels while the canvas remains primary. At ≤700 px top-level secondary controls hide, library cards become one column, and the canvas keeps a minimum semantic working width with pan enabled.

## 14. Removed old components

The V2 monolithic `app.js` state machine, implicit Root LMN creation path, localhost desktop server, default-browser launch flow and V2 service-worker cache are removed.

## 15. Refactored components

IndexedDB is upgraded to schema 3; workspace navigation is instance-based; LMN rendering uses the generic Structure renderer; import/export uses V3 bundles; search is split into text/structure/pattern engines; Windows packaging becomes WebView2 + Setup.

## 16. Reused components

Knowledge/Relation UUID identity, graph cycle utilities, Hasse transitive reduction, local-first IndexedDB persistence, three-pane visual language, autosave feedback, focus mode and shared Web/PWA asset delivery remain reusable foundations.
