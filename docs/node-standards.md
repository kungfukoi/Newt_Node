# NewtNode Development Standards

This is a living standard for NewtNode. It describes the current conventions for nodes, UI, media flow, backend routes, cost tracking, and verification. Amend it when the app deliberately changes direction. Do not bypass it casually.

Snapshot verified against package version `3.0.0-beta.0` on 2026-08-28. Runtime source and tests expose the current implementation; this document defines the intended durable contract. Resolve drift in the same change that discovers it.

Before starting any new feature, read this document first. If the feature changes a core workflow, update this document in the same change so the next feature starts from the current truth.

## Goals

- Keep every node predictable to build, use, save, load, preview, run, and debug.
- Preserve a clean canvas by default, with advanced controls hidden behind Settings.
- Make media types explicit so connector lines, ports, previews, stats, and backend routes stay in agreement.
- Track generation cost honestly whenever the app can estimate or record it.
- Prefer small, compatible changes over one-off node behavior.
- Keep saved workflows portable enough that another user can open and run a packaged graph from a shared drive when the needed assets are included.
- Keep runtime configuration, update, and restart behavior local, visible, and cross-platform.

## How Agents Must Use This Standard

Before implementation:

1. Read `AGENTS.md`, this document, `architecture.md`, and `development.md`.
2. Inspect the current branch and dirty worktree. Preserve changes not created for the task.
3. Identify the internal node type, persisted fields, port ids, routes, result types, and compatibility names involved.
4. Complete the feature-impact audit below and find the current owner in the code-ownership map.
5. Read the closest tests and representative old workflow normalization before editing.

During implementation:

- Extend an existing contract instead of creating a node-local result, request, storage, preview, or persistence shape.
- Design old-workflow normalization before renaming or removing persisted data.
- Keep reusable behavior out of `NodeEditor.jsx`; move pure logic into a focused owner and test it there.
- Treat frontend, backend, persistence, history/Stats, progress, error states, and documentation as one feature when the change crosses those boundaries.

Before completion:

- Run the validation tier in `development.md` plus the relevant checks at the end of this document.
- Inspect the final diff and worktree for credentials, generated files, machine paths, and accidental runtime data.
- Update this document when a durable rule changed and update `architecture.md` when ownership or data flow changed.
- Do not commit, merge, pull, push, switch branches, or discard work unless the user explicitly requests it.

## Current Product Snapshot

These are durable current surfaces independent of the checked-out branch name:

- The Settings workspace is part of the app shell and owns local API keys, update repository, branch status, pull/update, and restart requests.
- React Flow is the active canvas runtime. Proxy, compact, and map render modes are currently disabled; complete node bodies and all edges remain mounted from the minimum 5% zoom through working zoom.
- Image, video, and text model runs expose per-node generation progress with queue, generation, download, finalization, batch, elapsed-time, and terminal states.
- The File menu owns New, Save, Save As, Open, and Import. New starts a blank workflow through the same unsaved-change guard as Open and Import.
- Text Model and Text Agent default to GPT-5.6 Terra through Fal OpenRouter unless environment variables override it. Connected images use Terra vision. Connected videos use Gemini 3.1 Pro Preview through Fal's native-video OpenRouter route so temporal progression and audio remain available to the text request.
- Current Image Model labels are `Z-Image`, `Seedream 5.0 Pro`, `Nano Banana 2`, `Nano Banana Pro`, `OpenAI Image 2`, `REVE 2.1`, and `Krea 2 Large`. Current Video Model catalog labels are `Seedance 2.0`, `Seedance 2.5`, `MiniMax H3`, `Kling O3 Pro`, `Kling O3 4K`, `Gemini Omni Flash`, `Wan 2.7 Reference-to-Video`, and `Creatify Aurora`. New Video Model nodes prefer `Seedance 2.5` when it is enabled; callable labels, enabled preferences, and workspace filtering remain owned by `src/modelOptions.js`.
- Utility coverage includes local media transforms, pose/depth/matte tools, hosted Wan/VACE and upscaling models, and local ComfyUI WanBlend/WanSegment/WanWarp workflows. SAM 3 options remain hidden while `sam3SegmentationModelsEnabled` is false.
- Stable node ids are the canonical graph identity. Visible titles and `@tokens` may change, but saved edges, reference bindings, Output routing, and dependency scheduling must continue to resolve by id.
- An attached Output node redirects generated files to its configured target without replacing the source node's playable result URLs or breaking Preview nodes after save/reopen.
- Workflow saves should stay fast: the client upserts the returned project summary, and the server rebuilds workflow indexes after the save response rather than blocking the write path.
- App version displays derive from package metadata and update with the release bump; never hard-code a version in UI copy.

## New Feature Checklist

Use this quick pass before implementing a feature, and again before committing it.

- Read the relevant standards in this document first.
- Identify which surfaces the feature touches: node catalog, node data, ports, run order, backend routes, asset persistence, stats, saved workflows, and UI states.
- Use the code ownership map below before editing `NodeEditor.jsx`; prefer the focused helper modules for pure logic, persistence, media handling, and API calls.
- Prefer existing helpers and patterns before adding a new storage, request, preview, or result shape.
- Preserve existing saved workflows with normalization or migration when fields, ports, node types, or asset URLs change.
- Keep generated files and copied dependencies inside the current workflow package when a package is attached.
- When a frontend/server change affects startup, routing, or lazy assets, run `npm run smoke:app` with the dev server running in addition to tests/build.
- Update this document when the feature intentionally changes one of these standards.

## Feature Impact Matrix

Audit every applicable row before declaring a feature complete.

| Change area | Required surfaces to inspect |
| --- | --- |
| Node type or control | Catalog/icon, config, defaults, normalization, UI body, resize, CSS, empty/disabled/error states, tests |
| Ports or references | Port ids/colors, compatibility, auto-connect, edge normalization, handle measurement, dependency order, `@` bindings, copy/import |
| Provider or model | Stable label, enabled-model Settings, credential/provider routing, capability-specific controls, request builder, validation, response normalization, progress, failure diagnostics |
| Generated or derived media | Managed local persistence, result items, selected index, Preview, output rail, download, drag/drop, downstream connections, save/reopen |
| Paid operation | Provider/endpoint/model metadata, duration/resolution/input counts, reproducible settings, cost or unpriced state, history, Stats |
| Workflow persistence | Current document shape, old normalization, Save As, autosave, Recent, package identity, asset rebasing, missing-file behavior |
| Canvas or geometry | React Flow ownership, live resize/drag, handles/edges, selection, text editing, pan/zoom, 5/8/30/100% checks, large graph behavior |
| Backend or control route | Input/schema validation, route owner, API wrapper, health capability, smoke test, timeout/cancellation, small response shape |
| Filesystem or desktop action | Path containment, filename sanitation, managed roots, Explorer/Finder/dialog parity, Windows/macOS launch/restart/update behavior |
| Heavy UI or dependency | Focused module/component, lazy boundary, package files, dependency preflight, production bundle report |

## Refactored Code Ownership

`NodeEditor.jsx` remains the canvas/UI orchestrator, but new work should not default to adding more pure logic there. Keep reusable logic in the smallest existing module that owns the concern.

| Area | Primary files | Standard |
| --- | --- | --- |
| API clients | `src/api/newtApi.js` | Add browser-side route wrappers here instead of scattering raw `fetch` calls. |
| App shell and Settings | `src/main.jsx`, `src/SettingsPage.jsx`, `src/api/newtApi.js`, `server/routes/core.js`, `server/index.js` | Lazy-load Settings from the app shell. Keep settings API wrappers in `newtApi.js`; register Settings, update, restart, health, and storage routes through `server/routes/core.js`; keep runtime config implementation in `server/index.js`. |
| Node registry | `src/nodeRegistry.js`, `src/NodeEditor.jsx` icon map | Add catalog definitions in `nodeRegistry.js`; add only the display icon mapping in `NodeEditor.jsx`. |
| Node config/defaults/normalization | `src/NodeEditor.jsx` | `getNodeConfig`, `createDefaultNodeData`, and `normalizeCurrentNode` still live here. Keep backward-compatible migrations close to these functions until they are deliberately extracted. |
| Run scheduling and result state | `src/nodeRunner.js`, `src/nodeRunners/*` | Batch counts, batch result aggregation, selected-node dependency scheduling, and run status text belong in `nodeRunner.js`. Node-specific API runners and reusable request/result builders belong in focused files under `src/nodeRunners/`. |
| Generation progress | `src/generationProgress.js`, `src/generationProgressStore.js`, `src/components/GenerationProgress.jsx`, `server/generation-progress.js` | Build run metadata and aggregate batches in the client helpers, poll through the shared store, render the accessible node progress bar in the component, and keep request-scoped provider state in the server module. |
| Media drag/drop and imported asset shape | `src/mediaAssets.js` | Output-rail drag payloads, external file type detection, file-to-node mapping, and media accept rules live here. |
| Result items | `src/mediaResults.js` | Normalize, append, label, and download result items here. Do not hand-roll result array merging in node run branches. |
| Character sheet library | `src/characterSheetLibrary.js`, `src/characterVideoSheets.js`, `src/NodeEditor.jsx` | Keep generated/custom sheet identity, normalization, selection, and downstream reference resolution in the focused helpers. `NodeEditor.jsx` coordinates upload, generation, removal, and display only. |
| Output routing and tokens | `src/outputConnections.js`, `src/outputTokens.js`, `server/outputTargets.js` | Keep accepted source kinds and browser token insertion focused in `src`; keep path expansion, unique-file reservation, and external-output URL encoding server-side. |
| Cross-workflow clipboard | `src/workflowClipboard.js`, `src/workflowState.js`, `src/nodeGeometry.js` | Serialize selected graph fragments, remap copied ids and bindings, and place pasted selections through these helpers. |
| Node identity and `@` references | `src/nodeReferences.js`, `src/workflowState.js`, `src/NodeEditor.jsx` | Treat node ids as canonical identity. Keep reusable mention parsing, binding, and visible-token rename helpers in `nodeReferences.js`; remap ids and bindings in `workflowState.js`; let `NodeEditor.jsx` coordinate bindings with live node/group state. |
| Model, utility, and edit options | `src/modelOptions.js`, `src/editEffects.js` | Model names, preset names/prompts, aspect ratios, duration/resolution lists, utility descriptions, model-control option lists, and Edit node effect definitions live here. Keep labels stable because saved workflows and UI normalization rely on them. |
| React Flow canvas | `src/components/NewtFlowCanvas.jsx`, `src/components/NewtFlowContext.jsx`, `src/flowOverview.js`, `src/flowNodeInteractions.js` | React Flow owns viewport transforms, node movement, selection, handles, and edges. `flowOverview.js` owns the disabled overview-mode feature flags; `flowNodeInteractions.js` owns dynamic no-drag boundary discovery so controls and media drags are not captured as node movement. |
| Canvas chrome | `src/components/CanvasChrome.jsx` | Shared canvas overlays, selection actions, and workflow prompt UI live here. Keep hot drawing and UI chrome out of `NodeEditor.jsx`. |
| Preview/result UI | `src/components/MediaViews.jsx`, `src/components/Model3DViewer.jsx` | Shared previews, result panes, project output drawer, output lightbox, lazy output-rail media loading, and the lazy 3D viewer wrapper live in `MediaViews.jsx`. The actual GLB renderer lives in `Model3DViewer.jsx`. |
| Small node bodies | `src/components/NodeBodies.jsx` | Plain Text, Text Model, Text Agent, upload media, and Composer summary bodies live here. Preserve their prop-driven behavior and class names when extending them. |
| Composer/camera 3D UI | `src/components/ComposerViewport.jsx`, `src/components/CameraControlViewport.jsx`, `src/composerState.js`, `src/composerRender.js` | Interactive Three.js viewport shells for Composer and Camera live in the component files. Composer defaults, normalization, saved pose fields, and image plane helpers live in `composerState.js`; Composer Three.js rendering and mannequin asset loading live in `composerRender.js`. Composer pose preset API wrappers live in `src/api/newtApi.js`; backend pose-library persistence lives in `server/routes/composerPoses.js`. |
| Node port rows and transfer collage | `src/components/NodePorts.jsx`, `src/components/StyleCollage.jsx` | Reusable port handles/rows and the transfer mood-board collage live here. Keep class names and drag/drop behavior stable because many node bodies depend on them. |
| Settings page | `src/SettingsPage.jsx`, `server/index.js` settings routes | Runtime API key entry, repository update, restart, branch status, loaded app version, and enabled-model preferences live here. Keep settings data local and avoid exposing secret values in logs, history, or docs. |
| Project output rail data | `src/projectOutputs.js` | Build, filter, and navigate project output rail items here; keep filesystem/history filtering and adjacent-image selection out of render code. |
| Canvas geometry | `src/nodeGeometry.js` | Node bounds, graph bounds, rectangle math, menu clamping, and viewport modulo helpers live here. |
| Canvas media utilities | `src/canvasMedia.js` | Canvas-to-blob, browser image loading, cover drawing, and mood-board collage layout live here. |
| Color ID to Matte UI/helpers | `src/components/ColorIdMatteControls.jsx`, `src/colorIdMatte.js` | Picker UI state lives in the component file; color normalization, matte preview rendering, sample radius/tolerance bounds, and matte run item normalization live in the helper file. |
| Three.js runtime | `src/threeRuntime.js` | Lazy Three/GLTF loading and shared 3D math helpers live here. Do not import Three.js directly into common preview modules. |
| Workflow persistence | `src/useWorkflowPersistence.js` | Save, Save As, Open, Import, unsaved-change prompts, Recent workflows updates, and workflow status messages live here. |
| Draft persistence | `src/useNodeEditorDraft.js` | Browser draft loading, snapshotting, and debounced local draft writes live here. |
| Workflow files/session/state | `src/workflowFiles.js`, `src/workflowSession.js`, `src/workflowPreferences.js`, `src/workflowContext.js`, `src/workflowState.js` | File document shape, display paths, package/request context, picker preferences, graph cloning/remapping/fingerprints, deduping, and stale runtime cleanup live here. |
| Backend route registration | `server/index.js`, `server/routes/*` | `server/index.js` owns shared app setup and existing route implementations. New low-coupling route groups should register through `server/routes/*` and receive explicit dependencies from `index.js`. |
| Local custom workflow engines | `server/<workflow-name>/*` | ComfyUI or other local workflow-specific engines live in a focused server folder with tracked templates, manifest metadata, prompt patching, queue/poll logic, managed output copying, and history recording. Keep provider-specific graph patching out of browser code. |

When adding a new feature, put pure helpers in one of these modules or create a similarly focused module. `NodeEditor.jsx` should coordinate React state, node rendering, event handlers, and node-specific orchestration, not become the home for reusable algorithms.

## Migrating Pre-Refactor Features Into The Current App

Some future features may arrive as patches or branches built before this refactor. Treat those as source material, not as code to paste wholesale. The goal is to preserve the feature behavior while landing it in the current ownership map above.

Start every pre-refactor feature merge with this audit:

- Identify every touched surface in the incoming implementation: node catalog, icon, config, defaults, normalization, ports, connection rules, UI body, model options, API client call, backend route, run scheduling, result items, preview behavior, workflow persistence, stats, CSS, and tests.
- Compare those surfaces to the current ownership map before editing. Move incoming pure helpers, option lists, request builders, route wrappers, and preview utilities into their current focused modules.
- Keep `NodeEditor.jsx` as the coordinator. It may select node bodies, wire callbacks, own current node config/default/normalization functions, and call runner helpers. It should not regain large copied algorithms, static model catalogs, request payload builders, or reusable media utilities.
- Preserve saved-workflow compatibility first. If the incoming feature added or renamed fields, ports, node types, result shapes, or asset URLs, add normalization/migration for previous and current saved workflows in the current normalization path.
- Preserve UI class names and visible behavior unless the feature intentionally changes UI. When moving incoming JSX into a component, pass data and callbacks through props instead of reaching into editor state from the new component.
- Keep result arrays, selected result indexes, previews, and downloads using `mediaResults.js` and shared preview helpers. Do not introduce a new result shape for one feature unless all shared preview/download/stat surfaces are updated together.
- Keep model/provider names and dropdown option labels stable. Put new static model names, durations, aspect ratios, presets, and descriptions in `modelOptions.js`; saved workflows may depend on exact strings.
- Add browser API wrappers in `src/api/newtApi.js` before using a new route in UI code. Avoid scattered raw `fetch` calls.
- Prefer focused runner helpers under `src/nodeRunners/` for backend payloads and result normalization. The editor should assemble connected inputs and pass them to a runner/builder, not own the full request body when the shape is reusable.
- Register new backend route groups through `server/routes/*` when possible, with explicit dependencies from `server/index.js`. If extending an existing route in `server/index.js`, keep the change tightly scoped and document why it stayed there.
- Keep workflow package behavior intact. Imported or generated files should continue to use workflow context helpers so Windows and macOS users can move packaged workflows without broken asset references.
- Check cross-platform assumptions. Do not hard-code Windows path separators, drive letters, shell commands, hidden-folder behavior, or `.exe` names in browser code or shared helpers. Use Node `path` APIs server-side and document platform-specific commands separately when needed.
- Update this standards document in the same change when the incoming feature introduces a new durable pattern or changes a current one.

Use this placement guide while migrating pre-refactor code:

| Incoming code shape | Current landing place |
| --- | --- |
| Node catalog entry | `src/nodeRegistry.js`; icon only in `NodeEditor.jsx` |
| Static model names/options/descriptions | `src/modelOptions.js` |
| Edit effect groups, labels, controls, and defaults | `src/editEffects.js` |
| Upload, drag/drop, media accept/type detection | `src/mediaAssets.js` |
| Result item normalization or append logic | `src/mediaResults.js` |
| Preview/result/lightbox/output rail UI | `src/components/MediaViews.jsx` or a focused component imported there |
| Small reusable node body JSX | `src/components/NodeBodies.jsx` or a new focused component |
| Port row/collage UI | `src/components/NodePorts.jsx`, `src/components/StyleCollage.jsx` |
| Color matte picker/state/math | `src/components/ColorIdMatteControls.jsx`, `src/colorIdMatte.js` |
| Composer scene defaults, pose fields, pose presets, image planes | `src/composerState.js`, `src/api/newtApi.js`, `server/routes/composerPoses.js` |
| Composer Three.js rendering | `src/composerRender.js` |
| Camera/Composer viewport shell controls | `src/components/CameraControlViewport.jsx`, `src/components/ComposerViewport.jsx` |
| Backend request wrappers | `src/api/newtApi.js` |
| Node-specific payload/result builders | `src/nodeRunners/*` |
| Graph geometry, bounds, placement, import offsets | `src/nodeGeometry.js`, `src/workflowState.js` |
| Save/open/import/recent workflows | `src/useWorkflowPersistence.js`, `src/workflowFiles.js`, `src/workflowSession.js` |
| Draft autosave | `src/useNodeEditorDraft.js` |
| Backend routes | `server/routes/*` plus explicit registration in `server/index.js` |

Before committing a migrated pre-refactor feature, run the normal verification checklist. For frontend/server changes, include `npm run smoke:app` with the dev server running. For features that touch save/load/import, also manually test opening a workflow saved before the feature and one saved after the feature.

## Current Media Types

Use these internal media type names consistently in node config, result items, preview handling, history, stats, and connection rules.

| Media | Internal type | Color | Typical output |
| --- | --- | --- | --- |
| Prompt/Text | `prompt` or `text` history media | `#f0c83b` yellow | prompt strings |
| Image | `image` | `#3d85ff` blue | png, jpg, webp |
| Video | `video` | `#58ce63` green | mp4, mov, webm |
| Audio | `audio` | `#ff8b35` orange | mp3, wav, m4a |
| Camera | `camera` | `#ef4444` red | camera instruction |
| Style | `style` | `#9b5cff` purple | style instruction |
| Transfer | `transfer` | `#ff4fb3` pink | TRANSFER.png |
| 3D | `model3d` | `#14d8c8` teal | glb, gltf |
| Preview | `preview` | `#8d8d8d` gray | preview input only |

If a new media type is added, update this table, `portColors`, preview logic, stats media mix, connection compatibility, and result rendering together.

## Current Node Catalog

`src/nodeRegistry.js` is the canonical catalog and order. Keep this list aligned when a node type is added, removed, renamed, or reordered.

| Internal type | UI label | Primary role |
| --- | --- | --- |
| `plainText` | Text | Lightweight prompt text |
| `text` | Text Model | AI-assisted text processing |
| `textAgent` | Text Agent | Persistent conversational text assistance |
| `image` | Image | Uploaded or connected image media |
| `video` | Video | Uploaded or connected video media |
| `preview` | Preview | Multi-result image, video, and 3D inspection |
| `output` | Output | Explicit filesystem save target |
| `autoAspect` | Auto Aspect | Legacy load-only type; new work uses Utility Image / Auto Aspect |
| `skillDirector` | Film Director | Scene package and shot-list direction |
| `storyboard` | Storyboard | Planned and generated shot frames |
| `coverage` | Coverage | Legacy load-only type; new work uses Utility Image / Coverage |
| `character` | Character | Locked character identity, wardrobe, and voice |
| `camera` | Camera | Camera instruction |
| `composer` | Composer | Composer and Frame It image-guide modes |
| `frameIt` | Frame It | Legacy load-only type retained for saved workflows |
| `style` | Style | Style instruction |
| `transfer` | Mood Board | Locked visual-transfer collage |
| `utility` | Utility | Local, hosted, and Comfy-backed image/video tools |
| `edit` | Edit | Local ffmpeg image/video editing |
| `assembly` | Timeline | Multi-track nonlinear video and audio editing timeline |
| `audio` | Audio | Uploaded or connected audio media |
| `model3d` | 3D | Multi-view GLB generation |
| `imageModel` | Image Model | Remote image generation |
| `videoModel` | Video Model | Remote video generation |

## Text Node Roles

- `Text` is the lightweight concatenation node: it has one multi-connection Text input, one editable local textarea, one live Result, one Prompt output, no run button, and no backend call.
- Text inputs concatenate in saved edge order, followed by the node's local text when it is non-empty. Persist the combined value in `data.resultText` so Prompt connections, `@` references, Output saves, and chained Text nodes all consume the same result. Reject circular Text-to-Text input chains.
- `Text Model` is the AI text-processing node. It can accept text, image, video, and style inputs, calls the local text-processing route, and records text model history/cost. Its default generation model is GPT-5.6 Terra through Fal/OpenRouter, with explicit environment overrides for model changes.
- `Text Agent` uses the same text, image, video, and style inputs as Text Model. `data.agentDraft` stores the unsent composer, `data.agentMessages` stores normalized user/assistant turns with the workflow, and `data.resultText` mirrors the latest assistant reply so existing Prompt connections and Output nodes continue to work. Enter sends a turn, Shift+Enter inserts a line break, and clearing the conversation also clears the current Prompt output.
- Text Agent's Previous/Next prompt buttons recall its earlier sent user turns without submitting them and restore the unfinished draft when navigation returns past the newest turn.
- Text, Text Model, and Text Agent prompts may mention nodes by name with `@Node Name`. An unbound mention initially matches the visible node title, including spaces, or a compact alias such as `@NodeName` or `@Node-Name`; after that match, the referencing node stores the selected source node id in `data.nodeReferenceBindings`. Text Model and Text Agent send referenced text, image, and video nodes as structured model context; Image and Video Model prompts that consume referenced Text output also receive referenced media nodes as prompt-side references when compatible.
- Existing saved `text` nodes represent `Text Model`; keep that compatibility unless a migration explicitly changes it.
- The default text-processing provider is Fal via `TEXT_LLM_PROVIDER=fal`. `FAL_TEXT_MODEL`, `FAL_VISION_TEXT_MODEL`, `FAL_VISION_TEXT_FALLBACK_MODEL`, `STORYBOARD_TEXT_MODEL`, and `STORYBOARD_VISION_TEXT_MODEL` default to `openai/gpt-5.6-terra`. `FAL_VIDEO_TEXT_MODEL` defaults to `google/gemini-3.1-pro-preview`.
- Fal text processing uses `openrouter/router` and should pass the app's text-processing instructions as `system_prompt`. Image helper descriptions use `openrouter/router/vision`. Video helper descriptions upload the connected video and use `openrouter/router/video` with Gemini 3.1 Pro Preview, preserving native temporal and audio context before Terra assembles the final response. Storyboard planning, QC, and generated export captions use the Terra routes.
- OpenAI text processing remains an explicit provider override through `TEXT_LLM_PROVIDER=openai` and `OPENAI_TEXT_MODEL`; do not silently switch providers in UI code.

## Node Identity And Reference Standards

- Every node has a stable, opaque `id`. That id is the canonical identity for edges, `@` references, groups, previews, output routing, dependency scheduling, and saved workflow relationships.
- A node title is a user-facing label only. Never use the title as the durable key for a connection, reference, result owner, or persisted relationship.
- Graph edges store `from.nodeId` and `to.nodeId`. Renaming either endpoint must not recreate, detach, or reinterpret the edge.
- `@token` text stays readable while its saved binding points to a node id. Store bindings on the referencing node as `data.nodeReferenceBindings`, keyed by the normalized visible token without `@`, for example `{ "depth": "utility-1786..." }`.
- Renaming a referenced node updates bound visible tokens throughout node data and moves the binding to the new normalized token, while preserving the bound node id. Renaming `depth` to `dogpile` therefore changes `@depth` to `@dogpile` without changing what the reference means.
- If a user manually replaces an old token with the renamed node's current token, resolve that token against the current title and persist the same source id under the new token.
- Existing workflows without `nodeReferenceBindings` migrate lazily when references are used. When duplicate titles exist, prefer a matching node in the referencing node's group, then the nearest matching node; persist the selected id immediately so later runs do not depend on node-array order or position.
- Saved bindings take priority over title matching. A bound token must continue resolving after the source node is renamed, even before the visible token update is saved.
- Copy and Import create fresh ids for copied nodes. Remap `nodeReferenceBindings` whenever the referenced node is included in the copied graph, just as edges and group membership are remapped. A binding whose source is not included may fall back to normal title resolution in the destination workflow; it must never silently bind to an unrelated stale id.
- Keep reusable parsing, binding-key normalization, duplicate ranking, and visible-token replacement in `src/nodeReferences.js`. Keep graph id and binding remapping in `src/workflowState.js`.
- `$node` in an Output node may render the connected source's current title into a path or filename, but the Output connection itself remains identified by edge/node ids.
- Product labels may differ from legacy internal types, route ids, or source filenames. Preserve internal compatibility unless a deliberate migration updates old workflows, normalization, tests, and documentation together; Timeline / `assembly`, WanWarp / `videoStitch`, and WanSegment / `transitionBuilder` are current examples.

## Node Definition Checklist

Every new node type should touch the same core surfaces unless there is a clear reason not to.

- Add it to `nodeTypeDefinitions` in `src/nodeRegistry.js` with a concise label, and add the lucide icon mapping in `NodeEditor.jsx`.
- Add `getNodeConfig(type)` with all input and output ports.
- Add defaults in `createDefaultNodeData`.
- Add normalization in `normalizeCurrentNode` so saved workflows remain stable.
- Preserve the node's existing `id` during every data, title, result, and layout update. Only explicit copy/import operations should assign a new node id, and they must remap all internal edges, group membership, and node-reference bindings together.
- Add connection rules in `getConnectionError`.
- Add auto-connect behavior in `preferredAutoInputPorts` and `autoConnectionOutputKind`.
- Add edge migration/color handling in `normalizeEdgeForCurrentGraph` when needed.
- Add run behavior in `runNode`, using `nodeRunner.js` helpers for batch/result state and a focused `runXGeneration` helper for API calls.
- Add result item typing through `normalizedResultItems`, `appendResultItems`, and `appendedNodeResultState`.
- Add preview media support through `previewMediaType` and `connectedPreviewSources`.
- Add backend route support and a health route flag when the node calls the local server.
- Add history and stats tracking if the node spends money or produces media.
- Add CSS only for the node-specific differences.
- Run the verification checklist before commit.

## Node UI Standards

Nodes should feel like they belong to the same editor.

- Header: icon, editable title, close button.
- Body: result pane first for generation nodes, then output, run button, Settings drawer.
- Default state: keep the node clean. Hide detailed controls inside Settings.
- Collapsed Settings: show port dots only when a compact representation is useful.
- Expanded Settings: show each input on its own `NodeRow` when the meaning matters.
- Use `OutputPortRow`, `NodeRow`, and `PortHandle` rather than custom port markup.
- Put short model descriptions at the bottom of model or utility nodes.
- Do not add visible explanatory UI text when a familiar control or clear label is enough.
- Keep card widths consistent. Model-like nodes currently use about `370px`.
- Avoid nested cards and large marketing-style blocks inside node UI.
- Use the app yellow for primary run actions.
- Use icon buttons for small actions such as download, step, delete, and navigation.
- Media drag surfaces that appear after upload, generation, tab changes, or workflow restoration must immediately carry React Flow's `nodrag` boundary. Media wrappers should declare `nodrag` directly, while the node-card observer handles newly inserted elements and reused elements whose interaction attributes change. Do not observe `class` while also adding `nodrag`, because that can create an observer feedback loop during drag startup.
- Pasting copied nodes on the canvas anchors the copied selection's top-left at the current mouse position. Multi-node pastes must preserve the copied nodes' relative spacing and internal edges.

## Node Resizing Standards

Every catalog node uses the shared bottom-right resize handle. Resizing changes the node shell and its interior layout together; it must never create a large empty shell around a fixed-size body.

- Persist shell dimensions as `data.nodeWidth` and `data.nodeHeight`. Normalize them through `normalizedNodeWidth` and `normalizedNodeHeight` in `src/nodeGeometry.js`; do not introduce node-local width/height fields for the outer card.
- The current width range is the node type's estimated/default width through `2400px`. The current height range is `180px` through `3000px`. If a node needs a larger minimum width, add it to `estimatedNodeWidth`; if graph bounds or paste/culling behavior needs a better default height, add it to `estimatedNodeHeight`.
- Current minimum/default widths are `1080px` for Timeline, `980px` for Frame It, `920px` for Storyboard, `760px` for Film Director and Character, `390px` for Text Agent, Auto Aspect, and Coverage, `370px` for Image Model, Video Model, Utility, Edit, and 3D, `360px` for Camera and Style, `335px` for Mood Board and Preview, and `310px` for the remaining node types.
- A custom-size card is a column flex container. Its title and compact controls remain `flex: 0 0 auto`; the node body and primary workspace use `flex: 1 1 auto` with `min-width: 0` and `min-height: 0` so descendants can actually shrink and grow.
- Do not leave fixed heights, fixed margins, or `justify-content: space-between` behavior that turns added height into dead space. Put overflow on the controls or list that needs it, not on the entire media-first body unless the whole body is intentionally a form.
- Image, Video, generation-result, Preview, Storyboard, Character, Composer, Frame It, and Mood Board nodes are media-first when enlarged. Their preview, board, collage, or viewport must consume the largest useful share of remaining space; upload controls, tabs, ports, run buttons, status text, and settings headers stay content-sized.
- Media inside a resized region uses the full available width and height with `object-fit: contain` unless the node's explicit editing behavior requires cropping. Never stretch media or replace its native aspect ratio with a viewport-relative font/width trick.
- Fixed-aspect workspaces such as Composer and Frame It should use a size container and fit the largest complete aspect-ratio surface within both available dimensions. They must respond to height-only and width-only changes without overflow or clipping.
- Storyboard grids and Character layouts may reflow, but generated frames, the selected sheet, and essential controls must remain reachable. Enlarging these nodes should increase useful media area before it increases gaps.
- Textareas may retain their specialized resize state, but a shell resize clears stale inline textarea dimensions and lets the node layout own the available space. Typed controls must keep local draft updates responsive and should not force a whole-graph commit on every keystroke.
- Resizing is a graph edit: push one undo snapshot at resize start, update dimensions during the gesture, preserve the final dimensions in workflow saves, and include them in graph bounds, culling, paste placement, and selection calculations.
- A node-specific legacy preview-scale handle may coexist only when it scales a distinct artifact rather than the outer shell. It must not fight the shared `nodeWidth`/`nodeHeight` layout or create nested resize behavior users cannot predict.
- `ResizeObserver` must remeasure node cards and ports while dimensions change. Connector lines must stay attached throughout the drag and settle on the final endpoints without requiring a click, collapse toggle, pan, or zoom to refresh.

When adding or changing a resizable node, verify its minimum size, width-only growth, height-only growth, diagonal growth, shrink-back behavior, saved/reopened dimensions, controls at both extremes, media aspect ratio, scroll reachability, and every connected port before considering the layout complete.

## Port And Connection Standards

- Ports should be typed by media and colored from `portColors`.
- Port ids should describe purpose, not only type, when ambiguity matters.
- Generic ids like `imageIn` are acceptable for simple nodes.
- Specific ids like `frontImageIn`, `maskVideoIn`, or `referenceAudioIn` are preferred when the backend treats them differently.
- Input labels should be short and concrete: `Front`, `Mask Video`, `Prompt`.
- Collapsed input stacks should show colored dots without extra labels.
- Expanded settings should expose named inputs in rows.
- Connector lines inherit the source output color.
- Connector endpoints and all connection lookups use node ids and port ids. Titles are never connection keys.
- React Flow owns the live viewport, node transforms, handle geometry, selection, and edge paths. Do not add an independently transformed wire layer or a second viewport cache.
- Ports render as React Flow handles while preserving Newt's node ids, port ids, media colors, connection rules, and click-to-disconnect behavior. Dynamic port changes must call React Flow's node-internals update path.
- Connections begin at output ports and end at input ports. Dragging from an output must show the live connector line through completion; do not enable React Flow's click-to-connect mode as a substitute for the established drag interaction.
- Every compatible input port accepts additional incoming edges. Dropping a line on an already-connected input appends it without replacing existing lines; only an exact duplicate source-to-input connection is de-duplicated.
- Clicking a connected input dot without dragging removes every edge terminating at that node and port. Completing a dragged connection must never invoke this click-to-disconnect action.
- Image Model `imagePromptIn` retains every connected image and sends them as Image Prompt references.
- If a connected control section is collapsed, keep its handle mounted or provide a stable equivalent handle position. Presentation changes must never remove the saved edge or make a valid connection appear detached.
- Collapsing an input section changes only presentation. It must not remove the edge, invalidate its saved port id, or make its connector disappear; expanding it must remeasure the real endpoint immediately.
- Seed initial node dimensions and connected handle bounds from persisted or estimated graph geometry. Virtualization must not require every heavy node body to mount once before offscreen culling begins.
- Proxy, compact, and map modes are disabled while `flowOverviewEnabled` is `false`. Keep all React Flow nodes and edges mounted and keep `onlyRenderVisibleElements` disabled so distant graph structure does not disappear or respawn while panning. Any future virtualization or semantic mode must be opt-in, tested on production-scale workflows, and documented here before it becomes active.
- Keep normal connectors visually lightweight and use `vector-effect: non-scaling-stroke` so zoom does not make wires look fat or thin. Selection, draft, active, and inactive styles may differ, active processing retains its animated dash, and hit testing remains generous without increasing visible line weight.
- Incompatible connections should fail with a plain, helpful message.
- Auto-created nodes from a dragged connector should link only when compatible.
- Backward compatibility matters: if a port is renamed, migrate previous edge shapes in `normalizeEdgeForCurrentGraph`.

## Result And Preview Standards

- Generation nodes should keep previous results instead of clearing the result pane.
- Result panes should support image, video, and 3D model display.
- Videos should loop when played in Video and Preview nodes.
- Video result panes and video media previews preserve browser playback controls while supporting direct drag-out from the picture or drag grip. Dropping that payload on the canvas creates a Video node from the full-resolution source.
- Preview nodes should preserve existing preview history and update to the latest connected generation result.
- Preview nodes should support stepping through multiple connected or generated results.
- Preview's primary image view uses the full-resolution source, not a proxy thumbnail. Thumbnails are display-only for compact grids and rails; drag, edit, export, download, native Save Image, and downstream connections must resolve to the original media URL.
- Preview/Layout must fit the complete board inside the resized node. All rows share the available board height, every image uses `object-fit: contain`, and unused cell space remains black. Resizing may scale or letterbox layout images but must never clip a row, crop an image, or change an image's aspect ratio.
- Generated outputs should have a node-level download affordance when possible.
- 3D outputs should be displayed with the shared lazy Three.js GLTF viewer.
- If a node returns multiple outputs, store them in `resultItems` with explicit `type`, `url`, `label`, and optional `cost`.
- Result item normalization and append behavior belongs in `src/mediaResults.js` and `src/nodeRunner.js`; do not duplicate result merging logic inside individual node branches.
- The project output rail should show every retained local output from the current graph and matching project history, up to the backend's 500-generation retention window. A new generation must add to the rail rather than replacing earlier project generations. Include `/outputs/<workflow-name>/...` and packaged `/workflow-assets/<workflow-id>/outputs/...` URLs; do not add absolute machine-local paths or browser object URLs.
- Assign every new or otherwise unidentified workflow a unique session ID before its first generation. Preserve that ID through normal saves so output history remains attached to the workflow, and issue a fresh ID when starting another new workflow.
- Project output rail data belongs in `src/projectOutputs.js`; shared preview/result UI belongs in `src/components/MediaViews.jsx`.
- Route API-served local media through `displayMediaUrl`. During split-port development, `/uploads`, `/outputs`, `/external-outputs`, `/workflow-assets`, `/api/media-thumbnail`, and `/api/video-preview` must resolve through the backend origin instead of accidentally requesting them from Vite.
- When a thumbnail fails, retry its known full-resolution source before showing the NewtNode logo. The logo is a missing/unresolved-media fallback, never a replacement for an existing local file.
- A model or Utility run redirected by an Output node must still write the real saved public URL into the source node's `resultItems`/`resultUrl`. Connected Preview nodes must receive those same playable items; do not substitute the Output node title, a filename-only string, or the logo.
- Fetch output history lazily when the output rail first opens. Manual refresh and generation completion may still refresh it immediately.
- Output rail thumbnails should keep layout stable and lazy-load image/video media as they near the visible rail; the full-size lightbox owns eager preview loading after double-click. When a lightbox was opened from the output rail, unmodified Left/Right Arrow keys step through image items only, skip other media types, and wrap at the ends. Do not capture those keys while a text or form control is being edited.
- The project output rail must resize horizontally from its left-edge grip while always retaining one thumbnail column. Resizing changes only that column's width and the preview size within it. Every image and video fills the column width, derives its height from the media's native aspect ratio, remains fully visible, and must never crop, stretch, or cover preview media.
- Dragging from the output rail into a compatible node should reuse the existing local output URL instead of re-uploading or copying the asset. Keep the imported asset shape aligned with normal uploaded assets so saved workflows remain portable.
- Dragging from the output rail onto the canvas should create a matching media node in place. Dragging external files onto the canvas should import supported media into the current workflow package/app storage and create matching Image, Video, Audio, 3D, or Text nodes; text files store file contents in the Text node.
- Video uploads and canvas drops accept MP4, MOV/QuickTime, and WebM. Preserve the original managed asset and MIME type; browser playback still depends on the codec inside the container, so an unsupported codec should produce a useful preview/run error instead of reclassifying the file as non-video.
- Double-clicking an output rail thumbnail should open a lightweight full-size preview modal instead of expanding the rail. The modal must fit the complete image or video in its native aspect ratio rather than cropping it.
- The output rail should expose an open-folder action for the current project's output folder through the local API.

## Output Node Standard

- Output uses internal type `output`, has one generic `sourceIn` sink, and accepts prompt, image, camera, style, transfer, character, director, video, audio, and 3D output kinds. The connection is an edge keyed by source and Output node ids; source titles are filename metadata only.
- The default Path is the current project's root output folder with no date subfolder. Output nodes marked `project-default` follow that project root when the active project changes; user-selected custom paths remain unchanged.
- Connecting Output to a runnable source makes it that source's save target. A separate overwrite toggle is not needed. Running Output directly copies the selected existing source result; running the source routes each newly generated result to the same target.
- The configured Path and Filename both expand tokens server-side. The visible insertion strip exposes `$node`, `$date`, `$index`, and `$time`. The server also preserves legacy/explicit aliases `$node_name`, `$source_node_name`, `$workflow_name`, `$output_node`, and `$output_node_name` for saved workflows and request compatibility.
- `$node`, `$node_name`, and `$source_node_name` resolve to the connected input node's current title. `$output_node` and `$output_node_name` resolve to the Output node title. `$date` uses local `YYYY-MM-DD`; `$time` uses local `HH-MM-SS`; `$index` is a zero-padded, incrementing available-file index.
- Tokens work in both Path and Filename. Sanitize token values and final basenames for the host filesystem, create missing directories recursively, preserve or infer the media extension, and never silently overwrite an existing file. Without `$index`, reserve a unique `-2`, `-3`, and so on suffix when needed.
- The status line previews the fully resolved filename before a run and reports the actual saved filename afterward. Filename preview must not create or reserve the target file.
- Absolute external targets are exposed to the browser as `/external-outputs/<encoded-absolute-path>/<encoded-filename>`. Persist the public URL in results; keep `externalPath` as backend/history metadata and never use a raw absolute path or browser object URL as an HTML media source.
- On reopen, every existing external Output result should resolve from its saved URL. If the original user root changed, the server may rebase the path or recover one unique nearby filename match; ambiguous or missing files should fail clearly and may then show the logo fallback.
- Redirecting storage must not sever provenance. The source node remains the result owner, Stats/history retain the generating node/model/provider, and Preview/downstream nodes continue to consume the source result normally.
- Explicit still export choices are PNG and JPEG. Explicit video choices are H.264 MP4 and ProRes 422 HQ MOV.
- Local ProRes export uses FFmpeg `prores_ks`, profile 3, `yuv422p10le`, and PCM 24-bit audio. Describe it as a 10-bit mezzanine transcode, not as restored source precision, native 10-bit generation, 16-bit media, EXR, or HDR.
- A container/codec transcode must never be presented as improving source dynamic range or bit depth. HDR labels require a real HDR transform and correct transfer, primaries, matrix, range, and metadata handling; Topaz SDR to HDR is the current explicit HDR Utility path.

## Run And Dependency Standards

- `Run All` must respect dependencies.
- Selected-node dependency scheduling belongs in `src/nodeRunner.js`; `NodeEditor.jsx` should pass callbacks for UI status and skipped-node updates.
- Prompt/Text processing runs before media generation.
- Image-producing nodes run before nodes that depend on images.
- 3D nodes should run after their image dependencies are available.
- Video-producing nodes run after prompt, image, 3D, or utility dependencies they consume.
- Edit nodes run after their source image or video dependencies and use the same dependency stage as Utility and Video Model work.
- Output runs after its connected source when invoked independently. When a selected runnable source already routes through that Output node, do not schedule a second redundant Output copy for the same selection.
- Independent nodes of the same stage may run concurrently.
- Nodes should set `status`, `error`, `resultUrl`, `resultItems`, `selectedResultIndex`, and `resultType` consistently.
- Batch failures should report partial success without discarding successful outputs.

## Generation Progress Standard

- Model generation requests carry `generationRunId`, `generationGroupId`, node identity, generation kind/label, and one-based batch index/total metadata. Keep this metadata additive so provider request schemas remain unchanged.
- `generationProgressMiddleware` owns requests under `/api/node`; `GET /api/generation-progress` returns current entries for client polling. Do not expose API credentials, prompts, or provider payloads through progress responses.
- Supported phases are `queued`, `generating`, `downloading`, `finalizing`, `complete`, and `failed`. The UI must show a real filling track, a phase label, elapsed time, batch completion, queue position when available, and a terminal result.
- Prefer provider-reported percent or step/frame logs. When a provider supplies no usable percent, show a clearly labeled estimate derived from phase and elapsed time; never present an estimate as provider-reported truth.
- Batch progress aggregates all runs in a generation group. Preserve completed batch items when another item fails, and retain the terminal bar long enough for the user to read it.
- The progress component is node-scoped and accessible: expose `role=progressbar`, value bounds, a numeric value when determinate, and useful text when indeterminate.
- Progress polling must stop when there are no active runs and must not trigger full graph updates on each poll. Keep subscription and aggregation logic outside `NodeEditor.jsx`.

## Composer Node Standard

- Composer is the catalog owner for two modes: `Composer` and `Frame It`. Keep the mode in `data.composerMode`; switching modes must preserve both modes' scene data and the shared image output.
- The standalone `frameIt` type is hidden from the new-node catalog but remains fully loadable and editable for saved-workflow compatibility.
- Composer is an image-guide node. It exposes one `Image Plane` input and one `Frame` output.
- Composer should not expose prompt input or prompt output ports. Written prompts should connect directly to the downstream model that generates the final media.
- Each Composer maquette exposes a dynamic Character input below the Open Composer action, with the maquette name shown beside the port. The port id must stay tied to the maquette id so renaming the maquette does not break the binding.
- Composer maquette Character inputs accept locked Character nodes only. Treat each input as a single binding; replacing the connection should replace the prior Character for that maquette rather than stack ambiguous identities.
- When a Composer frame is connected to an Image Model image input, the image prompt builder automatically wraps the effective written prompt with the locked spatial blueprint instruction. This instruction treats the Composer frame as composition, pose, camera, crop, scale, occlusion, and negative-space authority only.
- If maquettes have Character bindings, Composer must forward those Character sheet references to the Image Model and add explicit maquette-to-character mapping text so each maquette keeps its own assigned identity. Include a short placement/color descriptor for each mapped maquette because the rendered guide frame does not visibly contain maquette names.
- Composer-bound Character references are identity-only. The Composer guide remains the authority for pose, gesture, stance, limb endpoints, crop, scale, placement, and camera.
- When an Image Model is running from a Composer frame, the Composer's bound Character input lines should animate as active generation dependencies.
- The Composer frame should be labeled as the input guide image when sent to backend image-generation routes.
- Saved workflows with pre-refactor Composer prompt edges, or Character bindings for deleted maquettes, should drop those edges during graph normalization instead of keeping stale prompt plumbing.
- The Composer modal sidebar uses a visible scene-object list for Camera, maquettes, primitive props, and image planes. Clicking a row selects that object. `Delete Selected` lives in the header as a red destructive button and deletes the selected scene object only; it must never delete the Camera.
- Maquette object controls are always visible when a maquette is selected: `Name`, `Color`, `Location`, `Rotation`, and `Scale`. Do not hide these controls behind the pose foldout.
- Pose-specific maquette controls live under a collapsible `Pose Controls` section, closed by default. When open, the section should consume the remaining Composer sidebar height and expose a working scroll area instead of clipping lower controls or leaving dead space.
- The pose preset row is labeled `Pose Presets`. It contains a legible preset-name dropdown, a trashcan button for the selected preset, and a Save button. Saving writes to the Composer-local saved pose list and attempts to persist the pose under `public/models/poses`; deleting removes the pose from the Composer-local list and deletes the library JSON through `DELETE /api/composer-poses/:poseId` when the preset has a `fileName`.
- Current maquette pose control order is: `Head`, `Upper Body`, `L Upper Arm`, `L Lower Arm`, `L Hand`, `R Upper Arm`, `R Lower Arm`, `R Hand`, `Hips`, `L Upper Leg`, `L Lower Leg`, `L Foot`, `R Upper Leg`, `R Lower Leg`, `R Foot`.
- Current saved pose field groups include upper/lower arms, hands, upper/lower legs, feet, head, upper body, hips, and `lean`. When adding a pose field, update the client and server `composerPoseFieldKeys` lists (`src/composerState.js` and `server/index.js`), `defaultComposerMaquette`, `normalizedComposerScene`, saved pose snapshots/patches through the field-key list, the Composer modal controls, and both mannequin/procedural rendering when the field is visual.

## Character Node Standard

- Character is the identity and wardrobe authority for downstream image, video, Composer, Film Director, and Storyboard work. Its editable title supplies the visible `@token`; stable node ids and `nodeReferenceBindings` remain the behind-the-scenes identity when the title changes.
- Character Build accepts a portrait, up to eight wardrobe references, physical traits, voice references, and the supported sheet-generation controls. Locking generates one image sheet for each wardrobe, or one default-wardrobe sheet when no wardrobe was supplied. Optional CU Video generation may add a matching close-up video sheet for each generated image variant.
- Character Notes (`characterReferenceNotes`) are additional generation instructions. The shared `runCharacterSheetGeneration` runner appends nonblank notes to standard/cinematic and CU Video sheet prompts for every wardrobe and supported model, while preserving the base layout, portrait, wardrobe, and physical-details instructions. Blank/missing notes leave the original prompt unchanged. Notes take effect on the next generation; editing them does not automatically regenerate sheets or alter uploaded custom sheets. Storyboard character preparation remains separate.
- Generated wardrobe variants live in `characterSheetVariants`. Each variant is keyed by its stable wardrobe id, not its display filename or array position. Use the reserved `__default-wardrobe__` id when there is no uploaded wardrobe.
- Custom completed sheets live in `characterCustomSheets`. Character accepts up to 16 PNG, JPEG, or WebP custom sheets through upload, multi-file drop, or compatible image-output drop. Adding a custom sheet must preserve every generated wardrobe variant and every existing custom sheet.
- Generated and custom sheets form one selectable library. Persist the selected entry in `activeCharacterSheetId` using the namespaced `generated:<wardrobe-id>` or `custom:<sheet-id>` form. A generated and custom asset with the same URL must appear only once.
- Selecting a sheet updates the Character node's full-resolution result and makes that exact sheet the active downstream identity reference. When available, a selected generated variant may provide its matching CU Video sheet to compatible video generation; custom image sheets remain valid image references and may carry a migrated matching video result.
- Sheet selection is workflow state. Save, Open, autosave, copy, and import must preserve a valid `activeCharacterSheetId`; normalization must choose a deterministic fallback when it is missing or stale. Existing workflows should continue to prefer the active wardrobe's generated sheet, then the first generated variant, then the first custom sheet.
- Removing the selected custom sheet must fall back to another valid generated or custom sheet. A locked Character stays locked when a fallback exists; it unlocks and clears its active result only when no usable sheet remains. Removing a wardrobe removes only that wardrobe's generated variant and follows the same fallback principle.
- Legacy `customCharacterSheet` and `useCustomCharacterSheet` data must migrate into `characterCustomSheets` and `activeCharacterSheetId` during normalization. Do not delete or replace generated variants during this migration, and do not display the same migrated asset twice. The legacy fields should be cleared after normalization but remain recognized as input compatibility fields.
- Regeneration is partial-success tolerant. Merge successful wardrobe results into the existing library, retain the previous sheet for any wardrobe that fails to regenerate, and show a concise partial-failure notice. If every requested generation fails, preserve existing valid sheets and surface the generation error.
- Character previews, sheet-library thumbnails, drag sources, and downstream references must retain the full-resolution managed asset URL. Thumbnails may lazy-load or use display helpers, but proxy images, object URLs, and logo fallbacks must never replace the persisted source.
- `src/characterSheetLibrary.js` owns generated/custom selection ids, legacy normalization, choice construction, and active-variant resolution. `src/characterVideoSheets.js` owns the selected Character reference used by video generation. Keep these rules out of ad hoc render branches.
- Character changes require focused tests for generated/custom coexistence, explicit selection, legacy migration, duplicate suppression, removal fallback, save/open persistence, downstream image/video reference choice, and partial regeneration retention.

## Backend API Standards

Local API routes should live in the smallest backend owner that fits the route. Node generation routes usually live under `/api/node/...`; focused route groups should live in `server/routes/*` and be registered by `server/index.js` with explicit dependencies.

- Validate required inputs early and return JSON errors.
- Use local asset helpers such as `readLocalAsset`, `localAssetToFalUrl`, or `uploadLocalOutputToFal` rather than passing local paths to remote APIs.
- Use managed asset helpers for uploaded, generated, and derived files so the current workflow package is honored.
- Download generated files into the attached package `outputs/` folder, or into `/outputs/<workflow-name>/` when no package is attached.
- Return local URLs such as `/workflow-assets/<workflow-id>/outputs/file.glb` for packaged assets or `/outputs/<workflow-name>/file.glb` for unpackaged assets.
- Add a health route flag for new API routes and update `scripts/smokeApp.mjs` required routes when the route is part of startup health.
- Add browser API wrappers in `src/api/newtApi.js` before UI code calls a route.
- Edit node media operations live at `/api/node/edit-media`, use local ffmpeg/ffprobe, require a local NewtNode asset URL, and must write managed image/video outputs into the active workflow package or local outputs folder.
- Edit node live previews live at `/api/node/edit-preview`, render temporary PNG frame previews with local ffmpeg, return inline preview data, and must not append history or create project output files.
- Composer pose library routes live at `/api/composer-poses`: `GET` lists library poses, `POST` saves or updates pose JSON under `public/models/poses`, and `DELETE /api/composer-poses/:poseId` removes the selected library pose file. Keep file names sanitized server-side.
- Use `subscribeFal` for Fal calls so queue and failure logging stays consistent.
- Normalize Fal file responses with `normalizeFalFile` and fallback search helpers where useful.
- Keep request fields aligned with the provider's current API schema.
- Keep response payloads small and predictable: `image`, `video`, `model`, `thumbnail`, `cost`, `seed`, `text`, as appropriate.

## Security And Trust Boundaries

NewtNode handles local files, provider credentials, remote media, workflow packages, and desktop control actions. Treat every browser request, workflow value, imported filename, provider response, and package reference as untrusted at the server boundary.

- Provider credentials are server-side local configuration. Never send a reusable key to the browser, include it in progress/history/errors, or log request headers and environment values.
- UI code calls Newt's local API; it must not call paid providers directly with a credential embedded in browser state.
- Validate route bodies, expected media type, required fields, numeric ranges, list counts, provider limits, and output schemas before use. Preserve useful provider diagnostics without echoing secrets or entire sensitive payloads.
- Resolve local media through existing managed-asset helpers. Reject path traversal, unsupported URL schemes, arbitrary browser-supplied absolute paths, and files outside approved uploads, outputs, workflow assets, or explicitly selected Output roots.
- Normalize and sanitize filenames server-side. Use Node `path` APIs, containment checks, recursive directory creation under an approved root, and collision-safe reservation.
- Validate remote downloads by status, declared/observed media type, size/timeout limits where required, and provider response shape. Copy durable results into managed local storage before persisting them.
- Browser object URLs, temporary preview files, Comfy temp paths, and provider URLs are runtime transport, not durable workflow identity.
- Keep temporary preview routes free of history, Stats, and project-output side effects. Clean up temporary files through the existing lifecycle.
- Do not serve arbitrary filesystem roots to the browser. External Output URLs must stay encoded and resolved by the server's constrained external-output handler.
- Desktop actions such as restart, update, dialogs, folder launch, and workflow file operations use the local control route and validate requested actions/paths server-side.
- Keep CORS and listener scope local by default. A feature that exposes Newt beyond loopback requires an explicit security design, authentication decision, and documentation update.
- Tests and fixtures use placeholders only. Before completion, inspect the diff for keys, bearer tokens, personal paths, signed provider URLs, workflow media, runtime settings, and generated logs.

## Settings And Runtime Update Standards

Settings is a local runtime control surface, not an account system.

- The Settings page is lazy-loaded by `src/main.jsx` and should use `settingsApi` from `src/api/newtApi.js` for every request.
- The current Settings routes are `GET /api/settings`, `POST /api/settings`, `POST /api/settings/validate-keys`, `POST /api/settings/update`, and `POST /api/settings/restart`; `/api/health` must advertise `routes.settings: true` and `routes.settingsKeyValidation: true`.
- Secrets can be loaded into Settings with `includeSecrets=1`, but UI fields must remain password-style by default with explicit reveal buttons.
- Runtime settings live in `server/data/runtime-settings.json`. Treat that file as local state: ignored by git, not a fixture, and not a source of defaults for another machine.
- Settings is the source of truth for Fal, Google, Krea, and OpenAI credentials. Each provider may store multiple locally named credentials, with at most one active credential selected by radio control; choosing `None` disables that provider. Saving Settings atomically materializes the four provider values into `.env` while preserving unrelated environment configuration: active credentials are uncommented and disabled credentials remain commented out. Existing single Settings keys and active or commented `.env` provider keys are imported as named profiles during migration, after which users should not need to edit `.env` directly.
- The update action must stay constrained to the configured repository and the currently checked-out branch. It should first try `git pull --ff-only` against that repository and branch. If that fast-forward pull fails, it should stage a fresh replacement clone, install dependencies, preserve local `.env`, `server/data`, workflows, inputs, uploads, and outputs, swap the app folder, relaunch through the platform launcher, and remove the old install only after the replacement reports healthy. Keep Windows PowerShell and macOS bash handoff scripts aligned; do not add merge, reset, or branch-changing behavior to the Settings button.
- Branch status should compare the current local branch with the configured remote branch head and report a plain state such as up to date, update available, local changes, local ahead, repository differs, or check failed.
- Restart requests should go through `/api/settings/restart` and the restart marker flow. Preserve Windows and macOS launchers/watchers when changing restart behavior.
- If the Settings branch tile or health payload shows the app version, derive it from package metadata so release bumps update the display automatically.

## Image And Video Model Standards

- Callable model labels, shared option lists, and workspace filtering live in `src/modelOptions.js`. Keep labels stable for saved workflows; add migrations when a provider rename must change one.
- Model-specific normalization and request builders belong in focused modules such as `src/geminiOmni.js`, `src/seedance25.js`, and `src/nodeRunners/*`. The generic Video Model UI should select capabilities and gather connected inputs, not duplicate provider schemas.
- Video Model inputs are role-specific. `startFrameIn`, `endFrameIn`, `referenceImageIn`, `referenceVideoIn`, `referenceAudioIn`, Character, Storyboard, Film Director, and prompt inputs must remain distinct through collection, upload, provider request construction, and history metadata.
- Gemini Omni Flash supports text-to-video, start-frame/image-to-video, image references, and reference-video editing. It is fixed to `720p`, currently supports `16:9` and `9:16`, and uses the Google/Fal route selected by the Veo/Google Video runtime preference. Reference-video edits prefer direct Google when an active Google key is available.
- A Gemini Omni reference video is an edit source, not a weak style hint. Prepare it as provider-compatible 720p H.264 when needed, send the actual uploaded video bytes/URI or provider URL, select the video-edit endpoint/task, and add a concise preserve-everything-else instruction unless the user already supplied one. Provider rejection must say the video was received and rejected rather than claiming the input was missing.
- Gemini Omni start frame and reference images must be sent as media parts or provider image fields, not merely described in prompt text. Normalize direct-Google text to the provider's accepted byte range before request encoding so punctuation cannot trigger ByteString conversion failures.
- Seedance 2.0 and Seedance 2.5 are separate model contracts. Fal Seedance 2.5 supports `auto` or 4-30 seconds, `1080p`/`720p`/`480p`, and auto plus the ratios declared in `src/seedance25.js`. Its image-to-video endpoint always receives `aspect_ratio: "auto"`; do not reuse the broader Seedance 2.0 duration/resolution options.
- Fal Seedance 2.5 reference limits are 30 images, 10 videos, 10 audio files, 50 references total, 30.2 seconds of reference video, and 30.2 seconds of reference audio. Each timed reference must be at least 1.8 seconds, and audio requires at least one image or video reference. Validate these before provider submission and record the actual route and reference counts in history.
- Fal Seedance 2.5 reference videos accept MP4/MOV at 24-60 FPS, 300-6000 pixels per side, and aspect ratios from 0.4 to 2.5. Reference audio accepts MP3/WAV. Preserve provider validation details when a connected asset falls outside these bounds.
- MiniMax H3 is one contextual Video Model with an explicit Fal/Local provider preference. Fal uses `minimax/h3/text-to-video`, `minimax/h3/image-to-video`, and `minimax/h3/reference-to-video`; Local uses the loopback SGLang asynchronous `/v1/videos` API. A Start Frame selects image-to-video; otherwise any image, video, or audio reference selects reference-to-video; with neither, use text-to-video. Start Frame takes route priority, and End Frame requires Start Frame.
- MiniMax H3 supports 5-15 seconds, seed, prompt expansion, and safety checking through Fal, with the resolutions exposed by the current provider schema. The Local SGLang integration supports `576P` only, uses 20 inference steps, and rejects other selections instead of submitting a workload that exceeds the supported 24 GB GPU profile. Text-to-video accepts `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, or `9:16`; image-to-video follows the source image; reference-to-video adds `adaptive`.
- MiniMax H3 reference limits are 9 images, 3 videos, 3 audio files, and 12 files total. Each video/audio reference must be 2-15 seconds, combined video and combined audio duration are each limited to 15 seconds, and audio cannot be the only reference type. Rewrite persistent `@node` mentions to positional `Image N`/`Video N`/`Audio N` for Fal and `<Picture N>`/`<Video N>`/`<Audio N>` for Local SGLang.
- Fal billing is output duration times the selected resolution rate: `$0.05/s` at 480P, `$0.06/s` at 768P, `$0.13/s` at 2K, and `$0.16/s` at 4K. The first five reference images are free; each additional reference image costs `$0.08`. Local SGLang runs record zero hosted-provider cost. Record provider, route, reference counts/durations, native-audio status, and the complete estimate in history so Stats remains reproducible.
- The selected MiniMax H3 provider is authoritative. Local requires a healthy loopback SGLang service and never falls back to Fal; Fal requires an active Fal key and never falls back to Local.
- Provider selection is authoritative. If the selected route lacks a key, capability, or valid response, report that provider's error; do not silently change service to make the run succeed.

## Hosted Utility Model Standards

Hosted utility models should follow the same request, result, history, and stats contracts as other generation nodes.

- Keep hosted utility labels and option lists in `src/modelOptions.js`; saved workflows rely on stable labels.
- Current Utility Image catalog labels are `Auto Aspect`, `Coverage`, `Color ID to Matte`, `Image to Color ID`, `Qwen Camera Edit`, `Grab Still Frame`, `DWPose`, `Depth Anything`, `Topaz Image Upscale`, `Patina`, `BiRefNet Image`, and gated `SAM 3 Image`.
- Current Utility Video catalog labels are `Extract Frame`, `Color ID to Matte`, `Composite Video`, `DWPose Video`, `Depth Anything Video`, `WanBlend`, `WanWarp`, `WanSegment`, `Wan VACE Mask-to-Video`, `Wan VACE 14B Inpainting`, the Wan 2.2 A14B LoRA and VACE variants, gated `SAM 3 Video`, `VOID Video Inpainting`, `BiRefNet Video`, `RIFE Video`, `Bytedance Video Upscaler`, `Flux Video Upscale`, `Topaz SDR to HDR`, and `Topaz Video Upscale`.
- Only options returned by the enabled Utility preference filters are callable. Hidden legacy handlers may remain for saved-workflow compatibility, but retired labels such as Luma Photon/Ray2 and Wan 2.1 LoRA must not be reintroduced to the current dropdown accidentally.
- SAM 3 image/video segmentation remains feature-gated by `sam3SegmentationModelsEnabled`; keep both options hidden together until the integration is deliberately re-enabled and reverified.
- Depth Anything Video is a Utility Video model. It requires a connected source video, supports model, colormap, resolution, max-frame, output-FPS, and side-by-side controls, and returns a normal video result item.
- Depth Anything image and video preprocessors are paid Fal utilities. Estimate cost from the available image/video duration data; mark the cost unpriced when duration is unavailable instead of inventing a fake amount.
- Topaz SDR to HDR uses `topaz/sdr-to-hdr/video` with a required source video and an `mp4` or `prores` output-format setting. Preserve the source resolution and frame rate, enforce Fal's five-minute input limit, save ProRes output as `.mov`, and price runs from source duration and resolution using the published 1080p/4K tiers.
- Flux Video Upscale uses `blackforestlabs/flux-video-upscale` with a required source video and exposes Fal's `upscale_factor` (1.5-3), `creativity` (precise `0` or creative `1`), optional creative `prompt`, and `safety_tolerance` (0-4) inputs. Prepare non-MP4 sources as MP4, enforce Fal's 20-second and 50 MB limits before submission, preserve the source aspect ratio, and price delivered output by duration, resolved 1080p/2K/4K tier, and precise/creative mode.
- Topaz Image Upscale and Topaz Video Upscale are paid Fal Utility models. Keep their image/video option lists separate because the Fal schemas differ, and estimate cost from output megapixels for image or output-resolution tier, duration, FPS, and Gaia 2 multiplier for video when that metadata is available.
- SAM 3 Image is a prompted matte generator in Utility Image. Request raw PNG masks with `apply_mask: false`; an isolated RGB subject on black is an inspection composite, not a black-and-white matte, and must not be labeled or routed as one. Keep returned masks ahead of any distinct preview item so the first result and `Mask output` are actual mattes.
- SAM 3 Video follows the same contract in Utility Video. Request an unapplied X264 mask video with `apply_mask: false`, keep the detection-threshold control bounded from 0 through 1, and expose the result as `Mask video output`. Do not describe an isolated RGB subject over black as a matte.
- Fal Wan 2.2 LoRA and VACE models stay in Utility Video. Wan 2.1 LoRA text-to-video and image-to-video are retired and should not be added back to callable model lists. Keep provider-specific payload builders in `src/nodeRunners/videoModels.js` and `server/index.js`, not inline inside generic UI rendering.
- When adding a hosted utility that can also be used as a prepass for a local Comfy workflow, keep the standalone hosted result as ordinary media and let the downstream executor decide how to consume it.

## ComfyUI Custom Workflow API Standards

Some Newt features are local custom workflow integrations rather than direct hosted model calls. WanBlend and WanWarp are the current production reference implementations: Newt presents a purpose-built node interface, then the backend patches and runs locked ComfyUI API workflows.

Use this pattern for future ComfyUI-backed custom builds.

- Store each integration in a focused server folder such as `server/wanwarp/`.
- Track the Comfy API prompt templates in `server/<integration>/templates/`. These are source fixtures, not runtime output. Keep large generated media and local Comfy output folders out of git.
- Treat production-ready Comfy templates as backend contracts. Prototype workflow changes should branch into a new template file or integration mode before replacing a locked production template.
- Include template metadata when useful, such as `templates/manifest.json`, so required models, custom nodes, output node ids, and workflow purpose are discoverable.
- Keep all Comfy-specific patching server-side. Browser code should submit normalized node settings and local asset URLs, never raw Comfy graph internals or machine-local paths.
- Use a single backend engine module to own template loading, prompt patching, Comfy queueing, polling, output copying, result shaping, and history append.
- The backend should talk to ComfyUI through its local HTTP API: check availability with `/system_stats`, upload still images through `/upload/image`, queue prompts with `/prompt`, and poll completion through `/history/<prompt_id>`. `/queue` is useful for diagnostics and monitors, but normal runs should rely on prompt history.
- Default Comfy URL should be environment-configurable. WanWarp uses `WANWARP_COMFY_URL`, defaulting to `http://127.0.0.1:8188`; WanBlend uses `WANBLEND_COMFY_URL` and falls back to `WANWARP_COMFY_URL`.
- WanBlend, WanWarp, and WanSegment runs should preflight local ComfyUI availability through `/api/comfy-wan/status`. The status check must use the Settings-managed ComfyUI root path, compare required custom nodes and models against `docs/comfyWan-requirements.yaml`, and return actionable missing-item details. If ComfyUI is not reachable or required Wan dependencies are missing, show a dialog that points the user to the requirements file for ComfyUI, custom node, model, and Python dependency setup.
- Long local renders must use a generous server-side timeout and should be environment-configurable. WanWarp uses `WANWARP_COMFY_TIMEOUT_MS`; WanBlend uses `WANBLEND_COMFY_TIMEOUT_MS` and falls back to the WanWarp timeout.
- Timeout errors must include enough context to debug, especially the Comfy `prompt_id`, and should say the render may still be running in Comfy.
- When a workflow is queued, record the Comfy `prompt_id` in history settings.
- If Comfy returns `status_str: "error"`, surface Comfy's exception message and attach raw status where possible.
- If Comfy returns success but expected output nodes are missing, return a clear 502-style error and include raw outputs for debugging.

WanWarp reference map:

| Surface | Current files |
| --- | --- |
| Comfy engine | `server/wanwarp/engine.js` |
| Locked API templates | `server/wanwarp/templates/creator-locked-full.json`, `server/wanwarp/templates/creator-locked-seg-a.json`, `server/wanwarp/templates/wanblend-refine.json` |
| Template metadata | `server/wanwarp/templates/manifest.json` |
| Backend route integration | `/api/node/utility-video` path in `server/index.js` |
| Browser request shape | `src/nodeRunners/videoModels.js` and the utility runner path in `src/NodeEditor.jsx` |
| User-facing model labels | `src/modelOptions.js` |
| Result and preview support | `src/components/MediaViews.jsx`, `src/components/NodePorts.jsx`, and shared result helpers |
| Standards/history docs | `docs/node-standards.md`, `docs/latent-wan-transition-handoff.md`, `docs/comfyWan-requirements.yaml` |

WanBlend reference map:

| Surface | Current files |
| --- | --- |
| Comfy engine | `server/wanblend/engine.js` |
| Context-smashing template | `server/wanblend/templates/context-smashing.json` |
| Backend route integration | `/api/node/utility-video` path in `server/index.js` |
| Browser request shape | `src/nodeRunners/videoModels.js` and the utility runner path in `src/NodeEditor.jsx` |
| User-facing model labels | `src/modelOptions.js` |
| External requirements | `docs/comfyWan-requirements.yaml` |

### Template Patching

- Treat exported Comfy API JSON as an immutable template. Load and clone it per run before editing.
- Patch by stable node ids, and keep those ids documented in code or manifest comments when they are part of the public integration contract.
- Patch only the fields Newt intentionally controls. Preserve creator defaults for the rest of the workflow.
- Sanitize Comfy widget values before queueing. Exported Comfy JSON can contain UI index values where the API expects strings. WanWarp normalizes Shark sampler schedulers, sampler cfg, denoise, step values, and ImageScale methods before submitting.
- Prefer structured JSON patching over string manipulation. Use `JSON.stringify(path)` only for Comfy nodes that explicitly expect quoted path strings, such as some VHS path loaders.
- Avoid hard-coding Windows path separators in template data. Resolve local asset paths with server helpers and Node `path` APIs.
- Do not bypass compile or custom-node behavior by deleting nodes unless that is part of the locked workflow contract. If a workflow requires bypassing compile nodes, document the reason and keep the template aligned with the known-good Comfy graph.

### Assets And Outputs

- Resolve Newt local URLs through existing asset helpers. Packaged `/workflow-assets/<workflow-id>/...`, unpackaged `/uploads/...`, and `/outputs/...` URLs must all work.
- Upload still images to Comfy rather than passing Newt URLs directly into Comfy image loaders.
- For video inputs consumed by Comfy path-loader nodes, resolve to validated local filesystem paths server-side.
- Never return Comfy's raw output path to the browser. Copy Comfy outputs into Newt managed assets first.
- Generated outputs must honor the current workflow package: package runs write to `/workflow-assets/<workflow-id>/outputs/...`; unpackaged runs write to `/outputs/<workflow-name>/...`.
- Return normal Newt result items for user-visible media: final outputs as `video` or `image`, with labels, local URLs, file names, mime types, metadata, and seeds where available.
- If a custom workflow produces diagnostic or segment outputs, copy those into managed assets too and return them as additional `resultItems`.

### Node Contract Pattern

WanWarp establishes a useful pattern for complex Comfy workflows that are easier to edit as several Newt nodes but should run as one locked Comfy graph.

- Use lightweight config nodes when the user needs repeated editable segments. WanSegment is config-only: it validates connected media and prompt/settings, then emits a `wanSegment` result item carrying the normalized segment payload.
- Use one executor node for global workflow execution. WanWarp receives connected WanSegment outputs and runs the full locked Comfy workflow.
- If a workflow has a useful prepass, keep it as a normal media-producing utility when it can stand alone. WanBlend outputs a regular video, and WanWarp may optionally consume that video as a keyframe/prepass source while still running the locked creator workflow.
- When a prepass can replace segment config, keep that as a separate executor mode instead of forcing fake segments. WanWarp can refine a connected WanBlend/reference video directly with Motion Map and Depth Video inputs through `server/wanwarp/templates/wanblend-refine.json`.
- Keep user-facing node names clear even if older internal code names remain during migration. In the current app, `WanSegment` replaces the old Transition Builder concept and `WanWarp` replaces the old Video Stitch concept.
- Config outputs may use a non-media internal type, such as `wanSegment`, when they are graph instructions rather than playable media. Shared preview/result code must explicitly understand that shape.
- Still expose playable media from segment nodes when a full workflow finishes. WanWarp copies Segment A/B/C/D outputs back into the connected WanSegment previews while keeping the segment config output available for chaining.
- Make ports intuitive by media role: segment config/handoff outputs should use the image/config color expected by the target port, while actual segment video outputs should stay green.
- `Run All` must respect dependency order: segment nodes prepare config first, then the executor node runs the single Comfy workflow.
- If the locked Comfy workflow supports only a bounded topology, expose that honestly. WanWarp currently standardizes on A, B, C, and optional D loop behavior that matches the creator workflow.

### Exposed Controls

- Expose stable controls that map to intentional template patch points. Do not expose every Comfy widget by default.
- Preserve creator defaults as the default Newt values unless the product intentionally changes the workflow.
- Group global workflow controls on the executor node. WanWarp owns frames, fps, size, output format, CRF, sampler steps, LoRA strengths, tail trim, and blend.
- For WanBlend refine mode, WanWarp also owns refine denoise, Control Mix, Depth/Motion mix, VACE reference strength, conditioning strength, VACE strength schedule, and frame cap. These patch how much the WanBlend RGB video, motion map, depth video, and prompt influence the final Wan 2.2 pass. A frame cap of `0` means auto: probe the connected WanBlend video and run its full length/FPS, then cap motion/depth loaders to that selected length.
- Keep prepass controls on the prepass node. WanBlend owns context-smashing prompt/negative text, color-region images, color-map video, output size/FPS, IPAdapter weight, stride, frame cap, steps, CFG, CRF, and seed.
- Group segment-specific controls on segment nodes. WanSegment owns prompt, negative prompt, conditioning strength, VACE schedule, VACE reference strengths, seed, start/end keyframes, motion map, and depth video.
- For paired sampler controls, keep `steps_to_run` no greater than total `steps`.
- For video encoding, expose CRF as an output quality/file-size control and document that it cannot fix generation noise.
- For LoRA strength controls, use the workflow's real model split names. WanWarp exposes Distill HIGH/LOW and Motion HIGH/LOW strengths because the template has separate HIGH and LOW model LoRA loaders.
- Keep handoff/overlap controls named in user language. WanWarp exposes `Tail Trim` and `Blend` to match the creator workflow's boundary handling.

### History, Cost, And Diagnostics

- Record local Comfy runs as `provider: "local-comfyui"`.
- Record cost as `$0` only because the run is local and Newt is not paying a hosted provider. Do not imply the user's GPU time is free in user-facing copy.
- History settings should include the selected model name, Comfy URL, Comfy prompt id, output node ids, workflow/template name, segment roles, loop setting, width, height, fps, frame length, render length, exposed quality controls, and input asset URLs.
- Include all copied output URLs, file names, labels, and bytes in history.
- Keep raw Comfy status/output objects out of normal history, but attach them to thrown errors when useful.

### Verification For Comfy Integrations

For code-only changes to a Comfy integration, run the normal verification checklist plus server syntax checks for the focused engine module.

For behavior changes that touch template patching, node wiring, or output handling, also run a local Comfy smoke test:

- Confirm Comfy is reachable at the configured URL.
- Run a small known-good workflow through Newt, not only directly in Comfy.
- Confirm `/history/<prompt_id>` reaches success.
- Confirm final outputs are copied into Newt managed assets.
- Confirm segment or auxiliary outputs appear on the correct nodes.
- Confirm history records the Comfy prompt id and local output URLs.
- Confirm a packaged workflow uses `/workflow-assets/<workflow-id>/outputs/...` paths.
- Confirm timeout behavior does not mark a still-running Comfy render as a failed completed run.

## Cost And Stats Standards

Every paid remote model should record cost metadata.

- Add pricing constants near the top of `server/index.js`.
- Allow environment overrides for pricing where model pricing may change.
- Add a local estimator function with a `pricingBasis` and `pricingSource`.
- Keep provider-specific estimates separate when the same model can route through different providers. Nano Banana Pro should record Google Gemini API pricing for Google-direct runs and Fal pricing for Fal-routed runs.
- Append history with `mediaType`, `provider`, `modelName`, `endpoint`, `mode`, `settings`, `cost`, and local output paths.
- Update `/api/stats` pricing payload.
- Update `StatsDashboard.jsx` so historical and current runs estimate consistently.
- If cost cannot be estimated, mark it unpriced rather than pretending it is free.
- Free local operations should record `$0` only when they are truly local and costless.
- Edit node ffmpeg operations are local and should record `$0` local edit cost metadata in history.

## Persistence Standards

Saved workflows are long-lived project files. Changes must avoid breaking them.

- New, Save, Save As, Open, and Import live under the left toolbar File menu. New clears the current graph into an untitled blank workflow; Open replaces the current graph; Import merges the selected workflow into the current graph.
- New, Open, and Import must use the unsaved-change guard before discarding or changing the current graph. New resets project id, package path, file path, local file handle state, groups, selections, and viewport, then marks the blank workflow clean.
- When a workflow replacement would discard unsaved graph or project-name changes, prompt with Save, Don't Save, and Cancel. Save writes never-saved workflows to the local app saved-workflows folder.
- Ctrl+S and Cmd+S save the current workflow. If it has never been saved, use the default local saved-workflows registry rather than requiring Save As.
- The Recent workflows dropdown behaves as a Recent Files list backed by the local server registry, not as a live scan of every JSON file on disk. The trash action removes the workflow from the dropdown immediately without a confirmation dialog; it must not delete the local registry JSON, packaged workflow JSON, or external workflow JSON from disk. Re-saving or re-opening a workflow can register it in the dropdown again.
- New/Save/Open/Import orchestration belongs in `src/useWorkflowPersistence.js`; workflow document construction and display paths belong in `src/workflowFiles.js`; graph fingerprints, cloning, deduping, import remapping, and stale runtime cleanup belong in `src/workflowState.js`.
- Persist `data.nodeReferenceBindings` with node data. Loading or normalizing a node must preserve valid unknown binding fields; copying/importing a graph must remap binding values for every copied source node id.
- After a successful save, update the Recent workflows list by upserting the returned workflow summary instead of immediately reloading every project. Keep the summary shape compatible with `readSavedWorkflowSummaryFiles`.
- Server saves should migrate legacy projects when needed, read summary files for collision/existing checks, write the workflow/package, return the registered workflow promptly, and schedule the workflow-index rebuild in the background.
- Background workflow-index rebuilds should log success or failure but must not make an already-successful save look failed to the user.
- The dirty/unsaved fingerprint includes nodes, edges, groups, project name, and package path. It intentionally excludes viewport pan/zoom.
- Add normalization for new node fields.
- Preserve unknown data fields when normalizing unless they are unsafe runtime state.
- Migrate renamed node types or ports.
- Clear stale `running` state on load.
- Keep `resultItems`, `resultUrl`, and selected result indexes compatible with existing workflows.
- Store reusable assets under `public/models` or `public/models/poses` only when they should be versioned with the repo.
- Store unpackaged generated outputs under `/outputs/<workflow-name>/`, unpackaged uploads under `/uploads/<workflow-name>/`, unpackaged helper dependencies under `/outputs/<workflow-name>/dependencies/`, and registry copies of saved workflows under `/saved_workflows`.
- Treat `/saved_workflows/inputs`, `/saved_workflows/outputs`, and `/saved_workflows/dependencies` as local app storage for copied/generated assets. Keep those media files ignored by git; only `.gitkeep` placeholders should be tracked.
- Treat `server/data/*.json`, including `recent-workflows.json` and index files, as local runtime state. These files should be ignored by git and never used as source fixtures.

## Clipboard And Import Standards

- Copy serializes every selected node, edges whose two endpoints are selected, and selected group metadata into the versioned `newtnode.workflow.nodes` payload owned by `src/workflowClipboard.js`.
- Write the payload to in-memory state, browser local storage, and the system text clipboard when available. This allows paste into another open workflow or another NewtNode tab while preserving a fallback when browser clipboard permission is unavailable.
- Ignore ordinary text and unmarked JSON during graph paste. Clipboard parsing must be defensive and must not turn malformed external text into nodes.
- Paste creates fresh node, edge, and group ids, remaps edge endpoints and group membership, and remaps `data.nodeReferenceBindings` for referenced nodes included in the copied selection. Never retain source-workflow ids in the pasted graph.
- Preserve relative node spacing and internal connections. Anchor the copied selection's top-left at the current canvas pointer; use the legacy fixed offset only when no pointer position is available.
- Cross-workflow paste copies graph data, not hidden machine state. Managed local media URLs may remain valid on the same installation, but browser object URLs, running flags, and stale runtime-only fields must not become durable dependencies.
- Import follows the same id and binding-remap rules as paste, then deduplicates and places the imported graph in a clear canvas region. Open replaces the graph and therefore preserves valid saved ids instead of remapping them.

## Workflow Package Standards

Portable packages are the default Save As shape for workflows that need to move between machines or live on a shared drive.

- Save As opens the native folder picker and lets the user choose the parent folder.
- Save As creates or updates a package folder named from the workflow, with this shape:

  ```text
  WorkflowName/
    WorkflowName.json
    autosaves/
      autosave-1.json
      autosave-2.json
      autosave-3.json
      autosave-4.json
      autosave-5.json
    inputs/
    outputs/
    dependencies/
    .newtnode/
      manifest.json
  ```

- `inputs/` contains uploaded source media used by graph nodes.
- `autosaves/` contains five rotating JSON-only recovery snapshots. A dirty packaged workflow is captured every two minutes; unchanged states are skipped, the oldest slot is overwritten, and existing package assets are referenced rather than duplicated.
- Autosaving must not overwrite the primary workflow JSON, mark the workflow clean, block manual saves, or add recovery commands to the File menu. Recovery uses the existing Open command on an `autosave-N.json` file, resolves assets against the parent package root, and leaves the restored graph dirty until the user saves it manually.
- `outputs/` contains generated media and explicit node outputs.
- `dependencies/` contains derived helper assets needed to rerun or inspect the graph, such as padded frames, composed mood boards, masks, and other intermediate support files that are not primary user uploads or final outputs.
- `.newtnode/manifest.json` records package metadata and copied asset entries. It should help diagnose missing assets without becoming required runtime state. Keep the package root visually focused on the workflow JSON and asset folders.
- A packaged workflow should still appear in the Recent workflows dropdown through the local `/saved_workflows` registry copy.
- Save updates the attached package in place. Save As copies the graph and its current local assets into the chosen package folder.
- Once a package is attached, upload and generation requests must include the workflow package context so new files are written into that package.
- Packaged assets must be served through `/workflow-assets/<workflow-id>/...`.
- Vite development proxy config must include `/workflow-assets` anywhere it includes `/uploads` and `/outputs`.
- Opening a packaged workflow must register its package path with the local server before packaged assets are expected to preview or run.
- Save As must assign a new workflow ID so the new package has an independent `/workflow-assets/<workflow-id>/...` namespace. Legacy copied packages that share an ID must remain addressable by searching every registered package root for that ID.
- Packaged asset resolution must search every registered package root for a workflow ID and may recover a uniquely matched file that was reorganized into a nested subfolder inside that package. Cache and coalesce registry reads so a canvas full of previews does not reload every workflow package per image; invalidate that cache when a registry workflow is written. Ambiguous or genuinely missing files must fail with an actionable missing-file message rather than being reported as an unregistered package.
- Importing a workflow must remap node, edge, and group IDs plus internal `nodeReferenceBindings`, and place the imported graph in a clear canvas area rather than directly on top of the current graph.
- Do not use browser-only object URLs or absolute machine-local paths as saved graph dependencies.

## Film Director And Storyboard Standards

- Film Director uses internal type `skillDirector` and emits a built scene package from `directorOut`. Its reusable run logic belongs in `src/nodeRunners/skillDirector.js`; shot-limit, coverage, and revision helpers belong in the focused `src/filmDirector*.js` modules.
- A Film Director scene package may connect to supported Video Model `directorIn` ports and to Storyboard `directorIn`. Unsupported video models must not serialize or receive a director package.
- When a supported Video Model also receives a Text prompt, append that text to the Film Director output as clearly labeled supplemental direction. Keep the effective prompt a string, do not repeat character instructions already present in the Director package, and preserve all inherited visual references.
- Provider validation failures must surface nested error details as readable text. Never render object-shaped API errors as `[object Object]`.
- Krea Seedance submissions must stay within the provider-safe prompt budget. When Director plus supplemental Text exceeds it, preserve reference definitions, camera/shot-list detail, and the supplemental instruction while compacting lower-priority Director prose; the history `submittedPrompt` must record the actual bounded prompt sent to Krea.
- Krea Seedance reference images may use the API's multi-image array, but panoramic storyboard/contact-sheet images must be normalized to an opaque standard-ratio JPEG canvas before upload. Preserve the entire storyboard strip with padding; do not crop panels or replace the saved source asset.
- Building a scene locks its setup references until the user explicitly unlocks it. Revisions preserve the existing package, keep bounded revision history, and treat the user's revision note as the requested delta.
- Film Director references remain typed as character, location, prop/image, and style inputs. Expanding a director package for a downstream node must preserve direct downstream inputs and deduplicate inherited references.
- Storyboard accepts either its normal scene-description/reference inputs or a built Film Director package. When Film Director controls the scene, derive the scene description, characters, references, and requested shot count from that package without duplicating Film Director's visual-style boilerplate.
- Storyboard frame count supports `Auto` and explicit bounded counts. A Film Director shot count may drive Auto, but the editor-wide Storyboard frame cap remains authoritative.
- Storyboard frame outputs and the locked-board output are distinct connection targets. Use the shared Storyboard output resolver for previews, drag/drop, connection checks, and saved-edge migration so older frame ports remain compatible.
- Locking a Storyboard board creates the board output; generating or importing a frame creates a frame output. Lightweight thumbnails are display-only and must never replace the full-resolution URL used for dragging, editing, export, or downstream generation.
- Saved Storyboard frame images live in a filesystem-safe subfolder derived from the node's scene name. Frame filenames repeat that scene name and preserve the frame's board number with at least two digits, for example `Scene_01/Scene_01_Frame_01.png`; explicit frame exports use the same filename convention. Never overwrite an earlier frame on rerun or re-export: append a version suffix starting at `_v02` when the preferred filename already exists.

## Frame It Standard

- Frame It is the camera-plus-mannequin mode inside the catalog Composer node and captures an image result through Composer's normal image output. Internal type `frameIt` is retained only to load existing standalone nodes.
- Frame It UI and Three.js behavior live in `src/components/FrameItNodeBody.jsx`, `src/components/FrameItViewport.jsx`, and `src/frameItState.js`; keep reusable pose, normalization, joint-limit, and composition logic out of `NodeEditor.jsx`.
- Camera and figure state must normalize on load. Built-in and saved poses must respect anatomical joint limits and preserve complete compositions.
- Ordinary canvas navigation passes through the Frame It surface; only Frame It-specific modified gestures should control its camera. The node's scale is persisted independently from Storyboard and Mood Board scale.
- The bundled mannequin asset and its license remain versioned together under `public/models`.

## Provider Key Routing

- Fal is the default provider route for remote models that do not expose an explicit provider choice.
- Fal, Google, Krea, and OpenAI each support multiple named credentials in Settings. One credential or `None` is active per provider; selecting a different credential must not delete the others.
- Models available from more than one service must expose a separate provider-routing preference. Seedance has an explicit Fal/Krea choice; Google video/Veo and Nano Banana Pro image generation have explicit Google/Fal choices. A run must not silently switch away from the selected provider when that provider lacks an active key or returns an error. Provider choice, endpoint, and provider-specific cost must be recorded in history.
- OpenAI Image 2 uses the selected OpenAI key and preserves its quality-specific generation/edit pricing metadata.
- Image Model nodes and image-generation fallbacks default to `16:9` aspect ratio and `1K` resolution.
- Nano Banana Pro must follow the explicit Image Generation provider preference: direct Google for Google or the configured Fal Nano Banana Pro endpoint for Fal.
- Provider failures such as high demand, quota exhaustion, overload, and 5xx/429 responses should display the selected provider's diagnostic on the node. The user may switch the relevant Model Providers setting before retrying; the runtime must not silently fall back.

## Settings Standards

- The Settings page shows local key status for Fal, Google, Krea, and OpenAI without revealing stored secret values by default. Every saved credential has its own validation badge, and the active provider metric turns green only after a no-generation provider request verifies that selected credential; provider outages and timeouts remain unverified rather than being reported as invalid.
- Credential activation uses mutually exclusive radio controls, including a `None` option, rather than independent toggles. Saving model preferences, provider routing, and ComfyUI root configuration must preserve unchanged credential profiles.
- Every Settings content panel must have an arrow-button header and independent collapsed state. Keep API Credentials and Model Providers open initially for first-glance clarity; secondary panels may start collapsed.
- Model Providers must show explicit MiniMax H3 Fal/Local and Seedance 2.0 / 2.5 Fal/Krea routes, plus Google/Fal routes for Google video/Veo and Nano Banana Pro image generation. The selected option remains authoritative until the user changes it.
- Local MiniMax H3 readiness and local ComfyUI configuration/preflight status remain available alongside the remote-provider controls.
- The Branch metric shows the current branch state and the loaded package version from `package.json`.
- Enabled Models controls the model dropdown preferences stored in runtime settings. It should list every callable Image Model and Video Model option exposed by `src/modelOptions.js`.
- Repository update and restart actions belong in Settings and should call local server routes through `src/api/newtApi.js`.
- Runtime settings should remain local app state. Do not treat `server/data/runtime-settings.json` or generated history files as source fixtures.

## Cross-Platform App Standards

- Browser and shared helper code must not depend on Windows-only paths, drive letters, hidden-folder behavior, shell commands, or `.exe` names. Use URL helpers in browser code and Node `path`/`fs` APIs server-side.
- Preserve both Windows and macOS startup entry points when changing app launch behavior: `Launch_NewtNode.ps1`, `Launch_NewtNode.bat`, `Restart_NewtNode.ps1`, `Restart_NewtNode.bat`, `NewtNode.command`, `Versus_NewtNode.command`, `Versus_NewtNode.app`, and `mac/NewtNodeLauncher.applescript`.
- Launch and restart entry points must honor `PORT`, `VITE_API_PORT`, `NEWTNODE_CONTROL_PORT`, `VITE_CONTROL_API_PORT`, and `VITE_CLIENT_PORT` so side-by-side update tests do not stop, relaunch, or health-check the default NewtNode instance. Desktop file dialogs, folder launches, workflow persistence, and other control requests use the dedicated control port so long-lived generation requests cannot exhaust their browser connection lane.
- Windows and macOS launchers must run `scripts/ensureDependencies.mjs` before building or starting services. The preflight owns automatic npm installation after a pull; keep its behavior and `docs/dependencies.md` aligned with `package.json` and `package-lock.json`.
- Preserve app icons and bundle metadata when changing launchers or packaging: `public/icon.png`, `Versus_NewtNode.app/Contents/Info.plist`, and the `.icns` resources under `Versus_NewtNode.app/Contents/Resources/`.
- Keep launcher ports, health URLs, package scripts, and README startup instructions aligned. Document platform-specific commands separately rather than baking them into shared code.

## UI Design Standards

- The canvas is the primary workspace, not a landing page.
- Node cards should be functional, compact, and scannable.
- Controls should be familiar: sliders/inputs for numbers, toggles for booleans, selects for option sets, icon buttons for compact actions.
- Text must fit inside buttons, rows, cards, and panels at desktop and mobile widths.
- Avoid one-off color themes. New media colors must be distinct from existing node categories.
- Do not add decorative orbs, oversized hero elements, or marketing-style sections inside the app.
- For 3D scenes, use Three.js and verify nonblank rendering.
- Use stable dimensions for boards, previews, result panes, and tool rows so hover or dynamic content does not shift layout.
- Scrollable tool panels should consume available space before introducing nested scrollbars. When a control list must scroll, make the scrollbar discoverable and verify the first and last controls are reachable.
- Draftable text inputs and textareas update their DOM/local draft immediately and commit graph state on the shared debounce or blur boundary. Do not make each keystroke rebuild the full node graph, port map, and edge layer.
- Pan and wheel zoom use the live viewport ref and React Flow's imperative viewport API during the gesture, then commit Newt's persisted viewport state after the transient interaction. A delayed state commit must never snap the viewport back to an older value.
- Keep React Flow's offscreen culling disabled in the current full-detail mode. Every node retains its complete UI during pan and zoom, including at the 5% minimum zoom; graph execution remains independent from visibility. Reintroducing lightweight shells or overview proxies requires a deliberate feature change and production-scale interaction testing.

## Timeline Node Standard

The Timeline node is Newt Node's basic nonlinear editor and stays modular across timeline state, playback, rendering, media management, and UI.

- UI label and internal type: `Timeline` / `assembly` (legacy-compatible internal type).
- Catalog placement: after Edit and before Audio.
- Default shell: horizontal `1080px` by `520px`, with a resizable timeline workspace.
- Inputs: multi-connect `videoIn`, `imageIn`, and `audioIn` ports. Each connected source is imported once into the media bin and remains identified by source node id and output port. When that same source port generates a new URL, update the existing bin media object in place and preserve its media id so every timeline clip using it follows the new result. Importing or refreshing media must not recreate timeline clips.
- Media bin: a fixed one-column rail occupies the left side of the node. It accepts connected sources and direct drops from Newt media-output drag payloads. Connected media is live-linked by source node and output port; direct drops are URL-based snapshots and do not follow later generations unless that source is also connected. Every asset preserves its visible aspect ratio, video and still assets show thumbnails, audio uses its waveform when available, and double-click opens an aspect-safe enlarged viewer.
- Bin assets are reusable source objects. Each drag to a compatible timeline track creates a fresh independent clip at the drop time, so one connection can supply any number of timeline instances. A connected source refresh preserves those clip edits and media references while replacing the source URL used by all instances.
- Outputs: `frameOut` emits the Timeline-owned playhead frame as an image; `videoOut` emits the most recent FFmpeg render.
- Both Timeline output rows and handles live on the right-hand node edge. Preserve the `frameOut` and `videoOut` ids when changing their layout.
- Preview nodes remain ordinary viewers. Timeline owns playback and publishes throttled playhead-frame updates through existing graph result propagation; do not add timeline state or transport ownership to Preview. Loop In/Out is a persistent Timeline transport mode: it is disabled without a valid two-marker range, starts at In whenever playback begins outside the range, and wraps from Out back to In without pausing.
- Scrubbing remains frame-accurate and withholds a requested channel until its seek completes. Forward playback instead keeps each decoded channel visible through ordinary decoder drift, avoids issuing another correction while a seek is active, and only seeks when drift is large enough to threaten synchronization.
- Timeline timeline focus owns clip-editing shortcuts. Ctrl/Cmd+C copies the selected clip instance with its trim and slip state, Ctrl/Cmd+V pastes a fresh instance at the playhead, and Delete/Backspace removes the selected clip. Handled clip shortcuts must stop propagation so canvas-level copy, paste, undo, and node deletion do not run from the same keypress; ordinary text fields retain native editing behavior.
- Persist only normalized serializable timeline state. DOM media elements, decoder state, request state, and undo/redo stacks remain runtime-only.
- Editing operations are immutable state transitions. Current operations include split, trim, ripple delete/trim, slip, pointer-locked clip sliding with magnetic edge snapping and deliberate compatible-track switching, track add, visibility/mute/lock, zoom, scrub, persistent In/Out range markers set with I and O, marker jumps with { and }, bounded In/Out loop playback, and undo/redo.
- Visual tracks composite top-down with contain/letterbox behavior. Audio tracks and enabled embedded video audio mix at their timeline offsets.
- Media probing and waveform generation use local ffprobe/FFmpeg routes. Final rendering uses the local FFmpeg runtime and writes a managed workflow-package MP4.
- Timeline duration for display may include empty working space, but renders stop at actual content end.
- New track kinds such as subtitles or AI annotations should extend the track schema and renderer adapters without changing the master clock or Preview contract.
- The design is adapted from OpenReel Video's MIT-licensed clock/history/module patterns; provenance is recorded in `THIRD_PARTY_NOTICES.md`. Do not vendor the complete OpenReel app into Newt Node.

## Edit Node Standard

The Edit node establishes the standard for local ffmpeg-backed media editing nodes.

- UI label: `Edit`.
- Internal type: `edit`.
- Catalog placement: under Utility and above Audio.
- Output port: `editOut`, colored as image or video based on the selected source type.
- Inputs: `imageIn` for image effects and `videoIn` for video effects. Image and Video source tabs filter the effect list to compatible definitions. Switching source type or effect group should remove stale incompatible Edit edges.
- Visible effect groups are `Transform`, `Time`, `Color`, `Blur`, and `Effects`. Backend support for older hidden cleanup effects may remain for saved-workflow compatibility, but hidden groups should not appear as tabs.
- Effect definitions, labels, controls, defaults, and definitions live in `src/editEffects.js`. Backend ffmpeg filter mapping lives near `/api/node/edit-media` handling.
- Edit node operations are local ffmpeg edits. They should not call a paid provider.
- Source URLs must resolve to local NewtNode assets under `/outputs`, `/uploads`, or `/workflow-assets`; remote or browser-only object URLs should fail with a helpful message.
- Output files should be managed assets written to the active workflow package `outputs/` folder, or to local `/outputs/<workflow-name>/` when no package is attached.
- Video output formats are MP4, WebM, and ProRes MOV. Image edits output PNG.
- The Settings drawer should show a live ffmpeg-backed preview frame for the selected effect and source. Preview requests should debounce control changes, ignore stale responses, and return temporary inline PNG data instead of writing output/history entries.
- Video previews use a frame-time slider. Time-only effects should still preview a representative frame: Trim previews within the selected start/end range, Reverse maps the selected preview time from the end of the source, and FPS previews the source frame because it does not visibly change a single frame.
- Image `Crop` uses an interactive crop box and never crops the source merely because the node shell was resized. Normal dragging is freeform; Ctrl-drag preserves the current crop proportions.
- `Scale` seeds pixel Width and Height from the connected source dimensions. Sliders and direct number inputs stay synchronized; the aspect-lock toggle keeps dimensions proportional when enabled.
- Use the visible label `Invert` for the legacy internal effect id `negate`. Do not expose the hidden Cleanup group or retired one-click Flip Horizontal, Flip Vertical, Rotate 90, or Crop Center entries.
- Time `Trim` uses start/end seconds tied to a compact clip timeline. Dragging the head or tail updates the fields, and typing in the fields updates the handles. The default end time should seed from the connected clip duration when metadata is available.
- Brush Inpaint exposes `Create mask` in the compact and enlarged brush controls. It saves the current painted region as a black-background, white-region PNG result without calling the inpaint provider, and the Edit mask output port emits the newest mask result.
- Edit outputs should append to `resultItems`, preserve previous results, support download, and connect anywhere a normal image or video output can connect.
- History entries should use provider `local`, endpoint `local/edit-media`, model name `Edit: <effect label>`, and `$0` local edit cost metadata.

## 3D Node Standard

The 3D node establishes the standard for model generation nodes.

- UI label: `3D`.
- Internal type: `model3d`.
- Color: teal `#14d8c8`.
- Output port: `modelOut`.
- Output media: GLB by default.
- Preview: shared lazy `Model3DViewer` wrapper.
- Required input: `frontImageIn`.
- Optional inputs: `backImageIn`, `leftImageIn`, `rightImageIn`, `topImageIn`, `bottomImageIn`, `leftFrontImageIn`, `rightFrontImageIn`.
- Backend payload should preserve named view mapping instead of relying on connection order.
- Generated model results should be downloadable from the result pane.
- Stats should count 3D runs in media mix and estimated spend.

## Verification Checklist

Before completing source changes:

- Run focused tests while iterating, then run `npm test` when shared node, graph, workflow, runner, result, geometry, provider, or server behavior changed.
- Run `npm run build` for every source change that can affect the client or server contract.
- Run `npm run bundle:report` after startup-loading, lazy-loading, or heavy UI ownership changes.
- Run `git diff --check` for every change.
- Run `node --check server/index.js` and any touched `server/routes/*.js` file when the server changed.
- When Settings, update, restart, or health payload behavior changes, verify `/api/settings`, `/api/settings/update`, `/api/settings/restart`, and `/api/health` with the dev server running.
- Run `git status --short --branch` and confirm only intentional source/doc changes are staged. Runtime files under `server/data/`, `outputs/`, `uploads/`, and generated workflow JSON should stay ignored.
- Confirm `/api/health` reports any new route flags.
- For workflow persistence changes, test New, Save, Save As, Open, Import, Recent workflows, and the unsaved-change guard. Confirm save success is not blocked by background index rebuild failures.
- When the dev client is not on the smoke default port, pass explicit smoke URLs, for example `npm run smoke:app -- http://localhost:5176/ http://localhost:3336/api/health`.
- Check that existing saved workflows still load.
- Check that new ports connect, reject incompatible edges, and auto-connect correctly.
- Verify node identity behavior: bind an `@token`, rename its source node, confirm the visible token updates while the saved node id remains unchanged, and confirm the next run uses the same source output. Include a duplicate-title case and a copy/import remap case when reference behavior changes.
- Check collapsed and expanded node states. Confirm every connected line stays visible and reanchors without an extra interaction when a connected section collapses or expands.
- For resize changes, test width-only, height-only, diagonal, minimum, maximum, saved/reopened, and shrink-back behavior. Confirm the primary media/workspace expands first, controls remain reachable, aspect ratios remain correct, and lines track every port during the drag.
- For large-canvas changes, test at 5%, 8%, 30%, and 100% zoom with a production-scale graph. Every node and edge must remain present, node bodies must not flicker or turn into proxies, edge weight must remain screen-stable, selection must stay correct, and pan/zoom must not snap back.
- For clipboard/import changes, paste a multi-node selection with an internal edge, group, and bound `@token` into another open workflow and confirm all ids are fresh and correctly remapped.
- For Output changes, test tokens in both Path and Filename, collision handling with and without `$index`, direct Output copy, source-run redirection, Preview propagation, save/reopen, and a genuinely missing external file.
- Check Preview behavior for every output media type touched. For right-rail image changes, open an image and verify Left/Right navigation skips non-images, wraps, and leaves typing controls alone.
- For generation-progress changes, verify provider percent, estimated percent, queue position, batch aggregation, terminal success/failure, polling shutdown, and progressbar accessibility.
- Check Stats after a recorded run or with representative history.
- Restart `npm run dev` when route changes are not visible in the running backend.

## Definition Of Done

A NewtNode feature is complete only when every applicable statement is true:

- Its visible behavior, internal data, route contract, and documentation describe the same feature.
- Existing workflows normalize without losing nodes, edges, references, results, settings, package assets, or legacy internal identities.
- New ports connect, reject, auto-connect, animate, and reanchor correctly; run scheduling respects every dependency.
- Results propagate to the source node, Preview, output rail, downstream nodes, Output routes, downloads, save/reopen, and direct drag/drop as applicable.
- Paid/model work uses the selected credential and provider, reports useful failures, exposes honest progress, and records reproducible history/cost/Stats data.
- Media remains fully visible and aspect-correct in nodes, layouts, rails, modals, and previews except inside an explicit crop/edit operation.
- Loading, empty, disabled, success, partial-success, cancellation/timeout, missing-asset, and failure states are handled where relevant.
- Keyboard, focus, text editing, resize, pan, zoom, selection, and large-workflow behavior have not regressed.
- Files remain managed, portable, sanitized, and inside approved roots; no secret, personal path, signed URL, runtime data, or generated media is present in the diff.
- Windows and macOS behavior remains aligned for every platform-sensitive surface.
- Required focused tests, full tests, build, syntax, smoke, bundle, and manual checks pass at the feature's risk level.
- The final diff contains only intentional work and the user has not been promised a commit/push that was not actually requested and verified.

## Amendment Rule

This document is not law carved in stone. If a future feature needs a different pattern, update this document in the same PR or commit that introduces the new pattern. The important thing is that future development has one shared reference point.
