# James's changes to NewtNode

> Upstream notes retained for attribution. For the adapted kungfukoi/Newt_Node behavior and validation, see [our integration notes](docs/james-integration.md). Launcher section L describes separate code, not features shipped by this port.

Working copy: `JamesFisher_Deadmeat`, forked from the Jeffrey fork (`Newt_Node-main`, v4.21.0-beta.0, has the CorridorKey keyer).
Keep this file up to date: **add an entry (newest at the bottom) every time something changes**, so any change can be lifted back into Jeffrey's or Steven's copy.

How to port a change: the "Files" list is everything the change touches. New files can be copied as-is. For existing files, the "Edits" notes say what was added, and `git diff` / `git log -p -- <file>` in this folder shows the exact lines (committing each change separately makes this a one-line cherry-pick).

**Steven's copy (SugerMilks / v3.0.0-beta.0) has no CorridorKey keyer**, so changes 1-5 do not apply there. Changes 6-10 touch the shared canvas code and probably apply, but that has not been checked against his files.

## Index

| # | Date | Change | Area | Applies to Steven? |
|---|------|--------|------|--------------------|
| 1 | 2026-10-25 | Keyer: separate Install button + "Installed" badge; Run Keyer is its own button | Keyer | No keyer there |
| 2 | 2026-10-25 | Keyer: progress bars for install and keying | Keyer | No keyer there |
| 3 | 2026-10-25 | Keyer: Run button becomes Cancel while keying | Keyer | No keyer there |
| 4 | 2026-10-25 | Keyer: live engine output line + run log file | Keyer | No keyer there |
| 5 | 2026-10-25 | Keyer: GPU memory default is the 8-frame window | Keyer | No keyer there |
| 6 | 2026-10-25 | Canvas: eased zoom and inertial pan (photo-viewer feel), wheel zooms | Canvas | Probably |
| 7 | 2026-10-25 | Canvas: fix nodes jumping while dragging | Canvas | Probably (needs 6) |
| 8 | 2026-10-25 | Canvas: clicking a wire selects it (cyan glow), Delete removes it | Canvas | Check first |
| 9 | 2026-10-25 | App: bottom-right reload / "Update ready" button | App | Yes |
| 10 | 2026-10-25 | Canvas: hover over a paused clip to scrub it | Canvas | Yes |
| 11 | 2026-10-25 | App remembers how it was left: tab, node palette, outputs panel, open project (saved to `server/data/ui-state.json`) | App / server | Probably applies; check `useNodeEditorDraft.js` and `main.jsx` there |
| L | 2026-10-25 | Launcher (outside the repo): "Refresh tools" button and others | Tools | n/a |

---

## 1. Keyer: Install button, Installed badge, separate Run
**Why:** Install and Run shared one button ("Install & Run Keyer"). Install now has its own button, a badge shows whether the engine is installed, and Run Keyer only runs.
**What it does:** The engine row shows a badge (`✓ Installed`, `Not installed`, `Installing…`, `Unavailable`) and an **Install** button only when the engine is missing and can be installed. Run Keyer is disabled until the engine is installed. New server action `POST /api/keyer/install` downloads/verifies the engine without keying; its state is read through the existing status call.
**Files:**
- `server/keyer.js` - `service.install()`, `installError` kept in `status()`
- `server/routes/keyer.js` - `POST /api/keyer/install`
- `server/keyer-install.js` - not-installed message now says "Click Install"
- `src/api/newtApi.js` - `keyerApi.install`
- `src/components/KeyerNodeBody.jsx`, `src/components/keyer.css` - badge, Install button, Run gating
- `test/keyer.test.js` (3 tests), `e2e/keyer.spec.js` (replaced one test), `docs/keyer.md`
**Edits to existing files:** additions only; the old automatic install-on-run path in `service.start()` is left in place for API compatibility.

## 2. Keyer: progress bars (install and keying)
**Why:** Install and keying showed no sign of progress.
**What it does:** A bar with percent, elapsed time and (for install) "step N of 6" plus the latest installer output line. Install progress comes from `server/keyer-install.js` (`progress`, `step`, `steps`, `detail`, `startedAt` in the status response). Keying progress comes from the engine's "window i/N" lines (`keyerFraction()`), reported as `job.progress`. The PyTorch install step has no percentage of its own, so the bar holds while it runs.
**Files:**
- `server/keyer-install.js` - progress state, `watch()` helper feeding tool output into the bar
- `server/keyer.js` - `keyerFraction()`, `job.progress`, `job.startedAt`
- `src/nodeRunners/keyer.js` - passes `keyerPercent`, `keyerStartedAt` into node data
- `src/components/KeyerNodeBody.jsx` (`KeyerProgress` component), `src/components/keyer.css`
**Note:** the keying percentage is only as good as the engine's own output; with one big window there are no updates until it finishes (see 5).

## 3. Keyer: Cancel keying
**Why:** The Keyer got stuck with no way to stop it.
**What it does:** While a key is running the Run button turns into a red **Cancel keying** button. The server force-kills the engine process and its children (`taskkill /T /F` on Windows), marks the job `cancelled`, and frees the Keyer for the next run. `POST /api/keyer/cancel` accepts an optional `jobId`; without one it cancels whatever is active.
**Files:**
- `server/keyer.js` - `killProcessTree()`, `signal` option on `runKeyerProcess`, `service.cancel()`, job `controller`/`done`, job view hides the controller
- `server/routes/keyer.js` - `POST /api/keyer/cancel`
- `src/api/newtApi.js` - `keyerApi.cancel`
- `src/nodeRunners/keyer.js` - handles `state === "cancelled"`
- `src/components/KeyerNodeBody.jsx`, `src/components/keyer.css` - the button
- `test/keyer.test.js` (2 tests)
**Not covered:** a running install cannot be cancelled.

## 4. Keyer: live engine output line and run log
**Why:** A stalled run gave no clue what the engine was doing.
**What it does:** The newest line the engine prints is shown in small text under the progress bar. The full output of each run is written to `server/data/corridorkey/last-keyer-run.log` (overwritten each run), starting with the exact command line.
**Files:** `server/keyer.js` (`onOutput`, log stream), `src/nodeRunners/keyer.js` (`keyerDetail`), `src/components/KeyerNodeBody.jsx`.

## 5. Keyer: 8-frame window is the default
**Why:** With GPU memory on "Auto", a 50-frame 1920x1152 clip ran for many minutes on an RTX 4090 (24 GB): the engine picked an 80-frame block with an estimated 19.1 GB peak, which on Windows can spill out of dedicated GPU memory and crawl. The 8-frame window finished in under two minutes.
**What it does:** New Keyer nodes default to `balanced` (8-frame temporal window). The dropdown lists it first as "Recommended"; Auto is labelled "can be very slow on Windows". Existing saved nodes keep their stored value.
**Files:** `src/keyer.js` (default in `normalizeKeyerData`), `src/components/KeyerNodeBody.jsx` (option order and labels), `docs/keyer.md`.

## 6. Canvas: eased zoom and inertial pan
**Why:** The canvas moved instantly and the plain mouse wheel scrolled instead of zooming. The PhotoBinder viewer has a nicer feel (eased zoom, glide after a drag).
**What it does:** Wheel zooms toward the cursor (1.15x per notch), eased; drag on empty space pans and glides on release; trackpad scroll pans; Ctrl/Alt+wheel still zooms; Shift+wheel pans sideways; zoom buttons/shortcuts ease too. Tuning copied from PhotoBinder (`LayoutCanvasView`): pan ease 0.25, zoom ease 0.22, friction 0.90 per 16 ms frame. Set localStorage `newt.wheelBehavior` to `pan` to bring back wheel-scrolls-the-canvas.
**Files:**
- `src/canvasMotion.js` (new) - the motion engine, no dependencies
- `test/canvasMotion.test.js` (new, 5 tests)
- `src/NodeEditor.jsx` - edits: import; `viewportMotionRef`; `viewportMotion()` and `isMouseWheelNotch()` helpers placed just before `renderTransientViewport`; the end of `handleCanvasWheel` (zoom/pan through the motion engine); `zoomViewportAtCanvasCenter` uses it; the `type === "pan"` branches of `handlePointerMove`, `stopNodeDrag` and `beginCanvasPan` call `dragTo` / `release` / `begin`
**Known limit:** maximum zoom is still the app's 190%.

## 7. Canvas: nodes no longer jump while dragging
**Why:** With 6 in place, a node could shoot across the screen when dragged. The transient viewport (DOM transform) was still easing/gliding, and its delayed commit into React Flow shifted the drag mid-way.
**What it does:** Any pointer-down on the canvas stops glide/easing and commits the pending viewport first; the wheel is ignored while a mouse button is held.
**Files:** `src/NodeEditor.jsx` - `settleViewportForPointer()`, `onPointerDownCapture={settleViewportForPointer}` on the `.node-canvas` div, and `if (event.buttons) return;` near the end of `handleCanvasWheel`.
**Depends on:** 6.

## 8. Canvas: select a wire, see it glow, delete it
**Why:** Clicking a wire and pressing Delete did nothing. Edges are controlled by the editor (no `onEdgesChange`), so React Flow never marked a clicked edge as selected and the selection read-back found nothing.
**What it does:** `onEdgeClick` reports the clicked edge straight to the editor. A selected wire turns bright cyan (`#38e1ff`), thicker, with a glow; wires brighten on hover; Delete/Backspace removes the selected wire (existing key handler).
**Files:** `src/components/NewtFlowCanvas.jsx` (`onEdgeClick`), `src/components/NewtFlowCanvas.css` (selected/hover/inactive styles).
**Check before porting:** confirm the other copy really has no `onEdgesChange` on its `<ReactFlow>`.

## 9. App: bottom-right reload / "Update ready" button
**Why:** After a rebuild the open window kept running old code until reloaded.
**What it does:** A small fixed button at the bottom right reloads the window. Every 8 s it re-reads `/` and compares the hashed main script name; when the server serves a newer build the button turns yellow and says "Update ready - reload". It does nothing special on the dev server (no hashed bundle).
**Files:** `src/components/UpdateButton.jsx` (new), `src/components/updateButton.css` (new), `src/main.jsx` (import + `<UpdateButton />` beside the app in the root render).

## 10. Canvas: hover to scrub a paused clip, with a playhead line
**Why:** Quick preview of a clip without pressing play.
**What it does:** Moving the mouse across a paused video inside a node card (the video input node, the Keyer/Utility result pane, Preview) seeks to that point: left edge = start, right edge = end. A yellow vertical line follows the pointer over the clip with a "0:03.2 / 0:10.0" label. Off (and the line hidden) while the clip is playing, while a mouse button is held, and over the player's own control bar at the bottom, so the normal seek bar still works. Only players with controls are affected, so the trim and outpaint editors are untouched. The clip stays where you left it when the mouse leaves.
**How:** one `pointermove` listener on `document` in the *capture* phase (so nothing in the app can swallow the event first). It finds the video by looking through the node card for a player under the pointer, so an invisible layer on top does not matter.
**Files:** `src/videoHoverScrub.js` (new), `test/videoHoverScrub.test.js` (new, 3 tests), `src/main.jsx` (import + one `installVideoHoverScrub()` call before the root render). No component was edited.
**Checked:** in real Chromium against a test page (middle of the clip = 5.0 s, right edge = 9.75 s, left edge = 0.05 s, line shown, hidden over the control bar, no scrubbing while playing).
**Requires:** the server must answer HTTP Range requests for video files (Express static does); without that, browsers cannot seek and the clip will not move.

## 11. App: remember how the interface was left
**Why:** Every time the tool was opened it went back to the Image tab, the node palette was hidden and the project that had been open was gone.
**What it does:** The last tab (Image / Video / Nodes / Stats / Settings), whether the node palette and the outputs panel are open, and the whole open project (nodes, wires, groups, view position, project name and package/file paths) are saved to `server/data/ui-state.json`. On start the app loads that file before it draws anything. The canvas draft used to live only in the browser's per-window `sessionStorage`, which is why a closed window lost it; the file now backs it up. A plain reload keeps its own draft; a fresh window picks up the file.
**How:** `GET/PUT /api/ui-state` (writes are atomic, saved about 1.5 s after the last change and when the window is hidden). `src/uiState.js` holds the values (`uiGet`, `uiSet`, `uiMirrorDraft`, `loadUiState`); `main.jsx` waits for `loadUiState()` before `createRoot`.
**Files:** `server/ui-state.js` (new), `server/index.js` (1 import + 1 line `registerUiStateRoutes(app, { dataDir })` after `express.json`), `src/uiState.js` (new), `src/main.jsx` (workspaceMode initial value/save, root render waits for load), `src/useNodeEditorDraft.js` (mirrors each draft write), `src/NodeEditor.jsx` (palette and outputs panel initial value/save), `test/uiState.test.js`, `test/uiStateClient.test.js` (new, both pass).
**Needs:** server restart (new route) plus rebuild. Delete `server/data/ui-state.json` to reset to defaults.
**Not remembered:** window size/position, scroll positions in the Image/Video history, which node was selected.

---

## L. Launcher and helper scripts (outside the repo)
Live in `jamesTools\newt\` (not in any NewtNode copy):
- `newt_launcher.py`, `Newt_Launcher.bat`, `Newt_Launcher.command` - GUI to start, stop and switch between copies. **⟳ Refresh tools** (bottom right) rebuilds the interface if `src` changed (`npm run build`) and restarts the server through `scripts/requestRestart.mjs` only if server code changed, after asking; the app's Update-ready button (9) then loads the result.
- `Make_Working_Copy.bat/.ps1` - script for making an editable working copy of one of the other copies.
- In the Jeffrey and Steven copies (not part of this repo's changes): `Setup_And_Launch_NewtNode.bat/.command` and `Stop_NewtNode.bat/.ps1/.command`.
- **Update button on each copy's card** (added in `newt_launcher.py`): downloads the copy's GitHub branch as a zip, compares it with the folder, shows how many files change, backs up every file it replaces into `.newt_update_backup\\<timestamp>`, then writes the new/changed files. Never touched: `.env`, `outputs/`, `uploads/`, `saved_workflows/`, `server/data/`, `node_modules/`, `dist/`, `.git/`. Files that exist only locally are left alone (nothing is deleted). Greyed out for copies that have their own `.git` (like this one; use git there). The launcher knows the two upstream pages by folder name: `https://github.com/kungfukoi/Newt_Node` (Jeffrey) and `https://github.com/SugerMilks/NewtNode` (Steven); each card shows its link. Any other copy asks for an address once, and an address you type is kept in `newt_launcher_settings.json` and wins over the built-in ones. After an update, Start installs new packages and rebuilds automatically.
- **Git ▾ button on copies that have their own `.git`** (replaces the greyed-out Update there): *Commit changes…* (lists the changed files, asks for a one-line description, runs `git add -A` + `git commit`; asks for your name/email the first time; warns before committing anything that looks like a key or `.env`), *Commit and push to GitHub…*, *Push (already committed)*, *What changed in Jeff's / Steve's version?* (adds the `jeff` / `steve` remote if missing, fetches, and lists the commits you do not have plus a one-line size summary; never changes your files; merging stays a manual `git merge jeff/main` or `git cherry-pick`), *Set my name and email…*, *Set my GitHub address…* (sets `origin`). **Never pushes to Jeff's or Steve's repositories:** a push stops with a message if `origin` is one of their addresses, "Set my GitHub address" refuses their addresses, and the `jeff` / `steve` remotes the launcher adds have their push address disabled (fetch-only). Needs git on PATH. Tested against local throw-away repos (commit, push, fetch/compare), not against GitHub itself.
- Launcher pop-up dialogs (update confirmation, address prompt) use the dark theme; before, they had light text on a light background.
Data moved earlier: `saved_workflows/First-Test-Image.json` and `outputs/First-Test-Image/` were copied into the Jeffrey copy.

---

## Not done / open
- Shared working-files folder (outputs, uploads, saved workflows kept outside the code folders): deferred.
- Nano Banana 2.1 through Atlas: the app lists it as "not yet verified"; needs the Atlas model ID and parameters.
- Cancel for the Keyer install.
- Playwright (`e2e`) and the full `npm test` suite have not been run on these changes. Only the unit tests for the new Keyer server code and `canvasMotion` were run, in a sandbox.
