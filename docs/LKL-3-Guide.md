# LKL guide

## 1. Start with a knowledge package

LKL is the knowledge exchange format for LMN. Save files with the .lkl extension. One import brings in knowledge, documents, structures and their references. Embedded images and plot definitions travel with the package.

LKL 3 is the complete archive format. Older LKL 2 knowledge packages and LKL 1 templates remain importable. The structure source editor uses the concise LKL 2 editing syntax.

1. Open the top-right menu and choose “Import package”.
2. Paste the example below, or choose a .lkl file.
3. Select “Validate preview” and review objects, errors and identity conflicts.
4. Choose merge, replacement of matching IDs, or an isolated copy; then confirm.
5. Open “Limits” in the knowledge library, edit the document, and export a complete LKL 3 archive.

## 2. A complete importable example

```lkl

lkl 3
{
  "schema": "lmn.cognitive-package/3.0",
  "package": {
    "id": "example:limits",
    "title": "My first knowledge package",
    "roots": [
      "knowledge:limits"
    ]
  },
  "records": [
    {
      "kind": "knowledge",
      "id": "knowledge:limits",
      "profile": {
        "schema": "lmn.object-profile/1",
        "kind": "knowledge",
        "id": "knowledge:limits",
        "title": "Limits",
        "summary": "",
        "version": null,
        "authors": [],
        "sources": [],
        "createdAt": null,
        "updatedAt": null,
        "evidenceStatus": "unspecified",
        "scope": "knowledge",
        "extensions": {}
      },
      "members": [],
      "data": {
        "id": "knowledge:limits",
        "title": "Limits",
        "content": "A limit describes how a function approaches a value.",
        "sources": []
      }
    }
  ]
}

```

This example creates one knowledge object. It does not invent relationships to fill a diagram. Edit data.title and data.content to change its title and text; keep the ID stable to preserve its identity.

## 3. Understand the file

- The first line, lkl 3, declares the language version. What follows is strict JSON: use double quotes and omit comments and trailing commas.
- schema identifies the archive contract: lmn.cognitive-package/3.0.
- package contains the package ID, title and root knowledge IDs. A complete workspace may have several roots.
- records contains object archives with kind, id, profile, members and data.
- profile is an information directory: identity, type, title, summary, sources, authors, versions, times, evidence state and extension metadata. Unknown sources and dates stay empty.
- members describes nested variables, containers, geometry and moving points, with paths into their complete data.
- data retains the complete runtime object, including parameters, geometry dependencies, view state, appearance and document content.

Profile sources, authors, evidence state and extension metadata must agree with data. A disagreement blocks import. Edit data.sources, data.authors or data.profile and export again to refresh the directory. Title and document edits update the title directory automatically.

Record kinds: knowledge, relation, representation, structure-template, structure-instance, variable-scheme, package, content, view, board, placement, settings.

The record kind and IDs must agree with the underlying object. References use stable IDs. Display names and canvas coordinates cannot substitute for identity. Edit mathematical definitions in the corresponding data fields.

## 4. Documents, images and live plots

All documents share one Markdown and LaTeX editor. Insert, paste or drop PNG, JPEG, WebP and GIF images up to 5 MB each. Images are embedded as portable data and do not depend on temporary file paths.

Choose “Plot” to turn the selected expression into a plot block. Preview and split modes use the vector-space renderer. For example:

```plot

z=sin(x)*cos(y)

```

Supported examples include y=sin(x), z=x^2+y^2, x=cos(t); y=sin(t), and x=u; y=v; z=u*v. The coordinate workbench also provides parameter ranges, presets, points, vectors and numerical calculations.

## 5. Choose a representation

Begin with the relationships or operations the reader needs to understand. Browse the current structure library and compare its actual parameters, mathematical constraints and interaction capabilities. No subject requires a fixed template.

Use a configured built-in structure when it can express the same objects and relationships. Directed sequence, dependency, proof and time arrangements share a directed-node family; changing labels or direction alone does not require a new custom template. Distinct mathematical operations or constraints can still require distinct models.

A centered family takes a member count and optional numbering format. Numbering identifies positions; it does not assert precedence or dependency. Matrices provide arithmetic, transpose, determinant, inverse, rank, row reduction and unique linear-system solutions. Read each model description for its supported mathematical scope.

Create a reusable custom structure only when built-in parameters, arrangement and composition cannot provide the needed representation. Keep titles and subject-specific explanations in knowledge or document objects. Keep real relationships in separately identified edges. Text explains definitions, evidence and qualifications; structures make relationships and operations visible.

## 6. Identity, location, relationships and views

Knowledge is a stable, reusable meaning unit. Documents contain definitions, proofs, examples and explanations. A relationship needs semantic evidence. A structure organizes and displays those objects.

construct assigns primary ownership; reference adds another view without duplicating identity. Search results open at the object’s canonical location. A center anchor displays its owner knowledge without creating a reverse ownership cycle.

Each relationship has its own ID, endpoints and display settings. Parallel or reverse relationships remain independent even when their endpoints match. A display label is not a global relationship definition. New nodes and edges continue the existing naming pattern when one is available.

Temporary task roles, activation scores and practice results are not objective knowledge facts. Local interface preferences are independent of knowledge exports.

## 7. Resolve import errors

- Invalid JSON: check the first line, quotes, commas and brackets.
- Missing or mismatched IDs: check roots and references from relationships, containers and views.
- Invalid mathematical parameters: check partition disjointness, permutation bijections, matrix shapes, mappings and parameter ranges.
- Identity conflicts: merge updates matching objects with incoming fields; replace replaces objects with matching IDs; copy rebuilds IDs and references. Objects absent from the package are not silently deleted.
- Import cannot commit: fix the diagnostics and validate again. Archive imports are planned first and saved as one transaction.

LKL 3 complete archives and older LKL 2 reachable knowledge packages have different purposes. Older formats may not carry every new extension field. Use LKL 3 when complete preservation is required.

Creating a copy isolates runtime IDs and legacy package namespaces. Compatible built-in templates reuse the current library without overwriting its global settings. Incompatible mathematical models stop the import.

## 8. For AI authors and developers

Before compiling, read the current published structure capability catalog and the matching runtime grammar. Compare all available families by semantic fit. Do not invent a renderer, factory or executable field, and do not select structures from a fixed subject list.

Custom templates need a non-replaceability justification against available built-in configurations. Names, subject matter and cosmetic differences are insufficient. Check both global navigation and the representation of each main knowledge object.

LKL 3 is strict data and never executes JavaScript. The schema-generated LKL 2 reference below remains useful for reading older packages and editing structure source.
