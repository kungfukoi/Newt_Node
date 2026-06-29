# NewtNode Performance

This document captures the current startup and bundle-loading shape so optimization work stays measurable. Update it when a pass deliberately changes startup loading, code splitting, or heavy runtime ownership.

## How To Measure

Run a production build, then summarize the emitted `dist/` assets. Use the platform-native npm command so Windows and macOS checks measure the same build.

Windows PowerShell:

```powershell
npm.cmd run build
npm.cmd run bundle:report
```

macOS/Linux:

```bash
npm run build
npm run bundle:report
```

`bundle:report` classifies assets referenced by `dist/index.html` as the initial shell and everything else as lazy/generated. It reports raw and gzip sizes.

With the dev server running, smoke the browser shell and API health route:

Windows PowerShell:

```powershell
npm.cmd run smoke:app
```

macOS/Linux:

```bash
npm run smoke:app
```

The smoke harness fetches the client HTML, its referenced module/style assets, and `/api/health`. Override `NEWT_SMOKE_CLIENT_URL` or `NEWT_SMOKE_API_URL` when testing a non-default port.

## Current Baseline

Measured for `v3.0.0-beta.0` on `main` after adding Edit node live previews, using `npm.cmd run build` and `npm.cmd run bundle:report`.

| Area | Current behavior |
| --- | --- |
| Initial shell | `src/main.jsx`, core React, shared vendor, icons, and global CSS are referenced by `dist/index.html`. |
| Node editor | `src/NodeEditor.jsx` is loaded through `React.lazy` after the user enters the node workspace. |
| Stats dashboard | `src/StatsDashboard.jsx` is loaded through `React.lazy`. |
| Settings page | `src/SettingsPage.jsx` is loaded through `React.lazy`. |
| Edit node controls | Edit effect UI and live preview state are part of the lazy node editor chunk; local effect definitions live in `src/editEffects.js` and do not add to the initial shell. |
| Color ID matte controls | `src/components/ColorIdMatteControls.jsx` is loaded only when the relevant utility controls render. |
| 3D result viewer | `src/components/Model3DViewer.jsx` is loaded only when a 3D preview/result renders. |
| Three.js runtime | `vendor-three` is generated as an async chunk from `src/threeRuntime.js`; it is not referenced by `dist/index.html`. |

Recent production build summary:

| Asset | Role | Size | Gzip |
| --- | --- | ---: | ---: |
| `index.html` | document | 0.73 kB | 0.37 kB |
| `assets/index-*.js` | entry script | 38.81 kB | 13.28 kB |
| `assets/index-*.css` | entry style | 18.54 kB | 4.34 kB |
| `assets/vendor-*.js` | modulepreload | 3.53 kB | 1.54 kB |
| `assets/vendor-react-*.js` | modulepreload | 184.32 kB | 57.63 kB |
| `assets/vendor-icons-*.js` | modulepreload | 14.08 kB | 4.74 kB |
| `assets/NodeEditor-*.js` | lazy editor chunk | 387.24 kB | 104.75 kB |
| `assets/NodeEditor-*.css` | lazy editor style | 84.84 kB | 14.94 kB |
| `assets/Model3DViewer-*.js` | lazy 3D viewer chunk | 3.53 kB | 1.64 kB |
| `assets/ColorIdMatteControls-*.js` | lazy utility chunk | 12.92 kB | 3.27 kB |
| `assets/SettingsPage-*.js` | lazy settings chunk | 9.08 kB | 2.89 kB |
| `assets/StatsDashboard-*.js` | lazy stats chunk | 19.65 kB | 6.64 kB |
| `assets/vendor-three-*.js` | lazy Three.js runtime | 761.25 kB | 198.57 kB |

Current totals:

- Initial shell: 260.00 kB, 81.90 kB gzip.
- Lazy/generated: 1278.51 kB, 332.70 kB gzip.
- All assets: 1538.51 kB, 414.60 kB gzip.

## Guardrails

- Do not statically import `three`, GLTF loaders, or viewer-only Three UI into `src/main.jsx` or common preview modules.
- Keep heavy node controls behind `React.lazy` when they are not common to normal canvas startup.
- Use focused components for new heavy UI surfaces so future lazy boundaries are easy to place.
- Treat bundle-size changes as a signal to inspect loading behavior, not as the only performance measure.
