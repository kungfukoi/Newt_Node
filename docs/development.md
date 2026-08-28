# Developing NewtNode

This is the practical build and verification guide for agents and developers. Read `node-standards.md` before implementing a feature and use `architecture.md` to find its current owner.

## Prerequisites

- Node.js 20 or newer.
- npm from the same Node installation.
- Network access when npm dependencies or remote providers are needed.
- A local ComfyUI installation only for Comfy-backed Utility features.

FFmpeg and FFprobe are supplied by `ffmpeg-static` and `ffprobe-static`. Use `FFMPEG_PATH` and `FFPROBE_PATH` only when testing a deliberate system-binary override.

## First Run

From the repository root:

```bash
npm run deps:ensure
npm run dev
```

The normal development URLs are:

- client: `http://127.0.0.1:5176`
- API health: `http://127.0.0.1:3336/api/health`
- control API: `http://127.0.0.1:3337`

Windows users can launch through `Launch_NewtNode.bat` or `Launch_NewtNode.ps1`. macOS users can launch through `NewtNode.command`, `Versus_NewtNode.command`, or the app bundle when installed.

Provider credentials should be entered and selected in Settings. Do not put real credentials in `.env.example`, tests, screenshots, logs, or documentation.

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run deps:ensure` | Install/update dependencies when the lockfile requires it. |
| `npm run dev` | Run watched Express server and Vite client together. |
| `npm run client` | Run only Vite. |
| `npm run server` | Run only the watched local API. |
| `npm test` | Run the Node test suite. |
| `npm run build` | Build the production client. |
| `npm run bundle:report` | Report initial and lazy asset sizes after a build. |
| `npm run preview` | Serve the production build locally. |
| `npm run smoke:app` | Verify client assets and API health on a running app. |

Use `npm.cmd` instead of `npm` in PowerShell only when the machine's script-execution policy blocks `npm.ps1`.

## Feature Implementation Loop

### 1. Establish The Baseline

- Run `git status --short --branch`.
- Preserve unrelated local changes.
- Reproduce the behavior and capture the exact node type, port, model, provider, workflow-package state, and platform.
- Read the relevant standards and existing tests before editing.

### 2. Audit The Complete Surface

Use the impact matrix in `node-standards.md`. A node feature can require catalog, defaults, normalization, ports, edges, auto-connect, run scheduling, request builders, server routes, results, previews, Output, history, Stats, progress, persistence, package assets, clipboard/import, CSS, and tests.

Search by internal type, persisted field, port id, API route, and model label. Visible UI text alone is not a reliable implementation key.

### 3. Choose The Existing Owner

- Put browser route calls in `src/api/newtApi.js`.
- Put callable labels/options in `src/modelOptions.js`.
- Put Edit definitions in `src/editEffects.js`.
- Put reusable result logic in `src/mediaResults.js`.
- Put drag/drop and file-to-node behavior in `src/mediaAssets.js`.
- Put pure graph, geometry, references, Output, workflow, or Timeline logic in the focused existing module.
- Put node-specific request/result builders in `src/nodeRunners/`.
- Put reusable UI in `src/components/`.
- Put low-coupling route groups in `server/routes/` and local engines in focused `server/<engine>/` folders.

`NodeEditor.jsx` may coordinate these owners. It should not duplicate them.

### 4. Design Compatibility First

Before renaming or removing anything persisted, decide how old workflows normalize. Preserve stable ids and internal identifiers where possible. Add a migration when ports, fields, labels, result shapes, or asset URLs must change.

Test both an old representative workflow and a newly saved workflow. Include Save As or package relocation when asset identity is involved.

### 5. Implement Complete States

Handle normal, loading, empty, disabled, success, partial-success, validation error, provider failure, missing asset, and reopen states as relevant. Do not add an enabled-looking output port or action that only works after an undocumented first run.

Provider-backed work also needs explicit selected-provider errors, progress, managed local result persistence, history metadata, and Stats/cost behavior.

### 6. Verify At The Right Scope

Run focused tests while iterating, then use the validation tiers below. Fix the implementation instead of weakening a test that protects a documented contract.

### 7. Update Documentation

Update the same change when it alters:

- durable behavior or UX rules: `node-standards.md`;
- architecture, ownership, ports, or data flow: `architecture.md`;
- setup, scripts, or checks: `development.md`, `dependencies.md`, or `.env.example`;
- model catalogs or user-visible capability: `README.md` and standards;
- bundle/loading behavior: `performance.md`;
- Comfy requirements: `comfyWan-requirements.yaml` and template manifests.

## Validation Tiers

### Every Change

```bash
git diff --check
npm test
npm run build
```

Also inspect `git diff` and `git status --short --branch` before reporting completion.

### Server Or Route Changes

Run syntax checks on every touched server file, for example:

```bash
node --check server/index.js
node --check server/routes/core.js
```

Start the app and verify `/api/health`. Add or update a health-route capability flag and the smoke harness when the route is part of normal startup.

### Startup, Settings, Persistence, Or API Changes

Run the app and then:

```bash
npm run smoke:app
```

Exercise the affected UI path, not only the route. For Settings/update/restart work, verify both the main and control lanes and preserve local runtime data.

### Canvas, Node UI, Or Geometry Changes

Use a production-scale workflow. Verify:

- 5%, 8%, 30%, and 100% zoom;
- repeated pan and wheel zoom across distant graph regions;
- marquee and modifier multi-selection;
- text selection/editing inside controls;
- node and textarea resizing during the gesture;
- handles and edges before, during, and after movement;
- full media visibility and aspect ratio at minimum and maximum sizes;
- save/reopen dimensions and viewport.

### Provider Or Model Changes

Verify request shape, selected-key behavior, provider-specific limits, no silent fallback, failure diagnostics, batch/partial success, managed local results, history, cost/Stats, progress, enabled-model Settings, and saved-workflow normalization.

### Workflow Or Asset Changes

Verify New, Save, Save As, Open, Import, Recent, autosave recovery, package relocation, old workflow migration, copied graph id remapping, missing assets, and Output/Preview propagation.

### Heavy UI Or Lazy-Load Changes

After the production build:

```bash
npm run bundle:report
```

Compare with `performance.md`. Do not move editor, Three.js, Stats, or Settings dependencies into the initial shell to hide a chunk warning.

### Platform-Sensitive Changes

Inspect and test equivalent Windows and macOS paths. This includes launch/restart/update, dialogs, Explorer/Finder actions, separators, executable discovery, permissions, hidden files, app-bundle metadata, and shell quoting.

## Testing Guidance

- Add focused tests for pure behavior and regressions.
- Prefer extracting a pure helper over testing a large UI component through implementation details.
- Expand to the full suite when shared graph, persistence, result, provider, geometry, or scheduling behavior changes.
- Keep tests deterministic. Do not require live paid-provider calls for normal `npm test`.
- Use representative fixtures without credentials, personal paths, or generated production media.

## Local Configuration

`.env.example` lists supported high-value overrides. Settings manages named Fal, Google, Krea, and OpenAI credentials and materializes the active choices into the ignored local `.env` file.

Operational local state under `server/data/`, output trees, uploads, workflow packages, build output, caches, and logs is not source. Never stage it merely to make a local test pass.

## Troubleshooting

- Black app after launch: check the launcher/server logs, then run `npm run build` and verify the client and `/api/health` separately.
- UI changed but route did not: restart `npm run dev`; watched process recovery does not make every long-lived runtime state safe to reuse.
- Preview shows a logo: inspect the persisted result URL, workflow package identity, and file existence before changing the visual fallback.
- Edge appears detached: check node/port ids, handle measurement, normalization, and React Flow internal updates; do not patch the line with screen coordinates.
- Provider says input is missing/invalid: inspect the server-side normalized request and local-to-provider upload path without logging credentials or full sensitive payloads.
- Comfy workflow fails: check `/api/comfy-wan/status`, Comfy reachability, required nodes/models, template output node ids, prompt history, and timeout diagnostics.
- Large graph is sluggish: profile graph state updates, node remounts, edge recalculation, media decode, and React rendering separately before adding proxy/culling behavior.

## Git Hygiene

- Work with the current dirty tree; never discard unrelated changes.
- Keep generated files and local runtime data out of commits.
- Do not rewrite history or use destructive reset/checkout operations unless explicitly authorized.
- Do not commit, merge, pull, push, or switch branches unless the user asks.
- When asked to publish, verify the exact branch, upstream, remote URL, clean status, and pushed commit.
