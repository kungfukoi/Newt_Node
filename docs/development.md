# Developing NewtNode

This is the practical build and verification guide for agents and developers. Read `node-standards.md` before implementing a feature and use `architecture.md` to find its current owner.

## Prerequisites

- Node.js 22.12 or newer on the 22 LTS line is recommended (CI uses Node 22). The current Vite toolchain requires Node `^20.19.0 || >=22.12.0`.
- npm from the same Node installation.
- Network access when npm dependencies or remote providers are needed.
- A local ComfyUI installation only for Comfy-backed Utility features.
- An optional SGLang MiniMax H3 service for the Local H3 provider; see `minimaxH3-local.md`.

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
| `npm run server:start` | Run the supervised production API without source watch. |
| `npm test` | Run the Node test suite. |
| `npm run test:performance` | Check dirty-fingerprint correctness and relative timing budgets on fixed 271/600-node fixtures. |
| `npm run test:browser` | Exercise the built client with Playwright, generated media, and mocked APIs. Run build first. |
| `npm run build` | Build the production client. |
| `npm run bundle:report` | Report initial and lazy asset sizes after a build. |
| `npm run preview` | Serve the production build locally. |
| `npm run smoke:app` | Verify client assets and API health on a running app. |
| `npm run smoke:isolated` | Start a temporary real API and verify catalog, posters, diagnostics, recovery import, Save As, and reopen without user data/provider calls. |

Use `npm.cmd` instead of `npm` in PowerShell only when the machine's script-execution policy blocks `npm.ps1`.

### Browser And Platform Checks

Install the test browser once after `npm ci` or `deps:ensure`:

```bash
npx playwright install chromium
npm run build
npm run test:browser
npm run test:performance
npm run smoke:isolated
```

Playwright uses its own production preview server on port 5286 (`NEWTNODE_E2E_PORT` overrides it) and refuses to reuse an existing listener. All application APIs are mocked; external requests are blocked. Generated test-pattern PNG/MP4 fixtures live in ignored `e2e/.generated/`. Failure screenshots/traces are under ignored `test-results/` and `playwright-report/`.

`.github/workflows/validation.yml` runs Node tests, performance budget, build, isolated API smoke, and Chromium tests on Windows and macOS. CI configuration is not evidence that a native Mac check passed locally. Native folder dialogs, launch-from-Finder behavior, GPU drivers, and paid provider completion need separate authorized checks.

### Production Runtime

Use the normal Windows/macOS launchers for user sessions. Both start the API and built client through `localServerSupervisor.mjs`; `--client` selects the client service. Logs are `.newtnode_logs/server-<port>.log` and `client-<port>.log`, rotating at 2 MiB with four backups. Service locks prevent duplicate supervisors in the same checkout/port. Crashes back off from one to thirty seconds; the restart marker requests a prompt restart. `Restart_NewtNode.ps1` uses the local restart endpoint rather than killing arbitrary port owners.

`npm run dev` and `npm run server` are explicitly watched development sessions. Existing sessions are not converted in place: close/relaunch a legacy watch session after generation has settled to adopt the production supervisor. Settings > Diagnostics reports current supervision/restart status. Do not restart a user's active generation just to test launch behavior; the supervisor regression uses a temporary fixture process.

### Work Budgets

`.env.example` documents conservative defaults: selected-node global concurrency 4, provider concurrency 2, local GPU concurrency 1, and local media concurrency 2. `VITE_NEWTNODE_*_CONCURRENCY` values are build-time client settings, requiring a rebuild. `NEWTNODE_FAL_VIDEO_CONCURRENCY` and `NEWTNODE_KREA_VIDEO_CONCURRENCY` govern durable Seedance admission; `NEWTNODE_FFMPEG_CONCURRENCY` bounds the main server's FFmpeg work. These server values require restart. Existing image-generation/media-persistence limits remain in place. Do not raise GPU admission without measuring memory headroom.

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

Prefer `npm run smoke:isolated` for automated route/persistence tests. It copies source into a checked temporary root, links installed dependencies, uses generated media and empty credentials, and cleans up only its own process/files. It does not load the user's runtime settings, history, or workflows.

### Startup, Settings, Persistence, Or API Changes

Run the app and then:

```bash
npm run smoke:app
```

Exercise the affected UI path, not only the route. For Settings/update/restart work, verify both the main and control lanes and preserve local runtime data.

### Canvas, Node UI, Or Geometry Changes

Use a production-scale workflow. Verify:

- 5%, 8%, 15%, 30%, and 100% zoom;
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
- Seedance runs longer than 20 minutes or loses its connection: inspect the job through `/api/remote-video-jobs/:runId` and [Seedance Generation Recovery](remote-video-recovery.md). Do not delete the ignored registry or submit a replacement merely because polling failed. Re-enable/select the original provider key if recovery is waiting for credentials.
- Comfy workflow fails: check `/api/comfy-wan/status`, Comfy reachability, required nodes/models, template output node ids, prompt history, and timeout diagnostics.
- Local MiniMax H3 fails: check `/api/minimax-h3-local/status`, confirm SGLang is listening on the configured loopback port, select `576P`, and verify host/engine media-root mapping when SGLang runs in WSL or a container. The local path intentionally uses 20 inference steps to stay within the supported 24 GB GPU profile.
- Large graph is sluggish: profile graph state updates, node remounts, edge recalculation, media decode, and React rendering separately before adding proxy/culling behavior.

## Git Hygiene

- Work with the current dirty tree; never discard unrelated changes.
- Keep generated files and local runtime data out of commits.
- Do not rewrite history or use destructive reset/checkout operations unless explicitly authorized.
- Do not commit, merge, pull, push, or switch branches unless the user asks.
- When asked to publish, verify the exact branch, upstream, remote URL, clean status, and pushed commit.
