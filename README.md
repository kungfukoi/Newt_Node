# NewtNode

<p align="center">
  <img src="public/newtnode-logo.png" alt="NewtNode wordmark" width="620" />
</p>

<p align="center">
  <strong>A local-first node canvas for AI media workflows.</strong>
</p>

NewtNode is a desktop-friendly browser app for building repeatable creative pipelines with connected nodes. It can generate, edit, preview, save, import, and remix images, video, audio, 3D assets, text, character references, style references, camera instructions, and Composer guide frames while keeping API keys and workflow files on your machine.

Current checkout version: `v4.5.3-beta.0` (package metadata; publication status is separate).

Start with the [Feature and Workflow Reference](docs/features-and-workflows.md). The [documentation audit](docs/documentation-audit-2026-10-15.md) records the source evidence and verification scope for this update.

## What It Does

- Build media workflows visually with typed node ports and dependency-aware `Run All`.
- Generate image, video, text, utility, edit, and 3D outputs through local API routes.
- Edit local image and video outputs with ffmpeg-backed Transform, Time, Color, Blur, and Effects controls.
- Use the Composer node to block camera, pose, image planes, props, maquettes, and guide frames before generation.
- Keep multiple node results, preview them in-node, send them to Preview nodes, or browse recent project outputs in the right rail.
- Track active model runs with per-node progress for queueing, generation, download, finalization, batches, and elapsed time.
- Drag outputs or external files onto the canvas to create matching Image, Video, Audio, 3D, or Text nodes.
- Save portable workflow packages with their inputs, outputs, and helper dependencies.
- Track model usage and estimated spend through the local stats view.

## Key Features

- **Local-first workflow files**: Save, Save As, Open, Import, Recent workflows, and unsaved-change prompts are handled locally.
- **Portable packages**: Packaged workflows keep project assets together so they can move across machines or shared drives.
- **React Flow canvas**: Stable node identities, handles, selection, resizing, and non-scaling connection lines remain responsive across large graphs. Full node interfaces stay available at every zoom level; proxy/map modes are currently disabled.
- **Provider routing**: Store multiple named Fal, Google, Krea, OpenAI, and Atlas Cloud credentials, select one active key per service, and explicitly route shared image, video, and text models to their supported provider.
- **Director and Storyboard**: Build structured shot direction with Cinematic, Vintage, Camcorder, Animation, Stop-Motion, Commercial, Photography, Music Video, and Montage approaches. `Still` duration locks Director to one image shot, and a built Director package can feed its prompt plus active references directly into an Image Model as well as supported Video Models and Storyboard. Image Models show the actual expanded reference count, refuse silent truncation, and let directly connected Style and Camera nodes override conflicting Director direction. Optional music and reference-video inputs can drive timing, camera, performance, extension, or visual reference behavior. Storyboard planning validates every cut and required keyframe before replacing existing work, and visual QC reports unavailable review honestly instead of treating it as a pass. See [Creative Workflows](docs/creative-workflows.md).
- **Seedance 2.5 drafts and editing**: Opt into 480p drafts through Fal or Atlas, then finish selected drafts at 1080p within seven days using the original provider key. Krea offers preview-only drafts; turning Draft off starts a new full-resolution generation. Both stages use durable recovery and preserve the preview. Edit Existing Video explicitly edits one 4–30 second source through Fal or Atlas.
- **Explore look controls**: Choose Random styles and grades independently, or use Explore Mode for distinct treatments. Resolved looks persist with each result and unfinished queue; attached image content stays constrained by the brief.
- **Audio and image model additions**: ElevenLabs v4 is available for Text to Speech. Nano Banana 2.1 supports Fal and Krea across the existing image tools; Nano Banana 2 and Ideogram generation remain available.
- **Character Sheet Library**: Build wardrobe-specific character sheets, add completed custom sheets without replacing generated variants, select the active identity reference, and preserve that selection for downstream image, video, Composer, and Storyboard work. Base and CU Video sheets checkpoint independently so a later failure does not discard a successful generation.
- **Newt Presets**: Save selected nodes, internal connections, complete groups, media dependencies, and optional reusable input slots as a local preset. Insert the preset repeatedly with fresh graph IDs and optionally bind its Image, Video, Audio, Character, Mood Board, Location, or Prop slots to nodes in the current project. See [Newt Presets](docs/newt-presets.md).
- **Preview and Layout**: Arrange mixed-aspect images and videos with before/after drag insertion, copy full-resolution tiles onto the canvas, and double-click to browse the Layout with Left/Right. Image tiles retain their number without an image badge. Local editing includes crop, rotate, curves, color, text, and masked inpainting; the enlarged editor adds object selection and boxes.
- **Current image models**: OpenAI Image 2.5 Flare/Sunburst, legacy OpenAI Image 2, Nano Banana Pro, Nano Banana 2, Nano Banana 2.1, Seedream 5.0 Pro, Flux 3, REVE 2.1, Ideogram 4.5, Krea 2 Large, and Z-Image. Enabled preferences, provider support, and the consuming tool determine the available subset.
- **Current 3D models**: Generate GLB assets with Hunyuan 3D 3.1 Pro through Fal or Krea, or Rodin 2.5 through Fal, from the 3D node's model menu.
- **Video outpainting**: Utility > Video > Video Outpaint expands a connected video to 9:16, 16:9 or 1:1 using Wan VACE 14B or Seedance 2.5 via the Outpaint model selector. Prepare the centered canvas and mask locally, review a manual or AI-drafted prompt, and Run separately. Canvas Edit lets you drag and resize a fixed-ratio output frame: footage outside is cropped, empty space inside is generated. Original footage can be restored over the retained source region; frames entirely covered by source video export locally without paid inference. See [workflow and limits](docs/video-outpaint-proof.md).
- **Coverage and location scouting**: Utility Image / Coverage creates nine Subject angles or Location scouting shots from one image. Location supports Interior/Exterior and conservative or exploratory unseen-space inference. Optional Style, Mood Board, and Character inputs influence every shot; completed shots remain visible during the batch and after Stop.
- **Style presets**: Written visual-treatment and grade instructions, including Found Footage. Director Approach separately controls planning, staging, pacing, and camera execution; Camcorder adds flashlight-lit first-person VHS horror direction.
- **Composer**: Choose Composer or Frame It mode. Block scenes with maquettes, Character bindings, props, and image planes, or pose and frame multiple 3D figures, then capture a shared guide-frame output for downstream image models.
- **Edit node**: Image and Video modes expose only compatible local ffmpeg-backed tools. Controls include source-sized scale, interactive crop, rotate, flip, trim with a draggable timeline, FPS, reverse, color controls, blur, sharpening, vignette, noise, Invert, edge detect, text overlay, and brush inpaint with mask output. Local preview frames update while controls change.
- **Timeline node**: Connected sources and directly dropped video, still, or audio outputs populate a reusable one-column media bin with uncropped thumbnails and enlarged source viewing. Connected bin sources remain linked by source node and output port, so a regenerated upstream result replaces the bin asset in place and updates every timeline instance; direct drops remain independent snapshots. Drag a bin asset onto compatible tracks as many times as needed, then split, trim, ripple, slip, move, copy/paste/delete clips contextually, zoom, scrub against generated audio waveforms, set visible In/Out markers with I and O, jump to them with { and }, loop playback strictly inside the marked range, undo/redo, and render an H.264/AAC timeline locally with FFmpeg. Timeline owns the playhead and emits live frames to every connected Preview node.
- **Preview rail**: A permanent project catalog keeps generations beyond the recent-history window, even after deleting source nodes. The single-column rail loads older results incrementally, uses lightweight video posters, preserves aspect ratios, and includes full-size viewing, open-folder, and drag-back-to-canvas actions. After opening a rail image, use Left/Right Arrow to step through other images.
- **Video handling**: Video thumbnails and result panes keep native scrub controls; use their drag grip or Ctrl-drag the video to create a media node or add the output directly to a Timeline bin.
- **Generation progress**: Model nodes show real provider progress when available and a clearly marked estimate otherwise, including batch completion, queue position, elapsed time, and terminal success/failure states.
- **3D preview**: GLB results render in-node with the shared lazy Three.js viewer.
- **Color ID to Matte**: Image and video matte pickers support color sampling, tolerance controls, and enlarged picker views.
- **Settings**: Local API keys, provider routing, user preferences, repository updates, restart, branch status, loaded version, and enabled-model preferences are managed in independently collapsible panels on the Settings page. User Preferences controls the Presets sidebar and whether Generate buttons show pre-run price snapshots.
- **Cross-platform launchers**: Windows and macOS share supervised production startup, rotating logs, and bounded crash recovery. Development watch mode remains separate.
- **Production reliability**: Recoverable history backups, bounded generation scheduling, inline uncertain-job recovery, and opt-in Settings diagnostics protect long-running work. See [Production Reliability](docs/production-reliability.md).

## Requirements

- Node.js 22.12 or newer on the 22 LTS line is recommended. The current Vite toolchain requires `^20.19.0 || >=22.12.0`.
- npm.
- Git is recommended but optional for public GitHub ZIP installations.
- Application packages, including the `@xyflow/react` canvas runtime, are declared in `package.json` and pinned by `package-lock.json`.
- At least one supported provider API key for remote generation.
- Fal is required for Fal-hosted models and utilities.
- Google, Krea, OpenAI, and Atlas Cloud keys are optional and can be enabled independently.

The Windows and macOS launchers check these npm dependencies before startup and automatically install anything missing or changed after a pull. See [NewtNode Dependencies](docs/dependencies.md) for the maintained runtime list and bootstrap behavior.

GitHub **Download ZIP** installations can update from Settings. Their first update uses the official repository and `main` branch automatically, preserves local settings and media, and converts to a normal Git-backed install when Git is available. Without Git, future updates continue through bounded GitHub source archives.

## Setup

Configure provider credentials inside **Settings > API Credentials**. Each service can keep multiple named keys, but only one key (or `None`) can be active at a time. Saving validates the keys and writes the active Fal, Google, Krea, OpenAI, and Atlas Cloud values into the local gitignored `.env` file automatically. Disabled keys remain saved as commented `.env` entries and are restored into Settings without being activated.

Models available through multiple services use the separate **Model Providers** setting. MiniMax H3 can route through Fal, Krea, Atlas Cloud, or a loopback SGLang service; Seedance 2.0 and Seedance 2.5 through Fal, Krea, or Atlas Cloud; Google video/Veo through Google or Fal; supported image models through Atlas Cloud; and Text Model/Text Agent processing through Fal, OpenAI, or Atlas Cloud. Media routes do not silently switch away from the selected provider.

Seedance 2.0/2.5 Video Model generations now keep tracking accepted jobs beyond 20 minutes, recover after a restart, and show completed batch clips individually. Temporary network/download problems retry against the original job without submitting another paid generation. See [Seedance Generation Recovery](docs/remote-video-recovery.md) for behavior and limitations.

### macOS

From Terminal in the repository folder:

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:5176`.

You can also double-click `Versus_NewtNode.app` for the app-style launcher when it is included, or run `NewtNode.command` / `Versus_NewtNode.command` when you want terminal logs visible.

### Windows

From PowerShell in the repository folder:

```powershell
npm.cmd install
npm.cmd run dev
```

Then open `http://127.0.0.1:5176`.

You can also double-click `Launch_NewtNode.bat`, or run `Launch_NewtNode.ps1` from PowerShell, to start the local backend, start the Vite UI, and open NewtNode.

If PowerShell blocks scripts, use the `.bat` launcher or run PowerShell as:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Launch_NewtNode.ps1
```

## Useful Commands

```bash
npm run dev
npm run build
npm test
npm run bundle:report
npm run smoke:app
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm.ps1`, for example:

```powershell
npm.cmd run build
```

## Workflow Storage

NewtNode stores runtime workflow state, recent workflow indexes, uploads, generated outputs, and package registrations locally. These files are intentionally ignored by git. Portable workflow packages use this shape:

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

Dirty packaged workflows are snapshotted every two minutes. The five autosave files rotate in place, reference the package's existing assets, and can be opened manually with **File > Open**. Autosaving does not replace the main workflow JSON or mark changes as manually saved.

## Named References

Reference images can be renamed in the thumbnail strip. Use those handles in your prompt with `@`, such as `@product` or `@talent`. The app translates your names to provider-specific reference tokens when needed.

## Development Standards

Agents and developers must begin with [`AGENTS.md`](AGENTS.md), then read the canonical standards before changing a feature:

- [`docs/node-standards.md`](docs/node-standards.md): normative engineering and UX contract.
- [`docs/architecture.md`](docs/architecture.md): current runtime, ownership, storage, and data-flow map.
- [`docs/development.md`](docs/development.md): setup, implementation loop, validation tiers, and troubleshooting.
- [`docs/performance.md`](docs/performance.md): canvas and bundle performance baseline.
- [`docs/README.md`](docs/README.md): complete documentation map, including operational and historical files.

A feature change is not complete until old workflows, ports, results, previews, Output routing, persistence, history/Stats, progress, error states, cross-platform behavior, tests, and affected documentation have been considered at the feature's actual blast radius.

### Explore and Image 2.5

[Explore](docs/explore-node.md) develops up to 25 art directions from a brief, with reference inputs, favorites, refinement and resumable image batches. OpenAI Image 2.5 Flare and Sunburst appear as separate image model choices throughout nodes and Settings. Saved variant selections migrate automatically; the image editor model is selected in Settings → User Preferences.

The image editor’s **Boxes** tool sits beside Object Selection. Draw up to eight named boxes and choose **New**, **Keep**, **Move**, **Remove**, **From Reference**, or **Text**. Drag to translate, use corner handles to scale, and rotate destination boxes with the round handle or numeric controls. Double-click a box or its canvas label to edit its description; Enter or clicking away saves, and Escape cancels. Canvas labels use half-size text and corner circles use quarter-size visuals with larger drag hit areas. Generation errors remain visible over the canvas, and stale pointer gestures cannot silently block submission. Move retains a dashed source box; Keep protects original pixels; Remove reconstructs the background; Text renders the supplied words. From Reference uploads one shared managed reference image per edit. All modes use the Image Editor Model in User Preferences. FLUX 3 receives structured source/destination coordinates. For other models, Generate identifies Move/Remove subjects by their description with SAM 3 (a separate Fal request); Select object lets you inspect the shape beforehand. Successful selections are reused on retries. NewtNode places the isolated cutout, uses it as an identity/placement reference, and asks the edit model to remove the old object’s shadows/reflections and regenerate scene-consistent lighting at the destination. Rotation uses that cutout path with any model. Activate Boxes with an existing selection to convert it directly into a Move box, reusing the selected shape without another SAM request. Prompt-based selections inherit their description; other selections get an editable Object name. A selection-derived box uses its cutout even with FLUX 3. Cleanup quality still depends on the chosen model. Box edits retain the full generated scene rather than clipping the result to rectangles, and support undo/redo. Only Keep boxes guarantee exact original pixels; other surroundings are preserved by model instructions. Cutout Move guides use the prepared image with the old object cleared, and explicitly request background reconstruction there. In Compare view, drag the divider directly on the image or use the synchronized bottom slider. Keep-only edits also need a prompt. Done saves the editor draft locally by source content identity, including selections, boxes, drawing marks, prompt, and edit method; reopening restores it without another scan. Completed runs record their box settings in History.

Box operations include hidden scene-context instructions for removal, placement, rotation, scaling, references and text. Infer appropriate surface contact, lighting, shadows, reflections and occlusion from the full scene; preserve unrelated objects and their effects. The per-box Shadow / lighting area defaults to 35% of the shorter box side, is adjustable from 0–100%, and expands softly feathered generation guidance around source/removal and destination silhouettes. Dashed outlines show approximate context reach, not hard crop boundaries; Keep boxes override it. The complete returned scene is retained for continuous surfaces and lighting, so unrelated pixels outside Keep boxes are not guaranteed byte-identical. Model output may vary and long shadows may need a larger area.

In the image editor, **Object Selection** exposes an explicit **Scan image for objects** action using Fal SAM 2 (default 32 × 32 sampling, 0.75 confidence). Opening the tool does not submit a scan. After scanning, hover to preview, click to select, Shift-click to add, and Alt-click to subtract. Clicking a missed region uses SAM 3. **Select by prompt** also uses SAM 3 (for example, “the jacket” or “all people”). These are hosted requests using your active Fal key; cached hover previews make no API calls. Selections support undo/redo and brush cleanup and feed the existing image-edit model. Source analysis is limited to 1024 pixels on the longest side, with masks mapped back to the original image; fine edges may need brush correction. Done saves the selection draft locally; scan/draft caches remain installation-local. Save selections and boxes exports an annotated PNG with portable tags, coordinates, and masks and creates an Image Selection node.

In Storyboard View, check up to eight panels, enter an instruction, and choose **Revise Selected**. Successful panels receive new directions and images; failed panels keep their originals. Planning and image generation use the configured providers and are billed normally.

Storyboard panels also offer **Protect panel** and **Previous versions**. Keep up to eight prior images with their directions; restoring a version retains the image it replaces.

New Storyboard plans track character positions and camera visibility across panels. Continuity checks catch unexplained disappearing occupants and position changes, with one bounded text correction before image generation. Existing saved boards remain usable.

### Audio Model

Add **Audio Model** from the node palette to generate Text to Speech, Dialogue and character voices, Speech to Speech, Sound Effects, or Music using ElevenLabs. Configure the active ElevenLabs key in Settings; voice modes need Voices Read and the corresponding generation permission. Select a Default or Mine voice, model, duration and advanced controls in the node. Results support playback, download, Preview, Output, compatible video/Director audio inputs, and workflow packages. Batches retain successful outputs if another generation fails. Cost labels are estimates; custom voice charges and unknown durations remain unpriced.

Flux 3 image generation and editing are available with a Fal key. Select Flux 3 in image model controls or Settings → User Preferences → image-edit model. It supports 1K, 2K, and 4K output and up to ten reference images.

Nano Banana 2.1 is integrated through Fal and Krea in Image Model, Explore, Character sheets, Coverage, Auto Aspect, Storyboard, and Settings → User Preferences → Image Editor Model. It is a separate selection from Nano Banana 2 and supports 1K/2K/4K output. The integrated Fal path uses high thinking with web search disabled; its recorded estimates are $0.082/$0.122/$0.162 per image (provider-specific estimates, not a live price quote). Selected-region edits use an image guide and restore unselected pixels locally. A dated Fal availability note describes its [generation](https://fal.ai/models/google/nano-banana-2.1) and [editing](https://fal.ai/models/google/nano-banana-2.1/edit) endpoints as integration-only; that historical notice is not a fresh provider availability check. Krea has its own supported ratios, up-to-14-reference limit, and pricing; Atlas 2.1 remains unsupported. See the [provider reference](docs/features-and-workflows.md#providers-and-models).

`Settings > User Preferences > Text Agent Model` selects GPT-5.6 Sol or GPT-6 Astra for new Text Agent messages. Click **Save Preferences** to apply the choice through your selected text provider.

FLUX 3 Max is available in the Video Model node through Fal. Choose Fal in Settings > Model Providers > Video Model. Generate from text or positioned Keyframe images, at 5–20 seconds and 720p/1080p, with audio, reasoning and seed controls. Director node input is not supported. Costs are explicitly unpriced pending verification.

FLUX 3 Max accepts up to 10 positioned keyframes. Each Keyframe row has its own image input and adjacent Frame Indices field at 24 fps, from 0 to duration × 24. Use +/− to add or remove rows. Positions must be unique; no boundary frame is required. There are no separate Start Frame or End Frame inputs.
