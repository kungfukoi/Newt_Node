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
| Color ID to Matte controls | `src/components/ColorIdMatteControls.jsx` is loaded only when the relevant utility controls render. |
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

## React Flow Canvas Baseline

The `dev` branch uses React Flow as the node canvas runtime while Newt continues to render the existing node bodies and owns graph execution, persistence, uploads, previews, and model behavior.

- React Flow owns node transforms, handle geometry, selection, viewport transforms, connection gestures, and edge paths.
- Node positions stay local during a drag and commit to Newt's persisted graph once when the gesture ends, avoiding full graph rebuilds for every pointer event.
- Semantic compact and map proxy modes are disabled. React Flow keeps the complete node UI mounted at every zoom level; below `0.15`, the sub-pixel dot grid and mouse-wheel transform easing are disabled to prevent distant-view raster artifacts. With proxies off, navigation also skips warm-node hydration bookkeeping so mounted node bodies remain stable.
- Compact and map views draw the complete workflow in one high-DPI Canvas 2D layer. Every node, group, and connection remains visible without creating hundreds of React node bodies.
- Overview labels and edge widths use screen-space values. Hover or selection shows the full node title, and double-click focuses a node at working zoom.
- Selection has one owner per render mode: React Flow handles partial-overlap marquee and modifier-click selection in detail mode; the overview canvas handles additive marquee and modifier-click toggling in compact and map modes. Do not run the legacy NodeEditor marquee alongside either renderer.
- Detail view keeps lightweight React Flow geometry shells mounted instead of repeatedly destroying and recreating offscreen nodes while panning.
- Full node bodies hydrate inside a viewport buffer. Recently visited bodies stay warm for a bounded period, avoiding reload pauses when the user pans back while limiting media and editor cost.
- Saved or estimated node dimensions and connected-port bounds seed React Flow before the first full render, so connection geometry is stable before node controls hydrate.
- Port positions come from React Flow handles; the former canvas-wide DOM port sweep and independent edge transform are bypassed.
- Nodes that first enter view during an active pan or zoom use a lightweight geometry placeholder and hydrate their complete Newt UI when the gesture ends. Nodes already visible remain mounted throughout the gesture.
- Transient pan and zoom updates the React Flow transform and the overview canvas directly; graph state commits after the gesture instead of on every pointer event.
- Edge strokes use `vector-effect: non-scaling-stroke` so visual weight stays stable through zoom. Processing edges retain Newt's animated dash cue.
- Newt's existing mouse-wheel increment, trackpad pinch, zoom controls, context menus, grouping, node resize, and node-specific UI remain the source of behavior.

Validate this path with a production build, the complete Node test suite, and a browser interaction pass that drags a node, pans and zooms through both semantic thresholds, verifies all distant nodes redraw immediately, confirms an attached edge at each step, and confirms visible edge width remains constant.
