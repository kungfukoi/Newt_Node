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

Measured for package version `3.0.0-beta.0` on `main`, using `npm.cmd run build` and `npm.cmd run bundle:report` on 2026-08-28. Branch names are not part of the performance contract; refresh this snapshot after architecture or loading changes.

| Area | Current behavior |
| --- | --- |
| Initial shell | `src/main.jsx`, core React, icons, and global CSS are referenced by `dist/index.html`. |
| Node editor | `src/NodeEditor.jsx`, React Flow, node bodies, runners, and editor CSS load through the lazy node-editor boundary after the user enters Nodes. |
| Stats dashboard | `src/StatsDashboard.jsx` is loaded through `React.lazy`. |
| Settings page | `src/SettingsPage.jsx` is loaded through `React.lazy`. |
| Edit node controls | Edit effect UI and live preview state are part of the lazy node editor chunk; effect definitions live in `src/editEffects.js`. |
| Generation progress | Progress aggregation, polling, and node UI are part of the lazy node editor path; the initial shell does not load them. |
| Color ID to Matte controls | `src/components/ColorIdMatteControls.jsx` loads only when the relevant Utility controls render. |
| 3D result viewer | `src/components/Model3DViewer.jsx` loads only when a 3D preview/result renders. |
| Three.js runtime | `vendor-three` is generated as an async chunk from `src/threeRuntime.js`; it is not referenced by `dist/index.html`. |

Recent production build summary:

| Asset | Role | Size | Gzip |
| --- | --- | ---: | ---: |
| `index.html` | document | 0.66 kB | 0.36 kB |
| `assets/index-*.js` | entry script | 70.71 kB | 23.87 kB |
| `assets/index-*.css` | entry style | 26.06 kB | 5.50 kB |
| `assets/vendor-icons-*.js` | modulepreload | 22.26 kB | 7.17 kB |
| `assets/vendor-react-*.js` | modulepreload | 188.00 kB | 58.94 kB |
| `assets/NodeEditor-*.js` | lazy editor chunk | 909.03 kB | 249.03 kB |
| `assets/NodeEditor-*.css` | lazy editor style | 170.33 kB | 28.75 kB |
| `assets/vendor-*.js` | lazy shared/editor vendor | 175.46 kB | 57.52 kB |
| `assets/vendor-*.css` | lazy shared/editor vendor style | 15.50 kB | 2.61 kB |
| `assets/Model3DViewer-*.js` | lazy 3D viewer | 4.65 kB | 2.10 kB |
| `assets/ColorIdMatteControls-*.js` | lazy Utility controls | 13.35 kB | 3.38 kB |
| `assets/openAiImage2-*.js` | lazy OpenAI Image 2 helper | 4.23 kB | 1.63 kB |
| `assets/SettingsPage-*.js` | lazy Settings page | 19.59 kB | 6.03 kB |
| `assets/StatsDashboard-*.js` | lazy Stats page | 25.55 kB | 7.98 kB |
| `assets/vendor-three-*.js` | lazy Three.js runtime | 795.88 kB | 207.12 kB |

Current totals:

- Initial shell: 307.68 kB, 95.84 kB gzip.
- Lazy/generated: 2133.58 kB, 566.15 kB gzip.
- All assets: 2441.26 kB, 661.98 kB gzip.

Vite currently reports the expected large-chunk warning for the node editor and Three.js runtime. Treat the editor chunk as the next code-splitting target; do not move node-editor dependencies into the initial shell to hide the warning.

## Guardrails

- Do not statically import `three`, GLTF loaders, React Flow, or node-editor-only UI into `src/main.jsx`.
- Keep Settings, Stats, 3D rendering, and specialist controls behind their current lazy boundaries.
- Use focused components for new heavy UI surfaces so future lazy boundaries remain practical.
- Treat bundle size, interaction latency, media decode cost, and graph stability as separate measurements. A smaller bundle does not excuse dropped nodes or broken edges.
- Refresh this baseline from `bundle:report`; do not hand-copy Vite's decimal-kB values because the report uses binary kB consistently.

## React Flow Canvas Baseline

The current app uses React Flow for node transforms, handle geometry, selection, viewport transforms, connection gestures, and edge paths. Newt continues to own graph execution, persistence, uploads, previews, model behavior, grouping, and workflow state.

- `flowOverviewEnabled` is `false` and `flowOnlyRenderVisibleElements` is `false`. Proxy, compact, map, warm-hydration, and offscreen-culling paths are inactive.
- The canvas stays in full-detail mode from the 5% minimum zoom through the 250% maximum. Every node and edge remains mounted while panning and zooming.
- Node positions stay local during a drag and commit to Newt's persisted graph when the gesture ends, avoiding a full graph rebuild for every pointer event.
- Pan and wheel zoom update the live viewport imperatively during the gesture, then commit the final viewport. Delayed state must never snap the canvas back to an older transform.
- React Flow owns partial-overlap marquee selection and modifier-click multi-selection. Text fields and interactive controls use the no-drag boundary so selecting text does not move a node.
- Saved or estimated node dimensions and connected-handle bounds seed React Flow before measurement. Dynamic port or size changes must call the node-internals update path so edges stay attached.
- Edge strokes use screen-stable non-scaling rendering and sit behind node cards. Processing edges retain Newt's animated dash cue.
- The low-zoom canvas must not introduce raster proxy layers, grayscale bars, or remount flicker. Full node content may become visually tiny, but it remains the same node UI and graph structure.
- Mouse-wheel zoom keeps Newt's configured increment and smooth transient transform behavior. Trackpad pinch remains native and must not be converted to wheel-step zoom.
- Media regions keep `object-fit: contain`; resizing a node may add unused space but must never crop or cover the source image/video.

Validate canvas changes with a production build, the complete Node test suite, and a browser interaction pass on a production-scale workflow. Test 5%, 8%, 30%, and 100% zoom; pan repeatedly across distant regions; verify all nodes remain present, edges stay behind and attached, line weight remains stable, selection and text editing work, media stays uncropped, and the viewport never snaps back.
