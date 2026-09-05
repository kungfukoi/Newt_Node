# NewtNode Architecture

This document is the descriptive map of the current NewtNode implementation. `node-standards.md` remains the normative contract. Snapshot verified against package version `3.0.0-beta.0` on 2026-09-04.

## Runtime Shape

NewtNode is a local-first React application backed by a local Express service.

| Surface | Default | Owner |
| --- | --- | --- |
| Vite client | `http://127.0.0.1:5176` | `src/main.jsx`, `vite.config.js` |
| Main API | `http://127.0.0.1:3336` | `server/index.js` |
| Control API | `http://127.0.0.1:3337` | `server/index.js`, `server/routes/core.js` |
| ComfyUI API | `http://127.0.0.1:8188` | external ComfyUI, configured by Settings/environment |
| MiniMax H3 SGLang API | `http://127.0.0.1:30010` | optional external local inference service |

The client uses the control lane for Settings, file dialogs, workflow control, update, restart, and durable-job tracking requests. Vite proxies `/api/system` and `/api/saved-workflows` to the control port; generation, uploads, outputs, workflow assets, and most `/api` routes use the main API port. Both listeners share one Node process: the control lane separates HTTP traffic, not CPU or event-loop work.

All ports are configurable. Keep client, server, launchers, health checks, smoke tests, and Vite proxy rules aligned when changing them.

## Application Shell

`src/main.jsx` owns the top-level Image, Video, Nodes, Stats, and Settings workspaces. The node editor, Stats dashboard, and Settings page are lazy-loaded so the initial shell does not absorb editor-only or Three.js code.

The Nodes workspace is coordinated by `src/NodeEditor.jsx`. It owns live graph orchestration, node rendering selection, connection coordination, and current node defaults/normalization. It is not the preferred home for reusable algorithms, provider schemas, media utilities, or static option catalogs.

## Graph And Canvas

- `src/nodeRegistry.js` is the canonical catalog and menu order.
- `src/components/NewtFlowCanvas.jsx` adapts Newt graph state to React Flow.
- `src/components/NewtFlowContext.jsx` exposes React Flow coordination to node bodies and shared controls.
- `src/flowOverview.js` owns overview/proxy feature flags. Full-detail mode is the current product contract.
- `src/nodeGeometry.js` owns bounds, dimensions, rectangles, viewport math, menu placement, and related pure geometry.
- `src/workflowState.js` owns graph cloning, normalization helpers, id remapping, and stale runtime cleanup.

React Flow owns viewport transforms, selection, movement, handles, and edge paths. Newt owns persisted graph data, execution, media, node semantics, workflow packages, and results. Do not create a competing transform or edge system in a feature component.

Stable opaque node ids are the graph identity. Titles are editable display metadata. Edges, groups, `@` bindings, Output routing, dependencies, and copied graph remapping must resolve by id.

`workflowState.js` caches persisted serialization by immutable node/edge/group references. Unchanged objects reuse their serialized fragments; undo still compares document content, not a monotonically increasing edit counter. `flowNodeGeometry.js` observes actual card/port layout changes and coalesces handle measurements per animation frame. Progress-only mutations do not invalidate all handle geometry.

## Node Lifecycle

A complete node type normally spans:

1. Catalog definition in `src/nodeRegistry.js` and an icon mapping in `NodeEditor.jsx`.
2. Port config, defaults, and backward-compatible normalization.
3. Connection validation and auto-connect behavior.
4. A node body under `src/components/` or a focused shared component.
5. Run scheduling in `src/nodeRunner.js` and focused request/result code under `src/nodeRunners/`.
6. Browser route wrappers in `src/api/newtApi.js` and server routes/engines.
7. Shared result, preview, Output, history, Stats, and progress integration.
8. Persistence, clipboard/import, package, and migration coverage.

Static callable labels, durations, aspect ratios, utility descriptions, and model controls live in `src/modelOptions.js`. Edit effect definitions live in `src/editEffects.js`. Exact labels can be persisted data, so renames require compatibility handling.

## Generation Flow

The normal remote-generation path is:

1. `NodeEditor.jsx` gathers connected, referenced, and local node inputs.
2. `src/nodeRunner.js` schedules dependencies and batch state.
3. A focused runner under `src/nodeRunners/` builds the normalized request.
4. `src/api/newtApi.js` calls a local `/api/node/...` route.
5. The server validates inputs, resolves local assets, applies the selected credential/provider route, and submits work.
6. Generated provider media is downloaded or copied into managed local storage.
7. The server returns a small typed result and records reproducible history/cost metadata.
8. `src/mediaResults.js` updates result arrays; previews and downstream nodes receive the same playable local result.

Generation progress is request-scoped in `server/generation-progress.js`, aggregated by client helpers, and rendered by `src/components/GenerationProgress.jsx`. Progress polling is shared and must not rebuild the graph on every tick.

Seedance 2.0/2.5 node requests additionally use durable background jobs in `server/remote-video-jobs.js`, provider adapters in `server/seedance-job-provider.js`, and HTTP acceptance/lookup in `server/routes/remote-video-jobs.js`. A saved provider ID outlives its originating HTTP connection. The client waits through `src/remoteVideoJobClient.js`; `src/useRemoteVideoRecovery.js` reconciles original-workflow Video Model results after reload. Downloads reuse saved targets and history deduplicates by generation run ID. See [Seedance Generation Recovery](remote-video-recovery.md) for state transitions, limitations, and verification.

`src/workScheduler.js` provides bounded, dependency-preserving admission for selected-node execution; `src/nodeScheduling.js` supplies provider/resource keys. Durable Seedance workers independently enforce server-side Fal/Krea submission limits across batches. The main server's FFmpeg execution wrapper has a separate local-media budget. These limits do not switch providers, cancel accepted jobs, or serialize unrelated work unnecessarily.

## Media And Preview Flow

`src/mediaAssets.js` owns accepted media and drag/drop/import shapes. `src/mediaResults.js` owns normalized result items. `src/components/MediaViews.jsx` owns shared image/video/3D preview surfaces, result navigation, output rail, and lightbox behavior.

Generated or remote media must become a managed local asset before it is treated as a durable result. Browser object URLs and raw absolute filesystem paths are runtime-only and are not valid persisted HTML sources.

Preview nodes are deliberately passive. They render connected producer results and do not own generation, transport, or timeline state. Timeline owns its playhead and publishes `frameOut`; Preview only displays that frame.

Every general preview uses contain/letterbox behavior. Cropping is valid only inside an explicit editing operation such as Edit Crop.

The project rail uses `useProjectOutputCatalog.js` and `projectOutputLoader.js` for cursor pagination and refresh merging. Passive videos use cached `/api/video-poster` stills, not one decoder per rail item; the original video remains the drag/open source. The rail remains one proportional column. Canvas node mounting and full-detail visibility are unchanged.

## Character Identity Flow

Character nodes persist generated wardrobe variants in `characterSheetVariants`, uploaded completed sheets in `characterCustomSheets`, and the selected library entry in `activeCharacterSheetId`. `src/characterSheetLibrary.js` normalizes legacy single-sheet data, assigns namespaced generated/custom selection ids, builds the combined library, and resolves deterministic fallbacks without making filenames or display order authoritative.

The active Character sheet is the full-resolution identity reference consumed by downstream image, video, Composer, Film Director, and Storyboard paths. `src/characterVideoSheets.js` resolves the selected image or matching CU Video sheet for video generation. Changing a node title updates the visible `@token`, while node ids and persisted reference bindings keep the relationship stable.

Generated and custom sheets coexist. Regeneration merges successful wardrobe variants and retains previous variants for failed wardrobes; removing an active sheet selects another valid entry before unlocking the Character. Save, Open, autosave, copy, import, and package relocation must preserve this library and its active selection through normal workflow asset handling.

`runCharacterSheetGeneration` in `src/nodeRunners/mediaModels.js` appends the Character node's nonblank `characterReferenceNotes` to both image and CU Video sheet requests. Existing layout, wardrobe, and physical-detail prompts remain intact; no separate runtime skill file is loaded. Missing notes preserve legacy requests, and Storyboard character preparation does not inherit Character Notes.

## Persistence And Storage

Workflow persistence is coordinated by `src/useWorkflowPersistence.js`, with draft state in `src/useNodeEditorDraft.js` and file/session/context helpers under `src/workflow*.js`.

A packaged workflow contains its document and managed `inputs/`, `outputs/`, and autosave data. Package-aware helpers keep assets movable between Windows and macOS. When no package is attached, managed outputs use the local Newt output tree.

Runtime data such as credentials, history, generated indexes, caches, uploads, and outputs is local state and must stay outside source control. `server/data/runtime-settings.json` is not a source fixture. `.env` is ignored; `.env.example` documents supported variables without secrets.

Save As creates a new package identity and remaps package-owned asset references. Graph identity inside the copied workflow remains internally coherent; stale references to the old package must not survive.

### Reliability Stores

| Owner | Storage and contract |
| --- | --- |
| `server/history-store.js` | Serializes history read/append/remove; retains a last-good `.bak`, quarantines corrupt JSON when recovery is possible, and refuses destructive writes after unavailable reads. The recent-history cache remains bounded to 500. |
| `server/json-store.js` | Same-directory temporary file, flush, close, retrying atomic rename. There is no copy-overwrite fallback. |
| `server/project-output-store.js` | Separate per-project, per-generation output records in `server/data/project-outputs/`; permanent discovery does not depend on recent history or source nodes. |
| `server/project-output-package.js` | Mirrors generation metadata into package `.newtnode/output-records/`; workflow `projectOutputs` snapshots and asset copying make Save As and relocation portable. |
| `server/remote-job-store.js` | Version-2 per-job immutable specifications and mutable checkpoints, with retained version-1 migration backup. Historical specifications are not rewritten on every poll. |

Recent history seeds older catalogs where records still exist. Already-evicted historical metadata cannot be reconstructed from this migration alone. Package catalog imports are lazy, and output records contain media metadata rather than private provider request payloads.

## Output And Professional Media

The Output node redirects storage while the producing node remains the result owner. Output token expansion, path safety, collision handling, external URL encoding, and copying live in `server/outputTargets.js` and the output export helpers.

Current explicit export choices are PNG/JPEG for stills and H.264 MP4/ProRes 422 HQ MOV for video. The local ProRes path uses FFmpeg `prores_ks`, profile 3, `yuv422p10le`, and PCM 24-bit audio. This is a professional 10-bit mezzanine encode, but it does not create source precision or HDR information that was not present upstream.

## Local Engines And Providers

Remote model calls remain server-side. Fal, Google, Krea, and OpenAI credentials are selected in Settings and materialized locally into `.env`; provider routing is explicit and recorded in history.

Local ComfyUI integrations live in focused server engines such as `server/wanwarp/` and `server/wanblend/`. Browser code sends normalized settings and managed asset URLs, while server engines own template patching, queueing, polling, output recovery, and diagnostics.
Local MiniMax H3 lives in `server/minimaxH3Local/`. The server converts managed Newt assets to server-visible `file://` URIs, submits asynchronous video jobs to loopback SGLang, polls completion, and copies content back into managed outputs. FL2VA/T2VA use the primary URL; Ref2VA may use a separately configured service because it is a distinct deployment variant.


Local FFmpeg/FFprobe power media inspection, Edit, Timeline rendering, waveform/probe work, Output transcoding, and related Utility operations. Use `ffmpeg-static` and `ffprobe-static` by default, with documented environment overrides for controlled installations.

## Timeline Compatibility

Timeline is the visible product name; `assembly` remains its internal node type for saved-workflow compatibility. Existing source filenames such as `AssemblyNodeBody.jsx` also remain valid implementation names until a deliberate migration updates imports, tests, docs, and old workflows together.

The same rule applies to other legacy identifiers. Visible copy can improve without invalidating persisted internal types or backend route contracts.

## Platform Launch And Updates

Windows launch is owned by `Launch_NewtNode.ps1` with `.bat` wrappers. macOS launch is owned by `NewtNode.command`, `Versus_NewtNode.command`, the app bundle, and launcher AppleScript. Both platforms ensure dependencies, build stale client assets, start the local server/client, and preserve restart/update handoff behavior.

Both production launchers run `scripts/localServerSupervisor.mjs` for the API and with `--client` for Vite preview. Each service/port has a checkout-local PID lock, rotating `.newtnode_logs/` logs, bounded crash backoff, and explicit restart-marker handling. Production does not watch source edits. `npm run dev` and `npm run server` intentionally retain developer watch mode. Diagnostics reports whether the current API is supervised and its restart count; an already-running legacy session must be relaunched to adopt the supervisor.

Settings update is constrained to the configured repository and current branch. It attempts a fast-forward update first, then uses a staged replacement only when necessary while preserving local credentials, runtime data, workflows, uploads, inputs, and outputs.

## Diagnostics And Verification

`server/runtime-diagnostics.js`, `server/job-diagnostics.js`, `src/clientDiagnostics.js`, and `src/components/DiagnosticsPanel.jsx` own the small opt-in Settings diagnostics surface. Collection expires after ten minutes; support export contains allowlisted metadata/counters and redacted job events, not raw logs, credentials, prompts, provider payloads, or asset URLs. This is not a Jobs dashboard.

`e2e/` runs the production client with generated local media and mocked provider APIs. `scripts/smokeIsolated.mjs` checks real API/package/media behavior in a temporary copy without user data or keys. `scripts/checkPerformance.mjs` enforces fixed-fixture serialization budgets. Windows/macOS CI is defined in `.github/workflows/validation.yml`; native dialog and hardware checks remain manual. See [Production Reliability](production-reliability.md).

## Architectural Direction

- Extract pure logic from `NodeEditor.jsx`; do not grow it by convenience.
- Extend current result, asset, API, history, and persistence contracts instead of creating node-local alternatives.
- Keep heavy UI and Three.js behind lazy boundaries.
- Add focused backend route groups and engines with explicit dependencies.
- Treat compatibility normalization and migration as part of feature design, not cleanup after release.
- Measure canvas interaction, media decode, bundle size, and generation latency separately.
