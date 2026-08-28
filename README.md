# NewtNode

<p align="center">
  <img src="public/newtnode-logo.png" alt="NewtNode wordmark" width="620" />
</p>

<p align="center">
  <strong>A local-first node canvas for AI media workflows.</strong>
</p>

NewtNode is a desktop-friendly browser app for building repeatable creative pipelines with connected nodes. It can generate, edit, preview, save, import, and remix images, video, audio, 3D assets, text, character references, style references, camera instructions, and Composer guide frames while keeping API keys and workflow files on your machine.

Current release: `v3.0.0-beta.0`

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
- **Provider routing**: Store multiple named Fal, Google, Krea, and OpenAI credentials, select one active key per service, and explicitly route Seedance, Google video/Veo, and Nano Banana Pro image generation to their supported provider.
- **Film Director and Storyboard**: Build structured shot direction, continuity-aware boards, editable layouts, compiled board references, frame exports, and client-ready PDFs.
- **Frame It**: Pose and frame multiple 3D figures, save complete compositions, and capture guide images for downstream generation.
- **Preview editing**: Assemble mixed-aspect layouts and apply crop, rotate, curves, color, text, and masked inpainting edits while keeping full-resolution source assets.
- **Current image models**: Work with OpenAI Image 2, Nano Banana Pro, Nano Banana 2, Seedream 5.0 Pro, REVE 2.1, Krea 2 Large, and Z-Image from the same reference-aware image workflow.
- **Composer**: Pose maquettes, save pose presets, bind Character nodes, add primitives and image planes, then capture a guide frame for downstream image models.
- **Edit node**: Image and Video modes expose only compatible local ffmpeg-backed tools. Controls include source-sized scale, interactive crop, rotate, flip, trim with a draggable timeline, FPS, reverse, color controls, blur, sharpening, vignette, noise, Invert, edge detect, text overlay, and brush inpaint with mask output. Local preview frames update while controls change.
- **Timeline node**: Connected sources and directly dropped video, still, or audio outputs populate a reusable one-column media bin with uncropped thumbnails and enlarged source viewing. Connected bin sources remain linked by source node and output port, so a regenerated upstream result replaces the bin asset in place and updates every timeline instance; direct drops remain independent snapshots. Drag a bin asset onto compatible tracks as many times as needed, then split, trim, ripple, slip, move, copy/paste/delete clips contextually, zoom, scrub against generated audio waveforms, set visible In/Out markers with I and O, jump to them with { and }, loop playback strictly inside the marked range, undo/redo, and render an H.264/AAC timeline locally with FFmpeg. Timeline owns the playhead and emits live frames to every connected Preview node.
- **Preview rail**: Recent project outputs lazy-load, support full-size lightbox preview without cropping, include an open-output-folder action, and can be dragged back into the graph. After opening a rail image, use Left/Right Arrow to step through the other images.
- **Video handling**: Video thumbnails and result panes keep native scrub controls; use their drag grip or Ctrl-drag the video to create a media node or add the output directly to an Timeline bin.
- **Generation progress**: Model nodes show real provider progress when available and a clearly marked estimate otherwise, including batch completion, queue position, elapsed time, and terminal success/failure states.
- **3D preview**: GLB results render in-node with the shared lazy Three.js viewer.
- **Color ID to Matte**: Image and video matte pickers support color sampling, tolerance controls, and enlarged picker views.
- **Settings**: Local API keys, provider routing, repository updates, restart, branch status, loaded version, and enabled-model preferences are managed in independently collapsible panels on the Settings page.
- **Cross-platform launchers**: Windows and macOS launchers are included for local app-style startup.

## Requirements

- Node.js 20 or newer is recommended.
- npm.
- Application packages, including the `@xyflow/react` canvas runtime, are declared in `package.json` and pinned by `package-lock.json`.
- At least one supported provider API key for remote generation.
- Fal is required for Fal-hosted models and utilities.
- Google, Krea, and OpenAI keys are optional and can be enabled independently.

The Windows and macOS launchers check these npm dependencies before startup and automatically install anything missing or changed after a pull. See [NewtNode Dependencies](docs/dependencies.md) for the maintained runtime list and bootstrap behavior.

## Setup

Configure provider credentials inside **Settings > API Credentials**. Each service can keep multiple named keys, but only one key (or `None`) can be active at a time. Saving validates the keys and writes the active Fal, Google, Krea, and OpenAI values into the local gitignored `.env` file automatically. Disabled keys remain saved as commented `.env` entries and are restored into Settings without being activated.

Models available through multiple services use the separate **Model Providers** setting. Seedance 2.0 and Seedance 2.5 can be routed through Fal or Krea, while Google video/Veo and Nano Banana Pro image generation can be routed through Google or Fal without changing which credentials are saved.

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
