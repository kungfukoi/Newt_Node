# NewtNode Architecture

This document is the descriptive map of the current NewtNode implementation. `node-standards.md` remains the normative contract. Snapshot verified against package version `3.0.0-beta.0` on 2026-09-07.

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

`ImageModelAdvancedOptions.jsx` renders Flux 3 and Ideogram 4.5 controls inside Image Model options. Additive `flux3Options` and `ideogram45Options` fields persist through the existing node-data serializer; `mediaModels.js` sends only the selected model's settings. Model request builders validate provider options, and the normal image route records effective settings in History. Existing workflows use the previous defaults when these fields are absent.

Nano Banana 2.1 uses `src/nanoBanana21.js` for its distinct model identity, Fal request schema, aspect ratios, 1K/2K/4K resolution choices, and published-price estimates. `server/nano-banana-21.js` shares generation/edit submission between the normal image route and preview editor. Endpoints are `google/nano-banana-2.1` and `google/nano-banana-2.1/edit`; neither is an alias for Nano Banana 2. The preview editor uses the shared selection-guide path and restores unselected source pixels locally. Fal's published 2.1 schema specifies no maximum image-reference count, so the integration preserves the full list instead of inheriting the 2.0 limit. Atlas/Krea support remains disabled. Fal describes these endpoints as integration-only as of 2026-10-06; schema and mocked tests do not establish live generation availability.

Ideogram 4.5 is available in image generation, Character, Coverage, and Auto Aspect selectors. `src/ideogram45.js` owns Fal request schemas, supported sizes, reference limits, and explicit unpriced cost metadata; `server/ideogram45.js` shares upload/submission/result handling between normal generation and the image editor. Requests without references use `ideogram/v4.5`; up to five ordered images use `ideogram/v4.5/edit`. The preview editor uses precise editing with source geometry, converts selections to black-edit/white-preserve masks, and keeps local unselected pixels intact. Its model is selected only through `userPreferences.imageEditorModel` in Settings, with old editor settings migrated to OpenAI Image 2.5 Sunburst.

Image Generation can explicitly select Krea using the existing `src/kreaApi.js` endpoint catalog. Supported models use Krea even when Fal keys are present; missing Krea keys and unsupported models fail before submission. The Image Editor preference remains independent: Ideogram edits require Fal.

The general Video Model provider replaces the Veo/Google Video selector while retaining the persisted `veo` key and existing saved choice. Its Fal route supports Gemini Omni, Kling O3 Pro/4K, Wan 2.7 Reference-to-Video, and Creatify Aurora; Krea supports Gemini Omni generation and Kling; Google supports Gemini Omni. Unsupported model/provider pairs and missing selected keys fail before submission. Gemini video-reference edits use the selected Fal or Google route; Krea rejects them. Seedance and MiniMax remain exclusively in their dedicated routing categories.

The normal remote-generation path is:

1. `NodeEditor.jsx` gathers connected, referenced, and local node inputs.
2. `src/nodeRunner.js` schedules dependencies and batch state.
3. A focused runner under `src/nodeRunners/` builds the normalized request.
4. `src/api/newtApi.js` calls a local `/api/node/...` route.
5. The server validates inputs, resolves local assets, applies the selected credential/provider route, and submits work.
6. Generated provider media is downloaded or copied into managed local storage.
7. The server returns a small typed result and records reproducible history/cost metadata.
8. `src/mediaResults.js` updates result arrays; previews and downstream nodes receive the same playable local result.

The 3D path keeps shared model normalization and Rodin request construction in `src/model3D.js`. `/api/node/generate-3d` routes Hunyuan 3D 3.1 Pro through Fal or Krea and routes Rodin 2.5 through its Fal endpoint without provider fallback. Both paths download the returned model into managed storage and record the selected model, endpoint, settings, and cost in history.

Generation progress is request-scoped in `server/generation-progress.js`, aggregated by client helpers, and rendered by `src/components/GenerationProgress.jsx`. Progress polling is shared and must not rebuild the graph on every tick. Repeated acceptance requests preserve the same run's original clock and progress; client merges also retain the earliest start timestamp.

Atlas Seedance uses the same durable worker as Fal/Krea. `server/atlas-media.js` prepares uploaded references separately from submission; `server/seedance-job-provider.js` uses bounded Atlas submission/prediction calls, and the shared finalizer preserves Atlas provider and cost metadata.

Seedance 2.0/2.5 node requests additionally use durable background jobs in `server/remote-video-jobs.js`, provider adapters in `server/seedance-job-provider.js`, and HTTP acceptance/lookup in `server/routes/remote-video-jobs.js`. A saved provider ID outlives its originating HTTP connection. The client waits through `src/remoteVideoJobClient.js`; `src/useRemoteVideoRecovery.js` reconciles original-workflow Video Model results after reload. Downloads reuse saved targets and history deduplicates by generation run ID. See [Seedance Generation Recovery](remote-video-recovery.md) for state transitions, limitations, and verification.

`src/workScheduler.js` provides bounded, dependency-preserving admission for selected-node execution; `src/nodeScheduling.js` supplies provider/resource keys. Durable Seedance workers independently enforce server-side Fal/Krea submission limits across batches. The main server's FFmpeg execution wrapper has a separate local-media budget. These limits do not switch providers, cancel accepted jobs, or serialize unrelated work unnecessarily.

## Media And Preview Flow

Media-node replacement uploads preserve the previous asset while uploading and on failure, clear stale thumbnails on successful replacement, and reset the file input so choosing the same file again works. The existing node identity, ports, result collection, and undo path remain authoritative.

Object Selection exposes SAM 2 sampling density, confidence, stability, and minimum region area only while its tool is active. Shared defaults/validation live in `src/objectSelection.js`; the route validates before upload, sends these parameters to Fal, and records them in History. Changing controls does not submit work; Rescan explicitly requests a fresh map and retains the current selection. Automatic-map cache keys include the settings.

`src/imageEditBoxes.js` owns normalized box geometry, transforms, validation and model-independent box instructions. The lazy `ImageEditBoxes` overlay/panel shares the editor’s mark history. `server/image-edit-boxes.js` renders a separate placement guide and unions source/destination edit footprints, with Keep regions subtracted before local compositing. `src/imageEditBoxModels.js` owns structured FLUX box captions/rows, bounded object-mask validation and selection-to-box conversion. `server/image-edit-move.js` removes selected source pixels and transforms their cutouts into a prepared composite; source vacancies and feathered destination edges are editable while cutout interiors and Keep regions remain protected. All non-FLUX moves, rotated moves, and selection-derived moves use this path. Unrotated FLUX moves without a mask use structured coordinates appended to the prompt. SAM 3 segmentation remains a separate explicit, recorded request; existing selections convert without inference. Multipart object-mask JSON participates in request deduplication. `prepareImageEdit` sends either the original or this prepared composite first and normalizes reference images to PNG; box-guide ink is not treated as drawing ink to restore. The existing edit route validates up to eight boxes and one shared managed reference before generation, preserves the chosen provider/model, and records boxes in History settings. Reference uploads use workflow context and the existing managed asset route. No Scumble source is included.

The preview image editor's Object Selection uses `src/objectSelection.js` for compact mask geometry and selection composition. `server/routes/objectSelection.js` owns the Fal-only `/api/node/image-objects` route with request deduplication, bounded result caching, and History recording; `server/object-selection.js` handles oriented 1024-pixel analysis copies and bounded mask downloads/encoding. SAM 2 automatic masks support local hover previews; SAM 3 provides point selection for missed regions and text-prompt selection. The editor caches masks for the current base image, composes them into the existing selection layer, and exports the normal full-size edit mask. No Scumble source or local model runtime is included.

`src/mediaAssets.js` owns accepted media and drag/drop/import shapes. `src/mediaResults.js` owns normalized result items. `src/components/MediaViews.jsx` owns shared image/video/3D preview surfaces, result navigation, output rail, and lightbox behavior.

Generated or remote media must become a managed local asset before it is treated as a durable result. Browser object URLs and raw absolute filesystem paths are runtime-only and are not valid persisted HTML sources.

Preview nodes are deliberately passive. They render connected producer results and do not own generation, transport, or timeline state. Timeline owns its playhead and publishes `frameOut`; Preview only displays that frame.

Preview/Layout state is normalized by `src/previewLayout.js`. It stores a mixed, ordered set of image and video result references, keeps legacy image-only boards compatible, and uses muted tile playback plus the shared full-size lightbox. Layout export remains a still-image operation.

Every general preview uses contain/letterbox behavior. Cropping is valid only inside an explicit editing operation such as Edit Crop.

The preview lightbox's yellow crop box uses `src/cropGeometry.js` for freeform side/corner resizing and bounded movement. Its independent percentage width/height survive edit undo/redo and feed the existing PNG crop/export path.

The project rail uses `useProjectOutputCatalog.js` and `projectOutputLoader.js` for cursor pagination and refresh merging. Passive videos use cached `/api/video-poster` stills, not one decoder per rail item; the original video remains the drag/open source. The rail remains one proportional column. Canvas node mounting and full-detail visibility are unchanged.

## Character Identity Flow

CU wardrobe edits receive the matching completed full Character sheet as the finished wardrobe authority, together with the original portrait for identity and the neutral CU base for panel composition. CU-only retries reuse the completed wardrobe image rather than interpreting the outfit independently.

Character wardrobe edits request complete sheets without rectangular edit masks. `server/character-wardrobe.js` also removes obsolete masks from recognized requests made by older open tabs before Fal/Atlas routing. Base and CU panel crops, reference notes, managed outputs, and partial-success reconciliation remain owned by the existing Character helpers.

Character nodes persist generated wardrobe variants in `characterSheetVariants`, uploaded completed sheets in `characterCustomSheets`, and the selected library entry in `activeCharacterSheetId`. `src/characterSheetLibrary.js` normalizes legacy single-sheet data, assigns namespaced generated/custom selection ids, builds the combined library, and resolves deterministic fallbacks without making filenames or display order authoritative.

The active Character sheet is the full-resolution identity reference consumed by downstream image, video, Composer, Director, and Storyboard paths. `src/characterVideoSheets.js` resolves the selected image or matching CU Video sheet for video generation. Changing a node title updates the visible `@token`, while node ids and persisted reference bindings keep the relationship stable.

Generated and custom sheets coexist. New Character generation first creates a neutral Base Identity sheet, then creates wardrobe-specific variants as edits of that base. Base and wardrobe signatures allow current variants to be reused, while the per-wardrobe action regenerates only that dependency. Regenerate Base deliberately invalidates generated wardrobe dependencies; ordinary retries and partial failures retain successful prior variants. Legacy generated sheets without signatures remain selectable and are not rebuilt merely because an older workflow was opened. Removing an active sheet selects another valid entry before unlocking the Character. Save, Open, autosave, copy, import, and package relocation must preserve this library and its active selection through normal workflow asset handling.

`src/characterSheetWorkflow.js` coordinates base-image and CU Video generation as separately checkpointed stages. Persist each successful stage before starting the next one. Wardrobe generation uses the corresponding base sheet as its locked edit source and preserves valid image/video wardrobe halves independently when one side must be regenerated. `src/characterWardrobeGeneration.js` deliberately omits provider masks because both bitmap and alpha mask inputs can leak as black geometric regions in completed Character sheets; the locked base reference and wardrobe prompt define the edit instead. `wardrobeEditVersion` prevents results made with an obsolete mask contract from being reused.

`stylizedCharacter` is an additive Character-generation mode. When false or missing, prompt selection remains on the standard/Cinematic and CU paths. When true, `characterSheetWorkflow.js`, `characterVideoSheets.js`, and `characterWardrobeGeneration.js` select strict reference-relative prompts for base sheets and wardrobe edits, include the mode in both base signatures, and propagate the same design lock through downstream Character prompt assembly. The mode preserves feature presence or absence and source proportions/materials without assuming a particular non-human anatomy. `cinematicCharacterSheet` remains independently composable and adds the same realistic neutral-gray cyclorama treatment to Base Identity, CU Video, and wardrobe continuity prompts.

`runCharacterSheetGeneration` in `src/nodeRunners/mediaModels.js` appends the Character node's nonblank `characterReferenceNotes` to both image and CU Video sheet requests. Existing layout, wardrobe, and physical-detail prompts remain intact; no separate runtime skill file is loaded. Missing notes preserve legacy requests, and Storyboard character preparation does not inherit Character Notes.

## Director And Storyboard Flow

Director is the visible product name; `skillDirector` remains the saved node type and the focused implementation modules retain their `filmDirector*` names. Load normalization changes only legacy default titles such as `Film Director` and `Film Director 3` to `Director` and `Director 3`. User-authored titles remain unchanged.

`src/components/NodeBodies.jsx` owns the staged Director interface. Approach rules live in `src/filmDirectorApproaches.js`; `src/filmDirectorDurations.js` owns duration normalization and the `Still` one-shot invariant; reference-video modes, scene snapshots, active reference tags, and reusable shot blueprints live in `src/filmDirectorScenes.js`; audio policy and music validation remain in the focused Director helpers. `src/nodeRunners/skillDirector.js` sends every connected Character, Location, and Prop on a fresh build, retaining intentional active-reference removals during revisions. The server normalizes all Director media inputs without the generic text route's six-per-category cap, then writes all setup tags into the built final prompt.

The server executes Director and Storyboard creative reasoning with strict AJV-backed contracts in `server/creative-llm.js`. Successful repeated analysis can reuse `server/creative-analysis-cache.js` without recording duplicate provider cost. `server/director-music.js` may derive measured waveform-level evidence from local audio, but the connected audio remains the timing authority and analysis must not invent beats, lyrics, instruments, or content it did not measure.

A built Director package can control supported Video Model settings, drive an Image Model prompt, and provide scene/reference context to Storyboard. `src/filmDirectorModelRouting.js` owns the shared Director input contract, prompt composition, saved-active-reference resolution, and visual-reference merge used by Image and Video routes. `src/nodeRunners/videoModels.js` applies the Video Model's explicit `Generate Audio` off state after Director settings, converts the effective Director package and prompt to Silent, and removes reference audio before submission; the video route preserves that explicit off state instead of forcing Director music back on. The Image route sends active Director location/prop references as image prompts and active character references as character inputs while preserving direct downstream inputs. Direct Image Model Style and Camera inputs append explicit authoritative override blocks after Director direction, with Camera last. `src/imageReferenceLimits.js` provides the provider/model reference ceilings used by the Image Model counter and server-side preflight so request builders cannot silently drop tail references. Storyboard validates cut order, required continuous-shot keyframes, frame numbering, and nonempty prompts before replacing visible work. Failed planning leaves the existing board intact. Visual QC distinguishes a reviewed result from `unreviewed` when the review service is unavailable.

Director visual-reference merging identifies each reference by its original source node and output port. Direct connections, implicit prompt tags, and Director forwarding reuse that reference, so downstream tag chips and generation inputs do not duplicate it. Distinct source outputs remain separate.

## Persistence And Storage

Workflow persistence is coordinated by `src/useWorkflowPersistence.js`, with draft state in `src/useNodeEditorDraft.js` and file/session/context helpers under `src/workflow*.js`.

A packaged workflow contains its document and managed `inputs/`, `outputs/`, and autosave data. Package-aware helpers keep assets movable between Windows and macOS. When no package is attached, managed outputs use the local Newt output tree.

Runtime data such as credentials, history, generated indexes, caches, uploads, and outputs is local state and must stay outside source control. `server/data/runtime-settings.json` is not a source fixture. `.env` is ignored; `.env.example` documents supported variables without secrets.

Save As creates a new package identity and remaps package-owned asset references. Graph identity inside the copied workflow remains internally coherent; stale references to the old package must not survive.

User-created Newt Presets are a separate local library. `src/newtPresets.js` captures, sanitizes, remaps, places, and binds graph fragments; `src/useNewtPresets.js` owns browser orchestration; `server/newt-presets.js` persists metadata and copied full-resolution dependencies through `server/routes/newtPresets.js`. Preset JSON lives under ignored `server/data/newt-presets/`, while copied dependencies live under the served `outputs/Newt-Presets/dependencies/` tree. Deleting a preset removes its library entry but retains copied media because an existing workflow may still reference it.

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

The Output node redirects storage while the producing node remains the result owner. Output token expansion, including `$filename` from the connected source's original basename or its single upstream video input, path safety, collision handling, external URL encoding, and copying live in `server/outputTargets.js` and the output export helpers.

Current explicit export choices are PNG/JPEG for stills and H.264 MP4/ProRes 422 HQ MOV for video. The local ProRes path uses FFmpeg `prores_ks`, profile 3, `yuv422p10le`, and PCM 24-bit audio. This is a professional 10-bit mezzanine encode, but it does not create source precision or HDR information that was not present upstream.

## Local Engines And Providers

Remote model calls remain server-side. Fal, Google, Krea, and OpenAI credentials are selected in Settings and materialized locally into `.env`; provider routing is explicit and recorded in history. MiniMax H3 supports authoritative Fal, Krea, and Local routes. The Krea route uses the same validated multimodal reference contract as the H3 node and never falls back to Fal or Local after submission failure.

`server/atlas-llm-request.js` shares admission and bounded 429 backoff between Atlas text and image-analysis requests. It checks both HTTP and provider-envelope status before creative-output validation, preserves the selected request across retries, and reports queue/retry progress through the existing generation context.

Local ComfyUI integrations live in focused server engines such as `server/wanwarp/` and `server/wanblend/`. Browser code sends normalized settings and managed asset URLs, while server engines own template patching, queueing, polling, output recovery, and diagnostics.
Local MiniMax H3 lives in `server/minimaxH3Local/`. The server converts managed Newt assets to server-visible `file://` URIs, submits asynchronous video jobs to loopback SGLang, polls completion, and copies content back into managed outputs. FL2VA/T2VA use the primary URL; Ref2VA may use a separately configured service because it is a distinct deployment variant.


Local FFmpeg/FFprobe power media inspection, Edit, Timeline rendering, waveform/probe work, Output transcoding, and related Utility operations. Use `ffmpeg-static` and `@ffprobe-installer/ffprobe` by default, with documented environment overrides for controlled installations.

## Timeline Compatibility

Timeline is the visible product name; `assembly` remains its internal node type for saved-workflow compatibility. Existing source filenames such as `AssemblyNodeBody.jsx` also remain valid implementation names until a deliberate migration updates imports, tests, docs, and old workflows together.

The same rule applies to other legacy identifiers. Visible copy can improve without invalidating persisted internal types or backend route contracts.

## Platform Launch And Updates

Windows launch is owned by `Launch_NewtNode.ps1` with `.bat` wrappers. macOS launch is owned by `NewtNode.command`, `Versus_NewtNode.command`, the app bundle, and launcher AppleScript. Both platforms ensure dependencies, build stale client assets, start the local server/client, and preserve restart/update handoff behavior.

Both production launchers run `scripts/localServerSupervisor.mjs` for the API and with `--client` for Vite preview. Each service/port has a checkout-local PID lock, rotating `.newtnode_logs/` logs, bounded crash backoff, and explicit restart-marker handling. Production does not watch source edits. `npm run dev` and `npm run server` intentionally retain developer watch mode. Diagnostics reports whether the current API is supervised and its restart count; an already-running legacy session must be relaunched to adopt the supervisor.

Settings update is constrained to the configured repository and branch. Git checkouts attempt a fast-forward update first, then use a staged replacement when necessary. GitHub ZIP installs default to the official repository and `main`, enter the staged replacement path directly, and become a shallow Git checkout when Git is available. Without Git, the updater downloads a size-bounded public GitHub source archive and remains archive-updatable. Both replacement sources preserve local credentials, runtime data, workflows, uploads, inputs, and outputs.

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

## Explore and Image 2.5 selections

`src/openAiImageModels.js` normalizes saved Image 2.5 variant fields into separate Flare and Sunburst model names, including queued Explore settings. Historical result and cost records are preserved. Shared catalogs expose both names in nodes and Settings; Fal, Atlas and Krea route each to its own endpoint. The image editor uses only the model saved in User Preferences.

Explore is registered as a runnable image producer. `src/explore.js` owns planning contracts and persisted data; `src/nodeRunners/explore.js` owns the sequential batch; `server/routes/explore.js` handles structured creative planning and planning history. Its lazy body and CSS are separate from the initial shell. Shared image generation owns image history and storage. Interrupted requests remain uncertain after reload/copy and require inspection before another submission. See [Explore](explore-node.md).

## Storyboard selected revisions

`src/storyboardRevisions.js` owns selection validation, direction projection and stale-source checks. `src/components/StoryboardRevisionControls.jsx` owns the batch instruction UI. `server/routes/storyboardRevisions.js` registers `/api/node/storyboard-revise`, using the existing structured creative LLM routing and Storyboard usage recorder. NodeEditor orchestrates planning then the existing image/QC/export pipeline, staging new directions until the image succeeds. `workflowState.js` recovers interrupted revision state without discarding originals or resubmitting work.

Storyboard panel history uses `src/storyboardVersions.js` and `src/components/StoryboardPanelHistory.jsx`. The shared frame update path snapshots successful image replacements, while `generatedDirection` retains the directions associated with the current image even after manual prompt edits. Restore updates outputs through the normal frame state path. Protected panels are guarded in UI controls and mutation paths; recursive workflow asset collection includes nested version media during Save As and package copies.

Spatial Storyboard planning is owned by `src/storyboardSpatial.js`, adapted from upstream staging rules. Its structured schemas are shared by planning, selected revisions and the bounded correction route. Records pass through server plan normalization, client frames, generated directions and versions. Visible cast determines which character references enter generation; physical staging is appended to image prompts and evaluated in the existing QC path. Manual direction edits clear stale cast/spatial records while historical generated directions remain intact.

Storyboard review policy and migration live in `src/storyboardQc.js`; `server/storyboard-qc.js` owns contained in-memory review copies, bounded confirmation and usage aggregation. `server/routes/storyboardReview.js` owns advisory sequence review; `src/storyboardSequenceReview.js` validates panel references and fingerprints review sources. Both use existing structured creative LLM routing and History.

`src/useStoryboardBoardOutput.js` owns automatic Storyboard assembly scheduling, source signatures, project epochs and duplicate-job suppression. NodeEditor assembles contained images through the existing canvas/upload pipeline and publishes only current results to connected Preview nodes. Direct frame/PDF exports reuse the existing save dialogs and managed export route.

Pricing refresh lives in `server/pricing-refresh.js` and `server/pricing-sources.js`, with Atlas contracts in `server/atlas-pricing.js` and `src/atlasPricing.js`. `server/provider-pricing.js` isolates bounded account quotes and matched Fal billing lookups. `src/pricingCatalog.js` provides exact-setting lookups and quote invalidation; `usePricing.js` synchronizes status, while `RunPriceLabel` and `PricingSettings` expose estimates and opt-in refresh. Generation requests capture catalog snapshots; stored History and Stats amounts are never recomputed by catalog refresh.

Built-in workflow presets are shipped in `server/system-newt-presets`: Standard Workflow, Edit Image, Headshot Image, Cinematic Location, Style Transfer, and Cinematic Prop. The existing preset library lists System and User presets together. System definitions cannot be deleted; inserted copies remain editable and can be saved as user presets. Bundled example media is restored into managed preset storage when inserted, while user presets and reusable input bindings remain supported.

Canvas snap-to-grid is an opt-in local preference beside the unchanged zoom minus, percentage/reset, and plus controls. React Flow snaps node drags to the existing 28-unit canvas grid; Alt temporarily bypasses snapping. Group and selection-handle movement uses the same grid and translates contents together. Toggling the preference does not reposition existing nodes.

Settings API Credentials includes ElevenLabs profiles, active-key selection, `.env` import via `ELEVENLABS_API_KEY`, and a read-only `/v1/user` credential check using `xi-api-key`. Restricted checks remain unverified. This stores credentials only; audio generation is not yet wired.

ElevenLabs may return HTTP 401 with `detail.status: missing_permissions` for a valid restricted key. Credential validation treats this as unverified and Settings explains that User Read is required for the account check; explicit invalid-key responses remain invalid.

Audio Model (`audioModel`) uses `src/audioModel.js` for defaults, validation and estimated pricing, `AudioModelNodeBody.jsx` for controls, and `src/nodeRunners/audioModels.js` for tracked sequential batches. `server/routes/audioModel.js` exposes voices and generate-audio through the server-only active ElevenLabs key; `server/elevenlabs.js` owns bounded, non-retried provider calls. MP3 outputs use managed workflow/Output targets and audio History records. Input ports are stable `promptIn` / `audioIn` with mode-dependent activation; output is `audioOut`. Source recordings and generated results participate in generic package asset rebasing.

`src/userPreferences.js` owns the independent Text Agent model choice (GPT-5.6 Sol or GPT-6 Astra). Settings persists it through the shared runtime settings store; each Text Agent request reads the current preference before provider submission, and existing result/history metadata records the actual model. Text Model and media-analysis helper defaults remain independent.
