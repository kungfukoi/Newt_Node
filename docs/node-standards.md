# NewtNode Development Standards

This is a living standard for NewtNode. It describes the current conventions for nodes, UI, media flow, backend routes, cost tracking, and verification. Amend it when the app deliberately changes direction. Do not bypass it casually.

Before starting any new feature, read this document first. If the feature changes a core workflow, update this document in the same change so the next feature starts from the current truth.

## Goals

- Keep every node predictable to build, use, save, load, preview, run, and debug.
- Preserve a clean canvas by default, with advanced controls hidden behind Settings.
- Make media types explicit so connector lines, ports, previews, stats, and backend routes stay in agreement.
- Track generation cost honestly whenever the app can estimate or record it.
- Prefer small, compatible changes over one-off node behavior.
- Keep saved workflows portable enough that another user can open and run a packaged graph from a shared drive when the needed assets are included.
- Keep runtime configuration, update, and restart behavior local, visible, and cross-platform.

## Current Branch Scope

This branch is the current development line for the next mainline merge. Treat these as durable surfaces, even if the branch name or release version changes during promotion:

- The Settings workspace is part of the app shell and owns local API keys, update repository, branch status, pull/update, and restart requests.
- The File menu owns New, Save, Save As, Open, and Import. New starts a blank workflow through the same unsaved-change guard as Open and Import.
- Text Model defaults to the Fal OpenRouter route with Gemini Flash model ids unless environment variables override them.
- Utility model coverage includes Luma Photon/Ray2, Depth Anything Video, Fal Wan LoRA/VACE models, and local ComfyUI WanBlend/WanSegment/WanWarp workflows.
- Workflow saves should stay fast: the client upserts the returned project summary, and the server rebuilds workflow indexes after the save response rather than blocking the write path.
- When this branch is merged or released, app version displays should derive from package metadata and be updated with the release bump, not hard-coded in UI copy.

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

## Refactored Code Ownership

`NodeEditor.jsx` remains the canvas/UI orchestrator, but new work should not default to adding more pure logic there. Keep reusable logic in the smallest existing module that owns the concern.

| Area | Primary files | Standard |
| --- | --- | --- |
| API clients | `src/api/newtApi.js` | Add browser-side route wrappers here instead of scattering raw `fetch` calls. |
| App shell and Settings | `src/main.jsx`, `src/SettingsPage.jsx`, `src/api/newtApi.js`, `server/routes/core.js`, `server/index.js` | Lazy-load Settings from the app shell. Keep settings API wrappers in `newtApi.js`; register Settings, update, restart, health, and storage routes through `server/routes/core.js`; keep runtime config implementation in `server/index.js`. |
| Node registry | `src/nodeRegistry.js`, `src/NodeEditor.jsx` icon map | Add catalog definitions in `nodeRegistry.js`; add only the display icon mapping in `NodeEditor.jsx`. |
| Node config/defaults/normalization | `src/NodeEditor.jsx` | `getNodeConfig`, `createDefaultNodeData`, and `normalizeCurrentNode` still live here. Keep backward-compatible migrations close to these functions until they are deliberately extracted. |
| Run scheduling and result state | `src/nodeRunner.js`, `src/nodeRunners/*` | Batch counts, batch result aggregation, selected-node dependency scheduling, and run status text belong in `nodeRunner.js`. Node-specific API runners and reusable request/result builders belong in focused files under `src/nodeRunners/`. |
| Media drag/drop and imported asset shape | `src/mediaAssets.js` | Output-rail drag payloads, external file type detection, file-to-node mapping, and media accept rules live here. |
| Result items | `src/mediaResults.js` | Normalize, append, label, and download result items here. Do not hand-roll result array merging in node run branches. |
| Model, utility, and edit options | `src/modelOptions.js`, `src/editEffects.js` | Model names, preset names/prompts, aspect ratios, duration/resolution lists, utility descriptions, model-control option lists, and Edit node effect definitions live here. Keep labels stable because saved workflows and UI normalization rely on them. |
| Canvas chrome | `src/components/CanvasChrome.jsx` | Memoized edge paths, selection marquee/action bar, and workflow prompt live here. Keep hot SVG/UI chrome out of `NodeEditor.jsx`. |
| Preview/result UI | `src/components/MediaViews.jsx`, `src/components/Model3DViewer.jsx` | Shared previews, result panes, project output drawer, output lightbox, lazy output-rail media loading, and the lazy 3D viewer wrapper live in `MediaViews.jsx`. The actual GLB renderer lives in `Model3DViewer.jsx`. |
| Small node bodies | `src/components/NodeBodies.jsx` | Plain Text, Text Model, upload media, and Composer summary bodies live here. Preserve their prop-driven behavior and class names when extending them. |
| Composer/camera 3D UI | `src/components/ComposerViewport.jsx`, `src/components/CameraControlViewport.jsx`, `src/composerState.js`, `src/composerRender.js` | Interactive Three.js viewport shells for Composer and Camera live in the component files. Composer defaults, normalization, saved pose fields, and image plane helpers live in `composerState.js`; Composer Three.js rendering and mannequin asset loading live in `composerRender.js`. Composer pose preset API wrappers live in `src/api/newtApi.js`; backend pose-library persistence lives in `server/routes/composerPoses.js`. |
| Node port rows and transfer collage | `src/components/NodePorts.jsx`, `src/components/StyleCollage.jsx` | Reusable port handles/rows and the transfer mood-board collage live here. Keep class names and drag/drop behavior stable because many node bodies depend on them. |
| Settings page | `src/SettingsPage.jsx`, `server/index.js` settings routes | Runtime API key entry, repository update, restart, branch status, loaded app version, and enabled-model preferences live here. Keep settings data local and avoid exposing secret values in logs, history, or docs. |
| Project output rail data | `src/projectOutputs.js` | Build and filter project output rail items here; keep filesystem/history filtering out of render code. |
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

## Text Node Roles

- `Text` is the simple prompt node. It should stay lightweight: one plain textarea, one prompt output, no run button, no backend call.
- `Text Model` is the AI text-processing node. It can accept text, image, video, and style inputs, calls the local text-processing route, and records text model history/cost. The default text and vision-text route is Gemini Flash-class through Fal/OpenRouter route constants in `server/index.js`, with explicit environment overrides for model changes.
- Text and Text Model prompts may mention nodes by name with `@Node Name`. Mentions match exact node titles, including spaces, and compact aliases such as `@NodeName` or `@Node-Name`. Text Model sends referenced text, image, and video nodes as structured model context; Image and Video Model prompts that consume referenced Text output also receive referenced media nodes as prompt-side references when compatible.
- Existing saved `text` nodes represent `Text Model`; keep that compatibility unless a migration explicitly changes it.
- The default text-processing provider is Fal via `TEXT_LLM_PROVIDER=fal`. The current default model ids are `google/gemini-2.5-flash` for `FAL_TEXT_MODEL`, `FAL_VISION_TEXT_MODEL`, `FAL_VISION_TEXT_FALLBACK_MODEL`, and `FAL_VIDEO_TEXT_MODEL`.
- Fal text processing uses `openrouter/router` and should pass the app's text-processing instructions as `system_prompt`. Image and video helper descriptions use the matching OpenRouter vision/video routes before the final text prompt is assembled.
- OpenAI text processing remains an explicit provider override through `TEXT_LLM_PROVIDER=openai` and `OPENAI_TEXT_MODEL`; do not silently switch providers in UI code.

## Node Definition Checklist

Every new node type should touch the same core surfaces unless there is a clear reason not to.

- Add it to `nodeTypeDefinitions` in `src/nodeRegistry.js` with a concise label, and add the lucide icon mapping in `NodeEditor.jsx`.
- Add `getNodeConfig(type)` with all input and output ports.
- Add defaults in `createDefaultNodeData`.
- Add normalization in `normalizeCurrentNode` so saved workflows remain stable.
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

## Port And Connection Standards

- Ports should be typed by media and colored from `portColors`.
- Port ids should describe purpose, not only type, when ambiguity matters.
- Generic ids like `imageIn` are acceptable for simple nodes.
- Specific ids like `frontImageIn`, `maskVideoIn`, or `referenceAudioIn` are preferred when the backend treats them differently.
- Input labels should be short and concrete: `Front`, `Mask Video`, `Prompt`.
- Collapsed input stacks should show colored dots without extra labels.
- Expanded settings should expose named inputs in rows.
- Connector lines inherit the source output color.
- Incompatible connections should fail with a plain, helpful message.
- Auto-created nodes from a dragged connector should link only when compatible.
- Backward compatibility matters: if a port is renamed, migrate previous edge shapes in `normalizeEdgeForCurrentGraph`.

## Result And Preview Standards

- Generation nodes should keep previous results instead of clearing the result pane.
- Result panes should support image, video, and 3D model display.
- Videos should loop when played in Video and Preview nodes.
- Video result panes and video media previews should preserve browser scrub controls. Dragging a video result into another node uses Ctrl+drag so normal left-drag remains available for scrubbing.
- Preview nodes should preserve existing preview history and update to the latest connected generation result.
- Preview nodes should support stepping through multiple connected or generated results.
- Generated outputs should have a node-level download affordance when possible.
- 3D outputs should be displayed with the shared lazy Three.js GLTF viewer.
- If a node returns multiple outputs, store them in `resultItems` with explicit `type`, `url`, `label`, and optional `cost`.
- Result item normalization and append behavior belongs in `src/mediaResults.js` and `src/nodeRunner.js`; do not duplicate result merging logic inside individual node branches.
- The project output rail should show recent local outputs from the current graph and matching history only. Include `/outputs/<workflow-name>/...` and packaged `/workflow-assets/<workflow-id>/outputs/...` URLs; do not add absolute machine-local paths or browser object URLs.
- Project output rail data belongs in `src/projectOutputs.js`; shared preview/result UI belongs in `src/components/MediaViews.jsx`.
- Fetch output history lazily when the output rail first opens. Manual refresh and generation completion may still refresh it immediately.
- Output rail thumbnails should keep layout stable and lazy-load image/video media as they near the visible rail; the full-size lightbox owns eager preview loading after double-click.
- Dragging from the output rail into a compatible node should reuse the existing local output URL instead of re-uploading or copying the asset. Keep the imported asset shape aligned with normal uploaded assets so saved workflows remain portable.
- Dragging from the output rail onto the canvas should create a matching media node in place. Dragging external files onto the canvas should import supported media into the current workflow package/app storage and create matching Image, Video, Audio, 3D, or Text nodes; text files store file contents in the Text node.
- Double-clicking an output rail thumbnail should open a lightweight full-size preview modal instead of expanding the rail. The modal must fit the complete image or video in its native aspect ratio rather than cropping it.
- The output rail should expose an open-folder action for the current project's output folder through the local API.

## Run And Dependency Standards

- `Run All` must respect dependencies.
- Selected-node dependency scheduling belongs in `src/nodeRunner.js`; `NodeEditor.jsx` should pass callbacks for UI status and skipped-node updates.
- Prompt/Text processing runs before media generation.
- Image-producing nodes run before nodes that depend on images.
- 3D nodes should run after their image dependencies are available.
- Video-producing nodes run after prompt, image, 3D, or utility dependencies they consume.
- Edit nodes run after their source image or video dependencies and use the same dependency stage as Utility and Video Model work.
- Independent nodes of the same stage may run concurrently.
- Nodes should set `status`, `error`, `resultUrl`, `resultItems`, `selectedResultIndex`, and `resultType` consistently.
- Batch failures should report partial success without discarding successful outputs.

## Composer Node Standard

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

## Settings And Runtime Update Standards

Settings is a local runtime control surface, not an account system.

- The Settings page is lazy-loaded by `src/main.jsx` and should use `settingsApi` from `src/api/newtApi.js` for every request.
- The current Settings routes are `GET /api/settings`, `POST /api/settings`, `POST /api/settings/update`, and `POST /api/settings/restart`; `/api/health` must advertise `routes.settings: true`.
- Secrets can be loaded into Settings with `includeSecrets=1`, but UI fields must remain password-style by default with explicit reveal buttons.
- Runtime settings live in `server/data/runtime-settings.json`. Treat that file as local state: ignored by git, not a fixture, and not a source of defaults for another machine.
- `.env` remains a valid source for keys and update repository values. Settings overrides should be reflected in `process.env` through the runtime config refresh path, and the UI should show whether each key came from `.env` or Settings.
- The update action must stay constrained to the configured repository and the currently checked-out branch. It should first try `git pull --ff-only` against that repository and branch. If that fast-forward pull fails, it should stage a fresh replacement clone, install dependencies, preserve local `.env`, `server/data`, workflows, inputs, uploads, and outputs, swap the app folder, relaunch through the platform launcher, and remove the old install only after the replacement reports healthy. Keep Windows PowerShell and macOS bash handoff scripts aligned; do not add merge, reset, or branch-changing behavior to the Settings button.
- Branch status should compare the current local branch with the configured remote branch head and report a plain state such as up to date, update available, local changes, local ahead, repository differs, or check failed.
- Restart requests should go through `/api/settings/restart` and the restart marker flow. Preserve Windows and macOS launchers/watchers when changing restart behavior.
- If the Settings branch tile or health payload shows the app version, derive it from package metadata so release bumps update the display automatically.

## Hosted Utility Model Standards

Hosted utility models should follow the same request, result, history, and stats contracts as other generation nodes.

- Keep hosted utility labels and option lists in `src/modelOptions.js`; saved workflows rely on stable labels.
- Luma image generation is represented by `Luma Dream Machine` image model behavior through Fal Luma Photon. Luma video generation uses Luma Ray2 through Fal and should keep duration, resolution, and aspect-ratio normalization aligned between `src/modelOptions.js`, `src/NodeEditor.jsx`, `server/index.js`, and `StatsDashboard.jsx`.
- Luma pricing belongs in server pricing constants and `/api/stats`; support endpoint and pricing overrides with environment variables.
- Depth Anything Video is a Utility Video model. It requires a connected source video, supports model, colormap, resolution, max-frame, output-FPS, and side-by-side controls, and returns a normal video result item.
- Depth Anything image and video preprocessors are paid Fal utilities. Estimate cost from the available image/video duration data; mark the cost unpriced when duration is unavailable instead of inventing a fake amount.
- Topaz Image Upscale and Topaz Video Upscale are paid Fal Utility models. Keep their image/video option lists separate because the Fal schemas differ, and estimate cost from output megapixels for image or output-resolution tier, duration, FPS, and Gaia 2 multiplier for video when that metadata is available.
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
- The Recent workflows dropdown behaves as a Recent Files list backed by the local server registry, not as a live scan of every JSON file on disk. The trash action removes the workflow from the dropdown only; it must not delete the local registry JSON, packaged workflow JSON, or external workflow JSON from disk. Re-saving or re-opening a workflow can register it in the dropdown again.
- New/Save/Open/Import orchestration belongs in `src/useWorkflowPersistence.js`; workflow document construction and display paths belong in `src/workflowFiles.js`; graph fingerprints, cloning, deduping, import remapping, and stale runtime cleanup belong in `src/workflowState.js`.
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

## Workflow Package Standards

Portable packages are the default Save As shape for workflows that need to move between machines or live on a shared drive.

- Save As opens the native folder picker and lets the user choose the parent folder.
- Save As creates or updates a package folder named from the workflow, with this shape:

  ```text
  WorkflowName/
    WorkflowName.json
    inputs/
    outputs/
    dependencies/
    .newtnode/
      manifest.json
  ```

- `inputs/` contains uploaded source media used by graph nodes.
- `outputs/` contains generated media and explicit node outputs.
- `dependencies/` contains derived helper assets needed to rerun or inspect the graph, such as padded frames, composed mood boards, masks, and other intermediate support files that are not primary user uploads or final outputs.
- `.newtnode/manifest.json` records package metadata and copied asset entries. It should help diagnose missing assets without becoming required runtime state. Keep the package root visually focused on the workflow JSON and asset folders.
- A packaged workflow should still appear in the Recent workflows dropdown through the local `/saved_workflows` registry copy.
- Save updates the attached package in place. Save As copies the graph and its current local assets into the chosen package folder.
- Once a package is attached, upload and generation requests must include the workflow package context so new files are written into that package.
- Packaged assets must be served through `/workflow-assets/<workflow-id>/...`.
- Vite development proxy config must include `/workflow-assets` anywhere it includes `/uploads` and `/outputs`.
- Opening a packaged workflow must register its package path with the local server before packaged assets are expected to preview or run.
- Importing a workflow must remap node, edge, and group IDs and place the imported graph in a clear canvas area rather than directly on top of the current graph.
- Do not use browser-only object URLs or absolute machine-local paths as saved graph dependencies.

## Provider Key Routing

- Fal is the default provider route for remote models.
- Image Model nodes and image-generation fallbacks default to `16:9` aspect ratio and `1K` resolution.
- Google image models should use a direct Google API key first when `GOOGLE_API_KEY` exists. Nano Banana Pro currently routes directly to Google when that key is present and otherwise routes through the configured Fal Nano Banana Pro endpoint.
- Transient Google image provider failures such as high demand, quota exhaustion, overload, and 5xx/429 responses should first display the Google diagnostic on the node. The node can then mark Fal fallback as available so the next run uses the Fal Nano Banana Pro route when `FAL_KEY` is configured. Do not fall back for Google auth, invalid request, safety, or content-policy failures.

## Settings Standards

- The Settings page shows local key status for Fal and Google without revealing stored secret values.
- The Branch metric shows the current branch state and the loaded package version from `package.json`.
- Enabled Models controls the model dropdown preferences stored in runtime settings. It should list every callable Image Model and Video Model option exposed by `src/modelOptions.js`.
- Repository update and restart actions belong in Settings and should call local server routes through `src/api/newtApi.js`.
- Runtime settings should remain local app state. Do not treat `server/data/runtime-settings.json` or generated history files as source fixtures.

## Cross-Platform App Standards

- Browser and shared helper code must not depend on Windows-only paths, drive letters, hidden-folder behavior, shell commands, or `.exe` names. Use URL helpers in browser code and Node `path`/`fs` APIs server-side.
- Preserve both Windows and macOS startup entry points when changing app launch behavior: `Launch_NewtNode.ps1`, `Launch_NewtNode.bat`, `Restart_NewtNode.ps1`, `Restart_NewtNode.bat`, `NewtNode.command`, `Versus_NewtNode.command`, `Versus_NewtNode.app`, and `mac/NewtNodeLauncher.applescript`.
- Launch and restart entry points must honor `PORT`, `VITE_API_PORT`, and `VITE_CLIENT_PORT` so side-by-side update tests do not stop, relaunch, or health-check the default NewtNode instance.
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

## Edit Node Standard

The Edit node establishes the standard for local ffmpeg-backed media editing nodes.

- UI label: `Edit`.
- Internal type: `edit`.
- Catalog placement: under Utility and above Audio.
- Output port: `editOut`, colored as image or video based on the selected source type.
- Inputs: `imageIn` for image effects and `videoIn` for video effects. Switching source type or effect group should remove stale incompatible Edit edges.
- Visible effect groups are `Transform`, `Time`, `Color`, `Blur`, and `Effects`. Backend support for older hidden cleanup effects may remain for saved-workflow compatibility, but hidden groups should not appear as tabs.
- Effect definitions, labels, controls, defaults, and definitions live in `src/editEffects.js`. Backend ffmpeg filter mapping lives near `/api/node/edit-media` handling.
- Edit node operations are local ffmpeg edits. They should not call a paid provider.
- Source URLs must resolve to local NewtNode assets under `/outputs`, `/uploads`, or `/workflow-assets`; remote or browser-only object URLs should fail with a helpful message.
- Output files should be managed assets written to the active workflow package `outputs/` folder, or to local `/outputs/<workflow-name>/` when no package is attached.
- Video output formats are MP4, WebM, and ProRes MOV. Image edits output PNG.
- The Settings drawer should show a live ffmpeg-backed preview frame for the selected effect and source. Preview requests should debounce control changes, ignore stale responses, and return temporary inline PNG data instead of writing output/history entries.
- Video previews use a frame-time slider. Time-only effects should still preview a representative frame: Trim previews within the selected start/end range, Reverse maps the selected preview time from the end of the source, and FPS previews the source frame because it does not visibly change a single frame.
- Transform `Crop Center` uses pixel `Width` and `Height`, seeded from the connected source dimensions when known. It uses sliders plus number inputs and an aspect-lock toggle; do not reintroduce percentage crop controls for this effect.
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

Before committing node or UI changes:

- Run `npm run build`.
- Run `npm run bundle:report` after startup-loading, lazy-loading, or heavy UI ownership changes.
- Run `npm test` when pure helpers, workflow state, node runner scheduling, or geometry changed.
- Run `node --check server/index.js` and any touched `server/routes/*.js` file when the server changed.
- When Settings, update, restart, or health payload behavior changes, verify `/api/settings`, `/api/settings/update`, `/api/settings/restart`, and `/api/health` with the dev server running.
- Run `git status --short --branch` and confirm only intentional source/doc changes are staged. Runtime files under `server/data/`, `outputs/`, `uploads/`, and generated workflow JSON should stay ignored.
- Confirm `/api/health` reports any new route flags.
- For workflow persistence changes, test New, Save, Save As, Open, Import, Recent workflows, and the unsaved-change guard. Confirm save success is not blocked by background index rebuild failures.
- When the dev client is not on the smoke default port, pass explicit smoke URLs, for example `npm run smoke:app -- http://localhost:5176/ http://localhost:3336/api/health`.
- Check that existing saved workflows still load.
- Check that new ports connect, reject incompatible edges, and auto-connect correctly.
- Check collapsed and expanded node states.
- Check Preview behavior for every output media type touched.
- Check Stats after a recorded run or with representative history.
- Restart `npm run dev` when route changes are not visible in the running backend.

## Amendment Rule

This document is not law carved in stone. If a future feature needs a different pattern, update this document in the same PR or commit that introduces the new pattern. The important thing is that future development has one shared reference point.
