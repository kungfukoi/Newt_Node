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

Measured on Windows with Node 22.16.0 on 2026-10-15 from checkout 4.5.0-beta.0, using an isolated fresh Vite output directory and the existing reportBundle.mjs against that directory. A concurrent uncommitted Character change was present during measurement; these sizes describe that local source snapshot, not a published artifact.

| Area | Current behavior |
| --- | --- |
| Initial shell | `src/main.jsx`, core React, icons, and global CSS are referenced by `dist/index.html`. |
| Node editor | `src/NodeEditor.jsx`, React Flow, node bodies, runners, and editor CSS load through the lazy node-editor boundary after the user enters Nodes. |
| Stats dashboard | `src/StatsDashboard.jsx` is loaded through `React.lazy`. |
| Settings page | `src/SettingsPage.jsx` is loaded through `React.lazy`. |
| Edit node controls | Edit effect UI and live preview state are part of the lazy node editor chunk; effect definitions live in `src/editEffects.js`. |
| Character sheet library | Character library normalization, selection, and downstream-reference helpers load inside the lazy node editor boundary; they do not increase the initial shell. |
| Generation progress | Progress aggregation, polling, and node UI are part of the lazy node editor path; the initial shell does not load them. |
| Color ID to Matte controls | `src/components/ColorIdMatteControls.jsx` loads only when the relevant Utility controls render. |
| 3D result viewer | `src/components/Model3DViewer.jsx` loads only when a 3D preview/result renders. |
| Three.js runtime | `vendor-three` is generated as an async chunk from `src/threeRuntime.js`; it is not referenced by `dist/index.html`. |

Single-build asset summary (reportBundle.mjs units; hashes omitted):

| Asset | Role | Size | Gzip |
| --- | --- | ---: | ---: |
| index.html | document | 0.66 kB | 0.36 kB |
| assets/index-*.js | entry script | 129.78 kB | 42.31 kB |
| assets/index-*.css | entry style | 29.83 kB | 6.05 kB |
| assets/vendor-icons-*.js | modulepreload | 27.54 kB | 8.61 kB |
| assets/vendor-react-*.js | modulepreload | 188.00 kB | 58.94 kB |
| assets/ColorIdMatteControls-*.js | lazy/generated | 13.31 kB | 3.36 kB |
| assets/ExploreNodeBody-*.js | lazy/generated | 12.06 kB | 4.21 kB |
| assets/ExploreNodeBody-*.css | lazy/generated | 5.64 kB | 1.61 kB |
| assets/imageEditorPreference-*.js | lazy/generated | 0.43 kB | 0.30 kB |
| assets/ImageEditStudio-*.css | lazy/generated | 10.07 kB | 2.74 kB |
| assets/ImageEditStudio-*.js | lazy/generated | 52.82 kB | 18.24 kB |
| assets/Model3DViewer-*.js | lazy/generated | 4.62 kB | 2.08 kB |
| assets/NodeEditor-*.css | lazy/generated | 189.66 kB | 32.26 kB |
| assets/NodeEditor-*.js | lazy/generated | 1186.19 kB | 336.43 kB |
| assets/SettingsPage-*.js | lazy/generated | 33.96 kB | 9.90 kB |
| assets/StatsDashboard-*.js | lazy/generated | 27.27 kB | 8.94 kB |
| assets/StatsDashboard-*.css | lazy/generated | 7.40 kB | 2.07 kB |
| assets/vendor-*.js | lazy/generated | 175.46 kB | 57.52 kB |
| assets/vendor-*.css | lazy/generated | 15.50 kB | 2.61 kB |
| assets/vendor-three-*.js | lazy/generated | 795.88 kB | 207.12 kB |

Single-build totals:

- Initial shell: 375.80 kB (116.27 kB gzip)
- Lazy/generated: 2530.27 kB (689.39 kB gzip)
- All assets: 2906.07 kB (805.66 kB gzip)

Production builds intentionally set emptyOutDir: false so already-open windows can request prior hashed chunks. The ordinary bundle:report command counts every file retained in dist; its lazy/all-assets aggregate is accumulated disk usage, not the current build payload. Do not delete active dist assets to measure a release. Use a new isolated output directory and run the report with that directory as its working root (it expects dist/index.html).

Vite still reports expected large chunks for the node editor and Three.js. These measurements do not change the lazy-loading contract or establish a new pass/fail threshold. The dated September timing benchmarks below remain historical, not freshly rerun values.

## Guardrails

- Do not statically import `three`, GLTF loaders, React Flow, or node-editor-only UI into `src/main.jsx`.
- Keep Settings, Stats, 3D rendering, and specialist controls behind their current lazy boundaries.
- Use focused components for new heavy UI surfaces so future lazy boundaries remain practical.
- Treat bundle size, interaction latency, media decode cost, and graph stability as separate measurements. A smaller bundle does not excuse dropped nodes or broken edges.
- Refresh this baseline from `bundle:report`; do not hand-copy Vite's decimal-kB values because the report uses binary kB consistently.

## React Flow Canvas Baseline

Canvas grid painting lives in an `aria-hidden`, noninteractive `.canvas-grid` leaf beside React Flow. Navigation updates its ordinary background styles; it must not write inherited viewport/grid custom properties on `.node-canvas`. Those inherited changes previously invalidated styles throughout every fully mounted node on each motion frame. React Flow continues to own the viewport transform, and nodes, media, ports, and wires retain full detail.

The React Flow viewport keeps `will-change: auto` at rest and during navigation. Do not toggle forced compositor promotion with `is-navigating`: allocating and discarding the large canvas layer can cause visible flashing on some GPUs. The browser still manages compositing for the transformed viewport. The small stationary left toolbar has its own persistent transformed layer, with menu overflow preserved. The media/navigation browser tests exercise first zoom-out, return zoom, and settled frames while checking this stable hint policy; actual GPU flashing still requires verification on the affected device.

Settings > User Preferences > Canvas shadows controls node/group shadows and selected-wire glow immediately, defaults to on, and persists locally as `newt.canvasShadows`. Turning it off preserves selected borders and wire colors. Shadows no longer switch automatically at the former 13%/17% distant-zoom boundary. Grid visibility instead varies continuously from zero at 10% zoom to full opacity at 20%, updating only the grid leaf; it does not toggle a style class on the whole canvas. Shadow cost varies with the graph, zoom, and GPU; this setting is not a promised FPS increase.

The October 28 isolated Pepsi_Create_Footage snapshot contained 82 nodes and 79 edges. With generated test media, mocked APIs, Chromium headless, and 4x CPU throttling, the same 120-frame pan/zoom sequence measured 18.60 s of style recalculation before this change and 0.18–0.57 s across two runs after; median frame interval changed from 333 ms to 150–167 ms (p95 383 ms to 183–200 ms). This is a controlled comparison with one baseline and two optimized runs, not a laptop FPS guarantee or real-media decode measurement. Remaining rendering cost still matters.

After stabilizing the compositor policy and toolbar layer, the same isolated Pepsi benchmark measured a 50 ms median frame interval and 83 ms p95 with shadows both on and off (one run each, 4x CPU throttling). Style recalculation remained 0.15–0.16 s across 120 frames. This follow-up preserves the earlier optimization and shows no measurable shadow benefit on this runner; compare on the affected laptop rather than attributing the improvement to disabled shadows.

`e2e/canvas-navigation-performance.spec.js` records frame intervals and Chromium task/style/layout metrics on a 271-node fixture and checks grid alignment with React Flow. Set `NEWTNODE_BENCHMARK_GRAPH` to a local sanitized draft JSON to repeat with another graph; the fixture helper intercepts APIs and test media. Set `NEWTNODE_BENCHMARK_SHADOWS=off` to compare shadows disabled. Local workflow snapshots must stay outside the repository. `NEWTNODE_BENCHMARK_BASELINE=1` skips the new grid-structure assertions for measuring the prior implementation. Timing values are diagnostic; the regression assertion checks isolation rather than a machine-dependent FPS threshold.

Preview result-strip videos use lazy still posters through the existing cached `/api/video-poster` route. The original video remains the selector/drag source and the active viewer remains a real player. A five-gallery fixture with 61 results previously mounted 71 video elements; it now mounts 10 players and 61 poster images, eliminating 61 thumbnail player instances. This is a media-element count, not a measured FPS improvement on every device. Failed posters show a film placeholder without allocating a player.

The canvas motion callback paints within its existing animation frame instead of scheduling a second frame. Easing coefficients, momentum, reduced-motion behavior and the saved Smooth canvas motion preference are unchanged. Direct pointer updates continue to coalesce into a frame. Browser regression checks assert visible movement on the first motion frame with the preference both on and off, as well as original-video selection/drag payloads and poster failure behavior. See `e2e/canvas-media-performance.spec.js`.

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

Validate canvas changes with a production build, the complete Node test suite, and a browser interaction pass on a production-scale workflow. Test 5%, 8%, 15%, 30%, and 100% zoom; pan repeatedly across distant regions; verify all nodes remain present, edges stay behind and attached, line weight remains stable, selection and text editing work, media stays uncropped, and the viewport never snaps back.

## September Reliability Optimizations

- `workflowState.js` reuses serialization for unchanged immutable objects while producing the same persisted-content fingerprint, including undo-to-saved correctness.
- `flowNodeConnections.js` caches topology until node IDs or edges change. Input data references still refresh connected viewers immediately; unrelated arrays retain identity.
- `flowNodeGeometry.js` coalesces real card/port changes into one animation-frame measurement and ignores progress-only mutations. No nodes are hidden to achieve this.
- The rail requests permanent catalog pages and cached video posters. It preserves older pages and proportional single-column layout on refresh. Rail-only virtualization remains a possible later optimization, not an enabled behavior.
- Durable job writes update one checkpoint instead of rewriting all historical specifications. Unchanged heartbeat disk writes are coalesced to 30 seconds, while acceptance and completion persist immediately. Scoped cursor polling and shared status reads reduce duplicate traffic.
- Selected-node/provider admission and FFmpeg budgets bound competing work. API/control listeners remain one process; the second port is not event-loop isolation.

### Reproducible Budget

Run `npm run test:performance`. On this Windows machine with Node 22.16.0, the 2026-09-04 fixed-fixture run measured:

| Nodes | Persisted bytes | Full-clone reference median | Warm cached median |
| ---: | ---: | ---: | ---: |
| 271 | 1,713,427 | 5.429 ms | 0.255 ms |
| 600 | 3,794,101 | 10.927 ms | 0.547 ms |

The script checks exact equality against the full-clone reference, a single-node edit, and undo. Each median uses 21 samples. The enforced budget is cached time below 40% of the full-clone reference on the same runner, not a fixed machine-dependent millisecond threshold. Cold serialization still processes the whole document. This is not an FPS or end-to-end zoom-speed claim.

### Browser Regressions

After a build and `npx playwright install chromium`, run `npm run test:browser`. Fixtures include 271 full-detail nodes at all five zoom levels, attached edge endpoints within 2 screen pixels after pan/zoom, live node/text resizing, immediate multi-select/copy/paste, proportional rail posters and page refresh, generation-to-Preview propagation, Save As/reload, inline recovery, opt-in diagnostics, and actual decoded Timeline pixels changing on scrub without turning black after an Out marker.

All media is generated locally and all provider APIs are mocked. The suite guards measurable interactions, not every GPU/driver condition or perceptual frame pacing. Use Settings > Diagnostics for opt-in long-task, decode/drop, and event-loop measurements when profiling a real workflow. Windows/macOS CI runs the same fixtures; native dialogs and paid generations require separate authorized verification.

### Open-window build compatibility

Production builds retain existing hashed assets in `dist/assets` so windows opened before a rebuild can still load Settings and editor chunks. Bundle reports include retained assets; remove dist only when all app windows are closed if measuring a clean-build baseline. Retained chunks consume disk space but are not eagerly loaded.
