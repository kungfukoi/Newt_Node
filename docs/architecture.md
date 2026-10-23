# NewtNode Architecture

This document is the descriptive map of the current NewtNode implementation. `node-standards.md` remains the normative contract. Documentation audited against checkout version `4.5.0-beta.0` on 2026-10-15; see [audit scope](documentation-audit-2026-10-15.md).

## Runtime Shape

Video Outpaint uses the shared Utility Generations selector and `batchCount` scheduler in `NodeEditor.jsx`, with the existing Utility result aggregation and durable Seedance requests. It adds no separate batch API or persisted count field. Canvas repetition remains a per-request preparation setting.

`src/videoOutpaint.js` normalizes Seedance `repeatCount` and plans the final copy's start in `prerollFrames`, enforcing the 30-second submission ceiling. `VideoOutpaintControls.jsx` persists the numeric Canvas repeats setting. `server/video-outpaint.js` repeats the trimmed moving shot before tail padding; existing finishing, timing alignment and coverage checks use the selected final interval. Original source/audio restoration still starts at the selected shot's original start. Prepared plans retained in durable jobs/history carry both full submission and single-copy delivery timing. `videoOutpaintSeedanceRepeats` health-gates newer clients against older backends.

`server/keyer-install.js` owns first-use Windows x64 CorridorKey setup, pinned Python/CUDA dependencies and model downloads, hardware checks and runtime preflight. Setup runs inside the serialized Keyer job and reports installation stages through existing polling. Storage defaults to ignored `server/data/corridorkey/`; server overrides remain optional. macOS returns an unsupported-Python-engine state without downloads. Health advertises `keyerAutoSetup`.

CorridorKey 2.0 is selected through Utility Video's canonical `modelOptions.js` catalog. `isKeyerNode` recognizes both Utility selections and legacy Keyer records; `migrateKeyerNode` preserves node/port identity during load. Per-model Utility port definitions and result resolution route the existing Cutout/Matte/Foreground passes. Utility model changes use `remapUtilityKeyerEdges` for compatible primary source/output wires. `isRetiredUtilityVideoModel` owns the three disabled Utility models and is shared by the UI and server endpoint.

`src/keyer.js` owns Keyer defaults, settings normalization and per-port result identity. The lazy `src/components/KeyerNodeBody.jsx` provides its viewer and controls; `src/nodeRunners/keyer.js` submits and polls jobs. `server/routes/keyer.js` normalizes requests and exposes readiness/start/job routes; `server/keyer.js` validates local assets, serializes the external CUDA engine, parses stage/window logs, and saves managed passes plus History. `server/index.js` injects existing asset resolution, output targets, media probing and history. The external CorridorKey installation and Python environment are configured through ignored server environment variables, not workflow JSON or bundled code. The job registry is in memory; completed artifacts remain managed assets. Health advertises `routes.keyer`.

`server/krea-llm.js` adapts Text, Text Agent, Director, Storyboard and shared image/video analysis to Krea Agent send/wait sessions. A request pins the existing selected OpenAI model, sends reference attachments through Krea assets, creates one paid session and polls its exact run ID. It requests text/analysis only, preserves reply formats, reports errors without replay or provider fallback, and leaves token/USD usage unknown because the API reports no usage. Krea is selected explicitly; merely enabling its key does not add it to legacy LLM fallback. Krea bills Agent compute units and model pins require workspace-plan access.

`server/krea-enhance.js` owns published Krea Topaz image/video, Hyperion HDR and FLUX video-upscale request mappings and explicit unsupported-variant errors. Utility Image, Utility Video and 3D Model now have Fal/Krea Settings routes. Image to Color ID uses the existing Krea Image 2.5 adapter when Utility Image selects Krea. Local utility tools retain their existing paths. Provider-specific uploads, managed downloads and History remain in the existing server pipeline. `src/kreaApi.js` adds Ideogram 4.5 (five references, 2K), FLUX 3 Max, Rodin 2.5 and current enhancement endpoints. Flux 3 image, REVE 2.1, Wan 2.7 reference generation and Creatify Aurora have no matching published Krea API endpoints as of 2026-10-21.

`src/components/CompositeLivePreview.jsx` owns disposable browser image/video resources, local thumbnail playback and seeking; `src/compositePreview.js` owns thumbnail blend/alpha/mask pixel math. Thumbnail state stays out of workflow/result persistence and backend execution.

Composite Video uses `src/compositeLayers.js` for stable layer/mask port identities, normalization and legacy shared-input migration. `src/components/CompositeLayerControls.jsx` owns the layer controls; `server/composite-stack.js` builds the planar RGB/alpha FFmpeg graph. The existing Utility video route records the complete stack and writes one managed video result.

Video crop geometry and FFmpeg filter construction live in `src/videoCrop.js`, using shared `cropGeometry.js` bounds. `src/components/VideoCropEditor.jsx` owns the inline and enlarged video crop UI; the Edit node passes persisted settings to the existing local Edit route.

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

`src/nodeReferences.js` indexes directed upstream reachability per immutable graph
snapshot. NodeEditor passes real edges and the consuming node's scope into tag
resolution, highlights, prompt media collection and text-model context. Existing
bindings survive disconnection but cannot bypass upstream eligibility.

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

Nano Banana 2.1 uses `src/nanoBanana21.js` for its distinct model identity, Fal request schema, aspect ratios, 1K/2K/4K resolution choices, and published-price estimates. `server/nano-banana-21.js` shares generation/edit submission between the normal image route and preview editor. Endpoints are `google/nano-banana-2.1` and `google/nano-banana-2.1/edit`; neither is an alias for Nano Banana 2. The preview editor uses the shared selection-guide path and restores unselected source pixels locally. Fal's published 2.1 schema specifies no maximum image-reference count, so the integration preserves the full list instead of inheriting the 2.0 limit. Krea support is implemented through the separate Krea builder and adapter, with up to 14 references and provider-specific ratios/pricing. Atlas 2.1 remains unsupported. The Fal integration-only note dates to 2026-10-06; it is historical evidence, not a current availability check. Schema and mocked tests do not establish live generation availability.

Ideogram 4.5 is available in image generation, Character, Coverage, and Auto Aspect selectors. `src/ideogram45.js` owns Fal request schemas, supported sizes, reference limits, and explicit unpriced cost metadata; `server/ideogram45.js` shares upload/submission/result handling between normal generation and the image editor. Requests without references use `ideogram/v4.5`; up to five ordered images use `ideogram/v4.5/edit`. The preview editor uses precise editing with source geometry, converts selections to black-edit/white-preserve masks, and keeps local unselected pixels intact. Its model is selected through the shared `userPreferences.imageEditorModel` in Settings or the image editor header, with old editor settings migrated to OpenAI Image 2.5 Sunburst.

Image Generation can explicitly select Krea using the existing `src/kreaApi.js` endpoint catalog. Supported models use Krea even when Fal keys are present; missing Krea keys and unsupported models fail before submission. The Image Editor preference remains independent: Ideogram edits require Fal.

The general Video Model provider replaces the Veo/Google Video selector while retaining the persisted `veo` key and existing saved choice. Its Fal route supports Gemini Omni, Kling O3 Pro/4K, Wan 2.7 Reference-to-Video, and Creatify Aurora; Krea supports Gemini Omni generation and Kling; Google supports Gemini Omni. Unsupported model/provider pairs and missing selected keys fail before submission. Gemini video-reference edits use the selected Fal or Google route; Krea rejects them. Seedance retains its dedicated category. MiniMax H3 now follows Video Model (Fal/Krea/Atlas/Local); the legacy minimaxH3 setting is normalized to the persisted veo choice. A legacy H3-only setting migrates into veo. The separate H3 selector is removed. Krea also supports FLUX 3 Max with the shared validated text/keyframe schema.

The normal remote-generation path is:

1. `NodeEditor.jsx` gathers connected, referenced, and local node inputs.
2. `src/nodeRunner.js` schedules dependencies and batch state.
3. A focused runner under `src/nodeRunners/` builds the normalized request.
4. `src/api/newtApi.js` calls a local `/api/node/...` route.
5. The server validates inputs, resolves local assets, applies the selected credential/provider route, and submits work.
6. Generated provider media is downloaded or copied into managed local storage.
7. The server returns a small typed result and records reproducible history/cost metadata.
8. `src/mediaResults.js` updates result arrays; previews and downstream nodes receive the same playable local result.

The 3D path keeps shared model normalization and Rodin request construction in `src/model3D.js`. `/api/node/generate-3d` routes Hunyuan 3D 3.1 Pro through Fal or Krea and routes Rodin 2.5 through Fal or Krea using the explicit 3D Model provider setting without fallback. Krea Rodin preserves up to five input views and texture choice; its API does not expose Fal mesh tier/PBR controls. Both paths download the returned model into managed storage and record the selected model, endpoint, settings, and cost in history.

Generation progress is request-scoped in `server/generation-progress.js`, aggregated by client helpers, and rendered by `src/components/GenerationProgress.jsx`. Progress polling is shared and must not rebuild the graph on every tick. Repeated acceptance requests preserve the same run's original clock and progress; client merges also retain the earliest start timestamp.

Atlas Seedance uses the same durable worker as Fal/Krea. `server/atlas-media.js` prepares uploaded references separately from submission; `server/seedance-job-provider.js` uses bounded Atlas submission/prediction calls, and the shared finalizer preserves Atlas provider and cost metadata.

`server/job-diagnostics.js` derives allowlisted stage timings from durable checkpoints.
The worker retains first output availability and Atlas reported latency; status
responses expose timings and finalization records them in History/results. Atlas
reference-video durations are probed before submission and stored in settings,
with unknown values represented as null. Terminal prediction envelopes survive
HTTP errors for original-ID/model validation before tracking stops.

`server/runtime-owner.js` acquires an exclusive loopback UDP lease keyed by the canonical data-directory path before backend state stores initialize. Reopening the normal launcher reuses the existing backend/client; it opens another window with an independent session draft. A second backend with the same data directory exits with ownership code 73, and its supervisor stops instead of retrying. OS ownership is released on process termination. `server/outputTargets.js` claims in-memory filename reservations before awaiting filesystem checks, preventing collisions among simultaneous window exports. Durable jobs retain shared provider limits and separate workflow scopes.

`prepareAtlasSeedanceImageAsset` in `server/atlas-video-input.js` pads/scales provider-only image copies to the supported aspect/side-size bounds before upload, retaining valid source bytes and never modifying managed originals. `server/atlas-media.js` prepares reference images and first/last frames and reports changed dimensions/padding for History settings. `src/atlasMedia.js` forces adaptive ratio on Seedance 2.5 frame routes. The Atlas job adapter treats explicit asynchronous InvalidParameter or first-frame ratio rejections as terminal failures rather than endlessly recovering; generic HTTP/network failures remain recoverable, and no failed job is resubmitted.

Seedance 2.0/2.5 node requests additionally use durable background jobs in `server/remote-video-jobs.js`, provider adapters in `server/seedance-job-provider.js`, and HTTP acceptance/lookup in `server/routes/remote-video-jobs.js`. A saved provider ID outlives its originating HTTP connection. The client waits through `src/remoteVideoJobClient.js`; `src/useRemoteVideoRecovery.js` reconciles original-workflow Video Model results after reload. Downloads reuse saved targets and history deduplicates by generation run ID. See [Seedance Generation Recovery](remote-video-recovery.md) for state transitions, limitations, and verification.

`src/workScheduler.js` provides bounded, dependency-preserving admission for selected-node execution; `src/nodeScheduling.js` supplies provider/resource keys. Durable Seedance workers independently enforce server-side Fal/Krea submission limits across batches. The main server's FFmpeg execution wrapper has a separate local-media budget. These limits do not switch providers, cancel accepted jobs, or serialize unrelated work unnecessarily.

## Media And Preview Flow

Media-node replacement uploads preserve the previous asset while uploading and on failure, clear stale thumbnails on successful replacement, and reset the file input so choosing the same file again works. The existing node identity, ports, result collection, and undo path remain authoritative.

Object Selection exposes SAM 2 sampling density, confidence, stability, and minimum region area only while its tool is active. Shared defaults/validation live in `src/objectSelection.js` (32 × 32 sampling, 0.75 confidence); the route validates before upload, sends these parameters to Fal, and records them in History. Activating the tool and changing controls never submit a scan; Scan image for objects explicitly requests a fresh map and retains the current selection. Automatic-map cache keys include the settings.

Save selections and boxes exports a managed annotated PNG and creates an Image Selection node. Selected regions convert to a tagged box with their exact mask; existing boxes retain their operations and transforms. Visible labels include @tags; PNG metadata and the result item retain the selection document. The image-generation route reads embedded records through `server/image-selection-references.js` and appends tag descriptions and coordinates to downstream model prompts, even after reimport. Done uses the provider-free object-cache route to save the full draft and close without a discard prompt, storing a separate versioned record by source content hash. `src/imageEditSelectionState.js` validates selected/subtracted object masks, brush selections, box transforms, source masks, detection settings, drawing marks, prompt and edit method. Reopening restores the draft without segmentation; Done with empty regions clears them. These records remain local to this installation, like scan records, and do not travel in workflow packages. Ideogram box edits use scene-wide generation with explicit Keep protection so hard object masks do not clip destination integration effects.

`server/image-edit-box-names.js` prepares bounded crop/context inputs and validates conservative vision names. `server/routes/imageBoxNames.js` exposes `/api/node/identify-image-box`, using the configured text/vision provider through `runMediaDescriptionLlm`, source/region/provider/model caching, request deduplication and History/Stats accounting. `src/useImageEditBoxNames.js` queues one automatic attempt per new unnamed source box and ignores stale/manual/deleted selections. The editor commits accepted names through mark history; naming does not run SAM or modify pixels. Scumble's existing description-based naming remains the reference for tags; automatic visual naming is a Newt adaptation.

`src/imageEditSave.js` owns full-resolution draft/result disk downloads through the image-editor header Save icon. Results and untouched sources retain their original bytes; box drafts use the tagged selection PNG exporter. `compositeImageEditDrawing` in `src/imageEdit.js` renders drawing marks separately before compositing, preserving the source under eraser marks. Disk downloads keep the editor open and do not submit inference or create canvas/output copies.

`src/imageEditBoxes.js` owns normalized box geometry, transforms, validation and model-independent box instructions. The lazy `ImageEditBoxes` overlay/panel shares the editor’s mark history. `server/image-edit-boxes.js` renders a placement guide and combines softly feathered subject/context guidance. `server/image-edit-context.js` rasterizes masks without aspect cropping and builds bounded-resolution silhouette-following context. Generation guidance and final compositing are separate: Boxes retain the complete generated scene, with only Keep regions restored locally. Native FLUX boxes use structured instructions without an additional restrictive selection guide. `src/imageEditBoxModels.js` owns structured FLUX box captions/rows, bounded object-mask validation and selection-to-box conversion. `server/image-edit-move.js` removes selected source pixels and transforms their cutouts into a prepared composite; source vacancies, whole destination silhouettes and surrounding context are editable for removal of old shadows/reflections and scene-aware relighting; Keep regions remain protected. Source erasure includes a one-pixel safety edge to remove mask-boundary fragments; destination cutouts retain the exact selected pixels. The source and target rectangles never clip a selected silhouette. All non-FLUX moves, rotated moves, and selection-derived moves use this path. Unrotated FLUX moves without a mask use structured coordinates appended to the prompt. SAM 3 segmentation remains separately recorded and occurs on Select object or explicit Generate for non-native moves/removals and rotation; existing selections convert without inference. The UI caches successful selections. Boxes combines all current selection regions into one mask and transform; renaming a selection-derived box preserves its mask. Renaming a box identified by description invalidates its inferred mask. Multipart object-mask JSON participates in request deduplication. `prepareImageEdit` sends either the original or this prepared composite first and normalizes reference images to PNG; box-guide ink is not treated as drawing ink to restore. The existing edit route validates boxes without a fixed count cap and one shared managed reference before generation, preserves the chosen provider/model, and records boxes in History settings. Reference uploads use workflow context and the existing managed asset route. During an open editor session, each version retains a private snapshot of its original source, resolved masks, marks, prompt and edit settings. Rerun Box Edit creates an explicit new request from that snapshot using the currently selected model/provider; Adjust Boxes restores it for revision. Snapshots remain separate from result items, node assets and workflow exports. Failed attempts retain the previous result and successful segmentation; Continue Editing starts a fresh draft without removing older version snapshots. `src/imageEditBoxExport.js` owns tagged full-frame selection PNG rendering, versioned metadata, mask validation and PNG iTXt embedding/parsing. Tags are derived from descriptions across the complete box list and shared by the overlay, exported image and provider instructions. Save Selection posts the single annotated PNG to `/api/node/save-image-selection`; the image-edit route validates embedded metadata, saves bytes unchanged through the existing managed output helper and records a zero-cost local History/output item. The editor reuses the copy-accept callback to create an Image Selection node, then returns to the image viewer. No editor load action or standalone metadata download is exposed. Exact metadata can be parsed later; visible tags are readable when providers receive only image pixels. No Scumble source is included.

Box operations include hidden scene-context instructions for removal, placement, rotation, scaling, references and text. Infer appropriate surface contact, lighting, shadows, reflections and occlusion from the full scene; preserve unrelated objects and their effects. The per-box Shadow / lighting area defaults to 35% of the shorter box side, is adjustable from 0–100%, and expands softly feathered generation guidance around source/removal and destination silhouettes. Dashed outlines show approximate context reach, not hard crop boundaries; Keep boxes override it. The complete returned scene is retained for continuous surfaces and lighting, so unrelated pixels outside Keep boxes are not guaranteed byte-identical. Source cleanup instructions prioritize removal of duplicates and reconstruction of the underlying scene materials, perspective, occlusion and lighting; staged guides label the old footprint BACKGROUND ONLY. Model output may vary and long shadows may need a larger area.

The preview image editor's Object Selection uses `src/objectSelection.js` for compact mask geometry and selection composition. `server/routes/objectSelection.js` owns the Fal-only `/api/node/image-objects` inference route with request deduplication and History recording, plus the provider-free `/api/node/image-object-cache` restoration/inheritance route. `server/object-selection-cache.js` stores atomic, versioned mask files under ignored `server/data/object-scans/`, keyed by SHA-256 of source bytes and normalized settings/query. Records retain up to twelve queries and two million run values per image; malformed/incompatible records are ignored. `server/object-selection.js` handles oriented 1024-pixel analysis copies and bounded mask downloads/encoding. SAM 2 automatic masks support local hover previews; SAM 3 provides point selection for missed regions and text-prompt selection. `ImageEditStudio` restores masks on opening/changing its base, without paid calls. Completed non-blank edits link compatible masks to the result's content identity; inherited maps are labeled as originating before the edit and never overwrite an existing target scan. Rescan bypasses disk and memory results, preserving the current selection and earlier-image records. Cache hits require no Fal key or new billing record. Failed scan persistence and failed inheritance surface warnings while preserving completed work. Scans survive local project/app reopening but do not travel in workflow packages. No Scumble source or local model runtime is included.

`src/mediaAssets.js` owns accepted media and drag/drop/import shapes. `src/mediaResults.js` owns normalized result items. `src/components/MediaViews.jsx` owns shared image/video/3D preview surfaces, result navigation, output rail, and lightbox behavior.

Generated or remote media must become a managed local asset before it is treated as a durable result. Browser object URLs and raw absolute filesystem paths are runtime-only and are not valid persisted HTML sources.

Preview nodes are deliberately passive. They render connected producer results and do not own generation, transport, or timeline state. Timeline owns its playhead and publishes `frameOut`; Preview only displays that frame.

Preview/Layout state is normalized by `src/previewLayout.js`. It stores a mixed, ordered set of image and video result references, keeps legacy image-only boards compatible, and uses muted tile playback plus the shared full-size lightbox. Layout export remains a still-image operation.

Every general preview uses contain/letterbox behavior. Cropping is valid only inside an explicit editing operation such as Edit Crop.

The preview lightbox's yellow crop box uses `src/cropGeometry.js` for freeform side/corner resizing and bounded movement. Its independent percentage width/height survive edit undo/redo and feed the existing PNG crop/export path.

The project rail uses `useProjectOutputCatalog.js` and `projectOutputLoader.js` for cursor pagination and refresh merging. Passive videos use cached `/api/video-poster` stills, not one decoder per rail item; the original video remains the drag/open source. The rail remains one proportional column. Canvas node mounting and full-detail visibility are unchanged.

## Character Identity Flow

Character voice samples use the existing tracked Audio Model TTS route, saved as `characterElevenLabsVoiceSample` with the source voice ID and managed URL. `videoModelRequestForNode` builds Video reference requests. The legacy `/api/node/prepare-character-dialogue` route and preview signatures remain compatibility mechanisms; current Video controls do not expose inline speech preparation. New exact-speech workflows generate dialogue in Audio Model and connect one completed track to Reference Audio. `characterVoiceMode` selects exact dialogue or voice-reference samples. Sample mode adds labeled audio references and speaker instructions without remuxing sample paragraphs into output. Busy preparation state clears on workflow restoration, with an interruption diagnostic.

`src/characterDialogue.js` owns assigned ElevenLabs voice validation, Director dialogue packages, exact-line planning briefs, and node-ID remapping. `CharacterElevenLabsVoice.jsx` uses the existing paginated server-side voice catalog; credentials never enter persisted Character data. `DirectorDialogueControls.jsx` edits scene-specific rows, saved by `filmDirectorScenes.js`. Uploaded samples remain available when the Character switches back to the uploaded-audio mode.

Audio Model uses `DirectorDialogueControls.jsx` for current dialogue authoring. Video retains additive `directorDialogue` / `directorDialogueAudioVersion` fields for saved-workflow compatibility but no longer renders the inline dialogue editor. `videoCharacterDialogue` combines explicit Video and Director lines with stable speaker IDs; `buildVideoGenerationRequest` carries this as `characterDialogue` independently of a Director. The server accepts that shared package or the legacy `filmDirector.dialogue` package. Character voice assignments remain source-node metadata rather than generated MP3s until a speech-capable consumer runs. `nodeEditor.css` owns the shared Character model/voice dropdown styling; the component adds only its compact row layout and status presentation.

`server/director-dialogue.js` validates connected speaker images and available voices, checkpoints paid speech requests, reuses managed clips through a durable cache, records costs in History, and assembles timed audio references for Seedance 2.0/2.5 and MiniMax H3. Ambiguous requests require explicit regeneration instead of automatic replay. The shared video downloader replaces native audio with the exact prepared speech and rejects output that truncates a spoken cue. `directorDialogueAudio` in video results keeps derived tracks and clips portable through workflow asset collection. See [assigned dialogue workflow](creative-workflows.md#dialogue-and-character-voices).

CU wardrobe edits receive only the neutral CU base for panel composition and the matching completed full Character Sheet as the sole identity and finished wardrobe authority. The original portrait and raw wardrobe reference are excluded to prevent their clothing from competing with the completed outfit. CU-only retries reuse the completed wardrobe image. Base/custom CU reruns also use their matching full sheet rather than the original portrait, preserving its outfit while requesting the three-panel CU layout. Existing saved CU images remain unchanged until explicitly regenerated.

Character library CU thumbnails expose a separate rerun action. It replaces only the selected CU result, reuses the existing full sheet and wardrobe/base references, and retains the previous result on failure. Base CU reruns preserve existing wardrobe sheets; custom CU reruns use their uploaded full sheet as the reference. Success keeps the regenerated CU selected. Requests use the existing tracked sheet runners without automatic retries.

Character wardrobe edits request complete sheets without rectangular edit masks. `server/character-wardrobe.js` also removes obsolete masks from recognized requests made by older open tabs before Fal/Atlas routing. Base and CU panel crops, reference notes, managed outputs, and partial-success reconciliation remain owned by the existing Character helpers.

Character nodes persist generated wardrobe variants in `characterSheetVariants`, uploaded completed sheets in `characterCustomSheets`, and the selected library entry in `activeCharacterSheetId`. `src/characterSheetLibrary.js` normalizes legacy single-sheet data, assigns namespaced generated/custom selection ids, builds the combined library, and resolves deterministic fallbacks without making filenames or display order authoritative.

The active Character sheet is the full-resolution identity reference consumed by downstream image, video, Composer, Director, and Storyboard paths. `src/characterVideoSheets.js` resolves the selected image or matching CU Video sheet for video generation. Changing a node title updates the visible `@token`, while node ids and persisted reference bindings keep the relationship stable.

Generated and custom sheets coexist. New Character generation first creates a neutral Base Identity sheet, then creates wardrobe-specific variants as edits of that base. Base and wardrobe signatures allow current variants to be reused, while the per-wardrobe action regenerates only that dependency. Regenerate Base deliberately invalidates generated wardrobe dependencies; ordinary retries and partial failures retain successful prior variants. Legacy generated sheets without signatures remain selectable and are not rebuilt merely because an older workflow was opened. Removing an active sheet selects another valid entry before unlocking the Character. Save, Open, autosave, copy, import, and package relocation must preserve this library and its active selection through normal workflow asset handling.

`src/characterSheetWorkflow.js` coordinates base-image and CU Video generation as separately checkpointed stages. Persist each successful stage before starting the next one. Wardrobe generation uses the corresponding base sheet as its locked edit source and preserves valid image/video wardrobe halves independently when one side must be regenerated. `src/characterWardrobeGeneration.js` deliberately omits provider masks because both bitmap and alpha mask inputs can leak as black geometric regions in completed Character sheets; the locked base reference and wardrobe prompt define the edit instead. `wardrobeEditVersion` prevents results made with an obsolete mask contract from being reused.

`stylizedCharacter` is an additive Character-generation mode. When false or missing, prompt selection remains on the standard/Cinematic and CU paths. When true, `characterSheetWorkflow.js`, `characterVideoSheets.js`, and `characterWardrobeGeneration.js` select strict reference-relative prompts for base sheets and wardrobe edits, include the mode in both base signatures, and propagate the same design lock through downstream Character prompt assembly. The mode preserves feature presence or absence and source proportions/materials without assuming a particular non-human anatomy. `cinematicCharacterSheet` remains independently composable and adds the same realistic neutral-gray cyclorama treatment to Base Identity, CU Video, and wardrobe continuity prompts.

`runCharacterSheetGeneration` in `src/nodeRunners/mediaModels.js` appends the Character node's nonblank `characterReferenceNotes` to both image and CU Video sheet requests. Existing layout, wardrobe, and physical-detail prompts remain intact; no separate runtime skill file is loaded. Missing notes preserve legacy requests, and Storyboard character preparation does not inherit Character Notes.

The Character upstream port at `8104597` adds shared foundation/accessory rules,
portrait-led CU guidance, Seedream 2K sheet routing and Base/Sheet labels.
`characterSheetLibrary.js` also owns `characterOutputReference`, shared by video
reference selection and Storyboard. Local-only generated/CU sheets survive editor
normalization; managed local URLs win over provider URLs. Base outputs, Stylized,
gray-cyc treatment, Notes and matching full-sheet CU wardrobe references remain
local compatibility adaptations. See [Character upstream comparison](character-upstream.md).

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

Remote model calls remain server-side. Fal, Google, Krea, OpenAI, Atlas Cloud, and ElevenLabs credentials are selected in Settings and materialized locally into `.env`; provider routing is explicit and recorded in history. Settings verifies routing saves with an immediate reload and shows feedback beside Save Routing. Missing provider keys warn after saving preferences rather than blocking unrelated route changes; generation still enforces the selected provider credential. MiniMax H3 supports authoritative Fal, Krea, Atlas Cloud, and Local routes. The Krea route uses the same validated multimodal reference contract as the H3 node and never falls back to Fal or Local after submission failure.

`server/atlas-llm-request.js` shares admission and bounded 429 backoff between Atlas text and image-analysis requests. It checks both HTTP and provider-envelope status before creative-output validation, preserves the selected request across retries, and reports queue/retry progress through the existing generation context.

Local ComfyUI integrations live in focused server engines such as `server/wanwarp/` and `server/wanblend/`. Browser code sends normalized settings and managed asset URLs, while server engines own template patching, queueing, polling, output recovery, and diagnostics.
Local MiniMax H3 lives in `server/minimaxH3Local/`. The server converts managed Newt assets to server-visible `file://` URIs, submits asynchronous video jobs to loopback SGLang, polls completion, and copies content back into managed outputs. FL2VA/T2VA use the primary URL; Ref2VA may use a separately configured service because it is a distinct deployment variant.


Local FFmpeg/FFprobe power media inspection, Edit, Timeline rendering, waveform/probe work, Output transcoding, and related Utility operations. Use `ffmpeg-static` and `@ffprobe-installer/ffprobe` by default, with documented environment overrides for controlled installations.

## Timeline Compatibility

Timeline is the visible product name; `assembly` remains its internal node type for saved-workflow compatibility. Existing source filenames such as `AssemblyNodeBody.jsx` also remain valid implementation names until a deliberate migration updates imports, tests, docs, and old workflows together.

`AssemblyFrameSizeControls.jsx` owns draft editing for preview width/height. It commits
to the existing `assembly.outputWidth` / `outputHeight`, shared by the live frame and
FFmpeg render. Dimension changes refresh the live frame immediately and participate
in Timeline undo/redo. Preview node resizing changes only its display viewport;
contained image/video layers fill that viewport independently of intrinsic frame size.

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

`src/textAgent.js` owns Text Agent's image/video prompt editing instructions, conversation normalization, current-output synchronization and request prompt assembly. NodeEditor persists synchronized turns; the text runner sends the current visible prompt in assistant history, and all three server provider routes share the same complete-prompt revision contract. Existing workflow fields and Prompt/Output routing stay compatible.

## Storyboard upstream planner

`server/routes/storyboard.js` and `server/storyboard-skills/directing-v2.md` now
provide upstream skill 2.2.0 independent planning, selected revisions and sequence
review. `src/storyboardWorkflow.js`, `storyboardCast.js` and `storyboardPromptPolicy.js`
own the shared contracts, shot phases/action states, bounded cast correction,
reference fingerprints and rendering policy. Versioned endpoints coexist with
the original Director planning and revision contracts. `server/storyboard-qc.js`
uses named character sheets and caches only confident review results within the
configured provider, credential, model and policy scope. See
[upstream comparison](storyboard-upstream.md) for the pinned source and adaptations.

## Spend analytics ownership

`src/statsAnalytics.js` owns sanitized accounting records, composable filters and exact
aggregation; `StatsDashboard.jsx` / `stats.css` own the Local/Global interface.
`server/stats-ledger.js` retains accounting beyond the recent-history cache.
`server/stats-providers.js` owns read-only official provider adapters and scope validation;
`server/routes/stats.js` exposes local, account, export and readonly import-preview routes.
See [spend analytics](stats-analytics.md) for capabilities and limits.

Boxes output instructions share explicit cleanup requirements through boxOutputRules in src/imageEditBoxes.js. Both general guides and native FLUX captions require relocation without a source duplicate, reconstruction of vacated backgrounds, and removal of all guide graphics (including turquoise destination outlines). Cleanup takes precedence over generic scene-preservation wording while honoring Keep regions and genuine scene content. These are generation instructions, not a deterministic output guarantee.

Image editor model synchronization is owned by src/imageEditorPreference.js. Both model selectors read the latest preferences without secrets, save only the user-preferences section through the existing settings API, verify the returned model and dispatch the shared preference event. The app shell updates the open editor through its existing model prop; Settings merges only the model into its draft so unrelated unsaved choices remain intact. ImageEditStudio retains its drawing/selection history and labels reviewed results with their generation model. Model-specific quality/resolution controls normalize unsupported values when switching.

### Submission and reference safeguards

The browser API wrapper does not replay POST requests under `/api/node/` after connection failures. Interrupted responses direct users to History/provider status before retrying. Ideogram validates all source and mask sizes before upload, losslessly recompresses oversized provider copies without changing geometry, and rejects copies still above 25 MB before submission. Original managed assets remain unchanged.

Audio Model offers Dialogue and character voices mode with a stable characterIn input. Connected Characters supply current names and ElevenLabs voices without requiring image sheets; manual dialogue rows require a speaker name and voice. Run creates one managed audio track with ordered lines and pauses, reusing the existing cached speech engine and per-line History accounting. Connect audioOut to a Video Model audio reference input to use the track. Video Model no longer exposes dialogue controls; existing saved dialogue remains runnable for compatibility.

Video Model retains an explicit Character voices selector for Seedance and MiniMax H3: Off or Voice samples (model dialogue). Samples mode validates current Character samples and passes them as named audio references with explicit speaker assignments. Exact dialogue authoring remains in Audio Model; saved legacy exact dialogue remains selectable when present.

Video Model supports both voice-sample handoff and exact dialogue authoring through DirectorDialogueControls and the existing speech preparation action; Audio Model also retains its standalone dialogue mode.

Video Model Exact dialogue audio now consumes one connected Audio Model or Audio node through Reference Audio. Inline dialogue authoring and Prepare ElevenLabs controls are removed. Overlength speech receives a managed first-15-second copy, preserving originals, and is submitted as the sole audio reference with lip-sync instructions and retained in the video output.

Explore look selection and planning normalization live in `src/explore.js`; `src/nodeRunners/explore.js` snapshots resolved looks alongside existing provider/background settings. `server/creative-llm.js` validates normalized plans and `server/routes/explore.js` preserves usage and existing work on failure. The `exploreLookVariation` capability prevents stale backend submissions.

ElevenLabs v4 is owned by the existing `src/audioModel.js` request/estimate contract, Audio Model controls, and `server/elevenlabs.js` rate overrides. It uses the normal managed audio route, History, and output propagation.

`src/nanoBanana21.js` owns the added Krea input contract, ratio list and tariff. The existing Krea adapter and image route handle uploads, managed output, History and pricing; provider support derives from `kreaEndpoints`. Explicit 8:1 requests reject before upload while Auto maps to a supported ratio.

`src/seedanceDraft.js` and `src/nodeRunners/seedanceDraft.js` own provider-aware draft controls, result selection and completion. `server/seedance-drafts.js` stores Fal/Atlas private receipts and creates a stable completion run in `remote-video-jobs`; legacy receipts remain Fal. The Seedance adapter/worker checkpoint Atlas draft IDs from submission or polling before finalization, retaining them across restart alongside output reservations, costs, dialogue tracks and generation timings. Atlas completion uses its draft-complete model with only the original draft ID; Krea finalization returns explicit preview-only metadata without receipts or finishing. `src/seedance25.js` owns edit and numbered-reference validation; `src/atlasMedia.js` builds Atlas draft/edit requests. Director scenes persist the draft preference without rebuilding their plan. Draft uploads and job fingerprints use the provider/key captured before asynchronous preparation; the worker waits for that same credential if Settings changes.

Node ejection is coordinated by `src/nodeRunControl.js`; NodeEditor gates run-owned state writes with the run token. The durable video stop-node route owns persistent tracking dismissal, scopes it to workflow/node, and guards against late worker transitions.

`server/video-output-preflight.js` verifies Seedance storage before submission. `src/seedancePrompt.js` owns provider-specific prompt cleanup. Durable save_blocked recovery persists a separate storageBody rather than modifying immutable provider inputs.

`src/flux3Max.js` owns FLUX 3 Max settings, normalization, capabilities, request validation and unpriced cost metadata. `server/flux3Max.js` validates managed frame inputs, uploads and submits through Fal; `server/index.js` reuses video progress, managed downloads, History and the existing response shape. `src/modelOptions.js` exposes it in Video Model nodes and enabled-model Settings; it is excluded from the separate Video workspace. Director, Character and extra reference ports are disabled and rejected before submission. It uses the synchronous video path, so Seedance durable recovery does not apply.

FLUX 3 Max uses referenceImageIn for the first Keyframe row and stable dynamic ports for added rows. src/flux3Max.js owns row/port helpers and validates positioned images; NodeEditor resolves each row connection into flux3MaxKeyframes. Only per-row keyframes are supported for images; Start/End ports and legacy comma-separated request formats are removed. server/flux3Max.js validates all managed URLs before uploading frames. Director, Character, video and audio references remain unsupported.

Location scouting prompts and backward-compatible Subject/Location settings live in `src/coveragePresets.js`; `src/components/CoverageSettings.jsx` shares controls between legacy Coverage and Utility Coverage. Both run paths use the same single-image request runner and result checkpoints.

Utility Coverage resolves optional Style/Mood Board/Character connections through the shared effective-image prompt and active-sheet reference helpers. coveragePromptForInputs in coveragePresets.js reconciles scouting/identity/treatment constraints; runCoverageGeneration sends the base image first, followed by labeled board/character references through the existing image generation API.

PreviewLayoutTile owns Layout drag feedback; previewLayout.js owns insertion and mixed-media gallery ordering/edit contexts. NodeEditor coordinates existing media drag payloads and live Layout gallery navigation through OutputPreviewLightbox.

Director Approach definitions, default camera direction, planning directives, and final scene rules are owned by `src/filmDirectorApproaches.js`, including Camcorder. Style visual suffixes live in `src/modelOptions.js`; grade generation lives in `src/colorLook.js`. The shared Approach catalog also supplies creative-response enum validation.

Timeline Extract Frame uses the dedicated assembly-extract-frame route with frameTime, guarded by the timelineExtractFrame health capability so an outdated server cannot interpret extraction as a video render. server/assembly-render.js builds a one-frame plan from active visible clips and shares the composition filters with video renders, emitting PNG at the composition dimensions. server/index.js resolves only active local assets, writes through managed asset targets and records zero-cost local image history. AssemblyNodeBody owns the click-time snapshot/busy state and prepends the returned still to the current media bin state. AssemblyMediaBin publishes both its internal media ID and the shared full-resolution output drag payload so items can create track clips or canvas media nodes. Live frameOut and videoOut remain unchanged.

## Image editor inspector layout

`ImageEditStudio.jsx` owns the active-tool sections, shared edit/output controls and fixed generation footer. `ImageEditBoxes.jsx` owns compact box identity/actions and progressive-disclosure transform/blending/help/export controls. `imageEditStudio.css` supplies a consistent inspector rhythm and independent scrolling at desktop and narrow sizes. Native details/summary controls participate in the dialog focus trap; collapsed controls stay out of keyboard navigation.

## Video outpainting prompt guidance

`kreaSeedanceEditInput` in `src/kreaSeedance.js` owns Krea's inferred edit payload. The public schema at `https://api.krea.ai/openapi.json` was checked on 2026-10-23: the existing Seedance 2.5 endpoint accepts reference_videos and uses the source ratio/clock for edit prompts, with no explicit edit flag. `server/index.js` measures the source, reuses Krea uploads and durable jobs, and records the actual prefixed prompt and unpriced edit cost. Both Video Model Edit and Utility Seedance Outpaint follow Settings > Model Providers > Seedance. Krea draft completion remains unavailable; ordinary editing and outpainting work without a draft receipt.

Seedance preparation retains its original black-padded source for correspondence checks and writes a separate RGB 127 gray conditioning video covering outer regions plus the existing inward overlap. `plan.generationPaddingColor` identifies that cue for submission and analysis prompts; `VideoOutpaintControls` analyzes the actual conditioning video. Seedance-only preparation fingerprints invalidate cached black conditioning. `outpaint-coverage.js` recognizes retained neutral gray when this plan marker is present and retains historical black-border checks. Wan conditioning and routing are unchanged. This is a color-cue experiment, not mask-based or first-frame generation.

`VideoOutpaintPromptControls.jsx` owns the VACE prompt mode, guidance and analysis feedback. `videoOutpaintPrompt.js` owns prompt instructions and mode normalization. NodeEditor passes current managed source/mask URLs and runs analysis through the shared progress store with workflow context. `nodeApi.videoOutpaintPrompt` verifies the backend capability before submitting exactly once. `server/routes/videoOutpaintPrompt.js` validates inputs and records text usage/cost in History/Stats; `server/index.js` injects the existing media-analysis engine with an explicit Fal video route and configured native-video model. It does not fall back to another provider or generate a video. Late results cannot replace a locally edited prompt or a prompt whose inputs changed. Prepared source/mask media remain the existing VACE input contract.

`VideoOutpaintControls.jsx` adds the integrated Utility model. `videoOutpaint.js` owns compatible settings, source-preserving canvas geometry and prepared-asset fingerprints. `server/video-outpaint.js` prepares matched media/masks and restores original footage/audio with bundled FFmpeg through injected managed-asset helpers. Short segments are normalized into a managed loop unit and repeated with frame/sample-based timestamps to the planned duration; the managed full-resolution repeated source is reused for source restoration and optional audio. The plan records loop status, unit frame count and duration, which travel through existing prepared metadata into History/Stats. The `/api/node/video-outpaint-prepare` endpoint performs only local FFmpeg work. Seedance uses a static PNG matte for matching/analysis/review, generates no mask video, and receives only its source canvas through the selected provider’s editing route. No Wan preparation inference runs. The existing final visual reviewer checks context support for added objects. `server/outpaint-registration.js` measures stable per-edge displacement using native-pixel gradient correspondence and can align generated pixels before local color matching and feathering; the original core remains fixed. The existing Utility video route resolves Video Outpaint to an explicit Fal Wan VACE 14B endpoint, prepares fresh inputs and shares the existing request/cost/history implementation. It records native generated metadata before optional delivery composition and returns raw paid output with a warning if finishing fails. Result metadata travels through the existing Utility result normalization and preview/output flow.

`VideoOutpaintCanvasEditor.jsx` uses a native modal dialog with playback, seeking, fixed-ratio frame handles, numeric source-pixel controls, reset, cancel and Apply & prepare. `videoOutpaintFrame.js` owns source-width-normalized frame coordinates, corner anchoring, overlap validation and the source-crop/destination geometry. The backend uses the identical crop for source preparation, mask placement and restoration, without re-centering the user frame. Default frame-less workflows keep the previous centered fit. Fully source-covered frames use the existing local finish path and record a zero-cost local crop rather than calling Fal.

Soft snapping is pure geometry in `snapOutpaintFrame` with screen-space thresholds converted by the dialog viewport scale. Move snaps use independent horizontal/vertical anchors and a release band; corner snaps preserve the fixed ratio and opposite corner. The dialog renders transient guides and supports Alt bypass. The node persists the Snap preference separately from framing, so toggling it does not regenerate source/mask dependencies.


Video Outpaint's nested model defaults to Wan VACE for old workflows. Seedance 2.5 uses the same managed canvas/mask analysis, but submits only the padded video through the existing durable Seedance editing route. server/seedance-outpaint.js owns provider validation, scene-extension instructions, and finishing/raw-result preservation. The selected Fal/Atlas provider remains explicit; Krea edits reject. Preparation enforces a four-second Seedance edit minimum, repeating short sources at normal speed. Stored preparation and raw-output metadata travel with the durable job and History/Stats; Utility nodes participate in existing restart recovery and connected Output propagation. One Seedance Resolution selector controls both generation and export dimensions, with no Auto or separate delivery size; it replaces Wan-only steps, guidance scale and negative prompt. Small provider timing differences (up to 0.35 seconds) are bounded by holding the generated border's last frame; larger timing or ratio changes return the raw result with a warning. Source restoration cannot guarantee seamless alignment when Seedance changes motion.


Timeline clip replacement is owned by assemblyClipReplacementError and replaceAssemblyClipMedia in src/assembly/assemblyState.js. AssemblyNodeBody routes Ctrl/Command bin drops on stable clip ids through this transaction and the existing history/preview persistence path. Target clip geometry and identity remain stable; linked embedded audio changes atomically with the targeted source. Bin media and other instances are never rewritten.


Outpaint finishing uses server/outpaint-matching.js for bounded per-frame RGB overlap analysis, a conservative global color fit, timing-offset diagnostics and numerical boundary QC. server/video-outpaint.js applies corrections only to generated media, extends local boundary color corrections outward for a smooth blend, then restores the original core opaquely with blending only inside the authorized edge overlap. Analysis scratch files use an owned temporary directory removed after each finish. server/outpaint-visual-qc.js owns the automatic explicit Fal video review and separate paid text History/Stats record; invalid/uncertain responses cannot pass or trigger generation. server/routes/videoOutpaintFinish.js owns local reprocessing, rebuilds the prior source geometry rather than trusting client pixel plans, permits only finishing overrides, and records zero-cost video finishing separately. The existing progress store, Output target context and result normalization carry the managed result, raw source, matching parameters, QC scope/status/timestamps and warnings through save/reopen and durable Seedance recovery.


Seedance outpaint plans separate model submission frames/duration from outputFrames/outputDuration. Preparation holds a selected last frame to satisfy the four-second edit minimum plus a half-second guard; finishing trims to real selected frames and rejects insufficient generated coverage. Legacy plans retain their stored timing behavior. Boundary repair in video-outpaint.js extrapolates a bounded, blurred signed RGB residual from source versus generated overlap, preserving outpaint texture and compositing the original opaquely last. Local repair variants are measured and the best safe candidate is retained before visual review. Candidates are managed dependencies; only passing finishes are copied to a managed output target. src/outpaintQuality.js owns the final-export gate shared by Output and durable recovery. Run Output orchestrates a connected unfinished outpaint without replacing user framing or prompt decisions. QC is restricted to local finishing and visual review. It never resubmits Seedance or another image/video model; another fill requires an explicit user Run.

Seedance outpainting prepares directly from the original at the selected full generation canvas resolution (1080x1920 for 9:16 at 1080p), rather than the legacy 432x768 Wan canvas. Preparation uses H.264 CRF 12 and ProRes 4444 XQ MOV delivery; source fps is retained within the provider-supported 24–60 range. Fal outpaint requests use its documented high bitrate_mode and H264 codec with draft disabled. Atlas keeps its verified controls; no unsupported bitrate parameter is assumed. Prepared fingerprints are versioned to invalidate older small-canvas dependencies. Outpaint progress reads Generating Fill... initially and QC Edits... during regeneration.

Outpaint run ownership remains in src/nodeRunners/outpaintRetries.js for saved-call compatibility. Direct Run Outpaint and downstream Run Output each submit only the explicitly requested initial video. QC cannot retry generation for any defect, including geometry, anatomy, incomplete fill or timing. Local finishing and AI review retain their results/cost records; rejected candidates stay on the Utility and cannot replace a passed Output. The server rejects legacy automatic repair submissions before uploads. User framing and creative prompts remain unchanged.


Video outpaint finishing first compares an unchanged-fill/source composite with bounded local color-match and overlap-feather variants. Blend Width is a maximum inward overlap in delivery pixels; only that edge ring may mix generated pixels, while the original core overlays fully opaque. The model generates beneath this ring; Wan preparation expands the generation mask inward by the corresponding amount. Full-resolution pixel spacing is retained across every join in every frame (only the long axis of thin strips is reduced), with per-edge seam and temporal measurements in server/outpaint-boundary.js. A candidate must improve the score without worsening another edge or the protected core; rejected variants roll back. AI reviews the selected local finish once and cannot widen the blend. This is not a guarantee of visual perfection. Results preserve local variant scores, selected width, global/local matching status and QC in existing History/result metadata.

Wan VACE outpainting prepares a 720p canvas (720x1280 portrait), its documented route maximum, using CRF 12. Requests explicitly select 720p, maximum video quality, no acceleration, no automatic/temporal downsampling and no interpolation. A 1080p delivery from Wan remains an upscale; Seedance supports native 1080p. No provider or API-key preference is changed.

Atlas Seedance outpainting requests native 1080p by default with draft disabled; its documented output_format=mov requests yuv444p for the retained generation intermediate. Native resolution choices remain user-controlled. Higher -sr/-esr resolutions are enhancement products, not native generation, and are not silently substituted. Provider usage and the MOV request are recorded through the existing durable job/History path; final delivery uses ProRes 4444 XQ MOV with planar 16-bit RGB matching, a 10-bit 4:4:4 composite and PCM audio. Higher precision does not restore absent source detail. AI review uses a high-quality H.264 dependency proxy; the master remains the MOV. Existing MOV playback uses the runtime browser-preview path.

Output offers Same as input (no conversion) for video. ProRes 4444 outpaint masters select it automatically unless the user explicitly chooses a delivery format; the same effective choice drives filename preview and saving, preserving the master bytes rather than silently transcoding to H.264 or ProRes 422. Explicit format changes persist outputVideoFormatExplicit; existing video outputs follow their input until a conversion is explicitly selected.

All video Output nodes default to Same as input (no conversion), copying the input container, video and audio without re-encoding. Format selections become explicit via outputVideoFormatExplicit; until then, legacy default format values do not request conversion. Selecting the contextual MOV option for an outpaint XQ master also copies it unchanged. Explicit MP4 checks the source codec (HEVC in an MP4 container must still convert to H.264); ordinary explicit ProRes conversion remains 422 HQ. Filename preview and save share the effective selection.

Run Output locally refinishes a retained raw outpaint before buying a new generation when source, framing, model, resolution and timing still match. Current color/overlap controls may change without changing that framing. Source/framing changes require new generation; seam-only failures remain local. This reuses prepareOutpaintCanvas and the existing tracked finish route with the explicitly selected Output target.

Seedance outpaint submissions keep the selected source clock intact and pad only the tail to an 8n+1 frame count to avoid observed Edit frame-count quantization. The cloned-leading-hold experiment did not reliably fix opening defects and is not enabled for new runs. Stored preroll and frame counts remain authoritative for reprocessing old raw media. Analysis uses only the submitted-video clock and drafts describe boundary events rather than numeric delivery times. Normal submissions include spatial and same-frame attachment instructions. `server/outpaint-timing.js` can correct a confident uniform offset; `server/outpaint-motion.js` checks every source frame, known overlap and boundary feature patch, plus outer black-band coverage. `matching.motionValidation` travels with History and results. Rejected candidates remain dependencies, not export targets, and `src/outpaintQuality.js` gates Output and durable recovery. The local checks are separate from disabled aesthetic QC and do not certify unknown anatomy or generated regions.

Blend Width is the requested inward overlap (no automatic halving). Local variants compare wider outward color falloffs of up to 256px while keeping that overlap/core fixed. MOV browser proxies and QC proxies use CRF 12 and error-diffusion dithering for 8-bit compatibility; runtime cache keys are versioned to discard older lower-quality previews. Native source/generation bit depth is not inferred from a higher-precision delivery container.

### Outpaint temporal evidence and real inward overlap

Utility Video Outpaint uses Seedance Edit. Prepare canvas & mask keeps the full original padded reference for analysis/restoration, creates a separate `generationVideoUrl` with black padding extended inward by Blend Width on expanded sides, and keeps a matching local static PNG matte. Only the generation canvas is sent to Seedance; no mask video is generated or submitted. The original core is restored after fill, with authorized inward overlap blending. The preparation fingerprint invalidates older canvases.

Analyze & draft prompt uses `server/outpaint-frame-presence.js` to present every selected delivery frame in numbered source contact sheets to the configured Fal video-analysis model through its vision route. Batches contain at most 24 frames; frame IDs and complete coverage are validated before drafting. Each paid analysis batch records usage/cost and managed evidence images in History/Stats, including malformed responses. Verified frame-indexed observations feed the final native-video prompt draft. Failed coverage preserves the existing prompt. Held conditioning handles repeat the first/last source frame and use the corresponding presence. This supplies every frame as evidence; it does not guarantee model perception or generative compliance. Hidden generation instructions enforce same-frame attachment, entrances/exits and occlusion: never pre-create legs or other parts based on later footage. QC is disabled; finishing uses only a deterministic inward source-overlap blend, with no review or regeneration.

Seedance outpaint instructions are kept concise so the shared 4000-byte adapter budget cannot silently remove geometry or frame-presence rules. `src/outpaintPromptBudget.js` reserves the actual hidden canvas/overlap bytes inside a 3900-byte submission budget and caps editable direction at the remaining space (up to 1100 UTF-8 bytes). Analyze requests that exact budget and fits oversized returned drafts locally before displaying them. Submission applies the same fitter to saved, pasted and connected prompts, so the length warning does not block Run. Whole sentences are preferred, timing/negative instructions take priority, and Unicode code points are never split. Hidden preservation/presence/canvas instructions are never compacted. The full original analysis draft is retained in History; submitted generations retain the original user prompt and record whether fitting occurred. No additional paid shortening call is made.

### Current outpaint finish: QC paused

`src/outpaintFrameOne.js` owns the mandatory completed-at-t=0 rule shared by Seedance submission, Wan submission and Analyze guidance. It is appended after editable direction (including repair paths) and reserved by the existing UTF-8 prompt budget; the opening submission also establishes the completed first frame. Wan negative conditioning forbids animated bar removal and delayed fill. These prompt controls do not assert that generated footage has passed visual validation.

QC is disabled globally, including saved settings with finalQc/visualQc enabled. `server/video-outpaint.js` no longer calls numerical candidate selection, AI review, color fitting or registration. It composites the actual original crop (never its black padded canvas) through a smoothstep alpha ring inside Blend Width and preserves the opaque original core. Generated pixels outside the original rectangle are unchanged apart from delivery encoding/scaling; no single-edge-row delta is extruded outward and no corrected interior patch is inserted at a hard boundary. These former corrections introduced streaks and bands into otherwise clean backgrounds. Timing/aspect validation still preserves unusable raw results rather than exporting incorrect timing.

Finished results record matching.finishVersion=3 and qc.status=off. Output accepts that explicit finished state, without claiming QC passed; raw or failed legacy results still require local finishing. Auto Match is hidden while its old controls remain saved for compatibility. Analyze and hidden generation instructions require supported background surfaces, structural edges, textures, depth and perspective to continue with the same spatial/temporal continuity as foreground subjects. Shared rules are footage-agnostic; only the per-clip analysis supplies scene-specific details from evidence. Paid Analyze is user initiated; it remains separate from disabled post-generation QC.
