# Contributing

This repository builds M System as a browser application. Keep changes focused on the shared web runtime; preserve stable object IDs, content ownership, relation endpoints, and LKL compatibility. Titles and screen coordinates are not object identities.

Use Node.js 20 or newer. Run `npm install`, then `npm run build:web` to regenerate public contracts and offline assets. Do not hand-edit generated files. Run `npm test` after changes; add focused regressions for mathematical, persistence, ownership, or import/export behavior.

For UI and navigation changes, start `node tests/local-server.mjs 4174` and run the four browser suites listed in [README.md](README.md). CI uses the same suites. Inspect the relevant screenshots and failures once, then repeat only the checks affected by a fix.

Global design settings override local appearance settings. Keep structure-library previews schematic and mathematical meaning in the shared model. Destructive user actions require an impact preview, confirmation, and a working undo action.

Open a pull request describing the user-visible problem, resulting behavior, and validation. Pages deployment is web-only; no Windows build is required. Preserve historical data adapters and regression tests unless an explicit migration replaces them.
