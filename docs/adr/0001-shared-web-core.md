# ADR 0001: Shared Web core with a thin Windows host

Status: Accepted

Use standards-based ES modules, SVG, IndexedDB and a service worker for the product core. The Windows host is a small ASP.NET loopback server that packages the identical assets. This maximizes code sharing, supports offline work, avoids two domain models, and keeps the desktop shell replaceable by WebView2 or Tauri later without a data-model rewrite.
