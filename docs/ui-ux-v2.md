# LMN Workspace UI/UX V2

## Outcome

V2 replaces the separate Text, Graph, LMN and Structure pages with one recursive LMN Workspace. Every named Knowledge owns a strict Root LMN. Notes, free Relations and formal Representations are edited around that canvas and never compete as primary destinations.

## Information architecture

The app shell is a stable three-pane workspace: compact Knowledge Explorer, dominant LMN Canvas, and four-tab Inspector. The top bar contains browser-like history, recursive Breadcrumb, command search and a small set of global actions. The status bar carries Recursive Depth, selection, UUID and autosave state.

## Workspace wireframe

```text
┌ Logo ─ Back/Forward ─ Recursive Breadcrumb ─ Search ─ View/Connect/Export ┐
├ Explorer ──────────────── LMN Canvas ─────────────────────── Inspector ──┤
│ Recent                     L        M        N               Info         │
│ Favorites                  L1       M1       N1              Relations    │
│ Orphans                    L2       M2       N2              Presentation │
│ All                        L3       M3                       Notes         │
│                            L4                                      │
└ Recursive Depth ─ Path ─ Selection ─ UUID ─ Autosave ────────────────────┘
```

## Component and state model

`AppShell` owns `Topbar`, `Explorer`, `Workspace`, `Inspector`, `Statusbar`, `CommandPalette`, `InlinePicker`, `ContextMenu`, and risk-only dialogs. Semantic stores remain Knowledge, Relation, Representation, LMN and Structure. Session state separately stores navigation stacks, path, selection, zoom, pan, presentation, expanded children, visibility settings and undo/redo snapshots. Layout offsets and visibility never mutate semantic edges.

## Position and relation behavior

Position Cards have Empty, Referenced, Focused and Selected states. They show typed bilingual position metadata, referenced Knowledge, summary, relation count and recursion indicator. Single click selects, Shift-click multi-selects, double-click enters, Space expands in place, drag changes only presentation offset, and right-click opens an operation menu. Theory edges and free Relation overlays render separately; hovering attenuates unrelated nodes and edges. Connect Mode chooses source and target without a blocking form.

## Inspector

- Information: name, summary, current Position, relation counts, reference impact and weak UUID metadata.
- Relations: incoming, outgoing and LMN references with navigation and context actions.
- Presentation: LMN, Free Graph, Tree, Mind Map, Hasse, Hierarchy and Timeline plus visibility/layout parameters.
- Notes: GoodNotes-inspired Edit, Preview and Split modes with Markdown/LaTeX-aware preview and autosave.

## Recursion and zoom

Breadcrumb entries retain the Knowledge and the Position used to reach it. Back/Forward are independent. Expand in Place creates a reduced Child LMN and rejects cyclic duplicate expansion using the current path and expansion set. Semantic Zoom changes card density at 25%, 50%, 100% and 200% thresholds rather than merely shrinking text.

## Design system and responsive behavior

The warm paper background is `#FAFAF7`. Layer uses `#2F7658`, Mediation `#C8922E`, and Nexus `#7657A8`. Components use the 4/8/12/16/24/32 spacing scale, 8–12px radii, subtle shadows and 150–220ms transitions. Below 1100px, Explorer and Inspector become overlay panels while the Canvas remains primary.

## Compatibility

V2 keeps schema version 1. Startup performs a non-destructive compatibility migration by creating Root LMNs only for Knowledge records missing one. Existing UUIDs, Relations, LMN references, Representations and exports remain valid.
