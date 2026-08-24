# ADR 0003: WebView2 desktop host

Status: accepted

## Decision

Use the official Microsoft WebView2 WinForms control with packaged local assets and a stable virtual HTTPS origin. Build a per-user Setup executable that installs the portable payload, shortcuts and an uninstall entry.

## Context

V2 launched the default browser from an embedded localhost server. V3 requires a truly independent Windows window and an installable `.exe`. The available build environment has the .NET Framework compiler and the Windows WebView2 Runtime, but not Rust/Tauri or third-party installer compilers.

## Consequences

- The UI and Structure Engine remain identical on Web and Windows.
- IndexedDB works under a stable origin and no listening TCP port is created.
- The build downloads a pinned official WebView2 SDK package; the evergreen Runtime must exist on the user machine.
- Future code signing remains a release-pipeline concern.
