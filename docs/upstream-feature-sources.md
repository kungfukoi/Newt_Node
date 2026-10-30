# Upstream feature sources

The user requested that these repositories be remembered as sources to evaluate and selectively port features from. Deadmeat is James Fisher (`jamesmfisher1979-source`). The GitHub spelling of Sugarmilks's account is `SugerMilks`.

| Person | Repository | Purpose | Local checkout / tracking |
| --- | --- | --- | --- |
| Sugarmilks / Steven | https://github.com/SugerMilks/NewtNode | NewtNode feature source | `sugarmilks` remote in our Newt_Node checkout |
| Deadmeat / James Fisher | https://github.com/jamesmfisher1979-source/NewtNode | NewtNode features; read `JAMES_CHANGES.md` | Our adapted port is documented in `james-integration.md` |
| Deadmeat / James Fisher | https://github.com/jamesmfisher1979-source/newtLauncher | Separate multi-copy desktop launcher | Installed at `C:\dev\newtLauncher`; `origin` points to James's repository |

Our application is `kungfukoi/Newt_Node`, normally at `C:\dev\Newt_Node`. Keep application ports and the separate launcher distinct. James's launcher is configured to manage our existing checkout as Jeff's copy, using a private Python environment and a desktop shortcut.

## Review checkpoints — October 26, 2026

- James's NewtNode `ba55fdbf4de3aa4b5b239a12fcbf3bf8de827ce1`: all 11 in-app additions adapted locally in `f8d1584` / `4.22.0-beta.0`. Includes stronger workspace saving and cancellation behavior. His original notes remain in `JAMES_CHANGES.md`.
- James's launcher `47881c6`: installed and Start verified with our NewtNode. Local Windows batch wrapper prefers `utility/.venv`; local settings, dependencies and logs are ignored. No launcher push was requested.
- Sugarmilks `main` is `927d07f7df5cad6573fe5b3b4b1301713f624e10`, dated October 14, 2026. Atlas Seedance draft finishing and Krea preview-only drafts already exist here in adapted commit `bbf6662` (October 14). Our selected-draft helper additionally rejects `completionSupported: false`.
- The preceding Sugarmilks commit `87e3302b87d688fa193b50c0d48d22eac70f5ea0` (October 12) covers Seedance drafts/editing, Explore look controls, Nano Banana 2.1 and ElevenLabs v4. Local implementations include `52265b1` (Seedance), `27e92ef` (Explore), `5a64250`/`c3c8e3e` (Nano Banana 2.1), and `0a350b6` (ElevenLabs v4).
- Sugarmilks's other branches are older: `codex/newtnode-character-workflow-checkpoint` ends at `3533e3c` (May 28), and `codex/reapply-sugermilks-features` at `4ef9428` (June 9). Neither contains more recent development than `main` at this review.

## Future reviews

Fetch/read current branches and documentation, then compare actual feature behavior with local source and tests. Different commit hashes do not establish that a feature is missing: these repositories have diverged and features are often adapted rather than merged wholesale. Preserve our workflow compatibility, provider routing, durable jobs and Windows/macOS behavior. Record the source SHA and any meaningful adaptations when a feature is adopted.

This list is a durable reference. It does not request automatic merging, publication, messages to the authors, or scheduled monitoring. Obtain fresh user direction for those actions.

## Approved selective integration — October 29, 2026

Source: SugerMilks/NewtNode `72c77e39ea317e174146b10047bcece67c0dbe00`. Approved: multiple canvases; Vector; ReFrame (Auto Refine default off); authored Storyboard shots; PDF script import; camera personality; Explore art direction (retain Style input); menu improvements (retain Image/Video pages); Timeline navigation. Skip Watch Me learning. Commit each feature after validation.

- Explore art direction: adapted in 4.34.0-beta.0, preserving local references and provider behavior.

Authored Shot List planning (4.38): new boards start with one row; each authored row becomes exactly one frame with preserved IDs, order and explicit camera choices. Plan Shots retains media/versions and marks row provenance. Editing descriptions requires planning before generation; presets retain authored rows while clearing stale media. Existing summary/Director boards retain their approach. Source: SugerMilks 72c77e3.

PDF Script Import (4.39, SugerMilks 72c77e3): managed PDFs are parsed in a bounded PDF.js worker. Explicit import performs billed script discovery/transcription and drafts authored shots with source pages, dialogue, VO and timing. Alternatives require selection; existing/protected shots are retained. No image generation or automatic paid retry. Limits: 40 MB, 200 document pages, 50 selected script pages, with extra confirmation over 30.

ReFrame (4.40, adapted from SugerMilks 72c77e3): manual H3 camera-pass node with Orbit/Travel, local full-resolution frame capture, optional Refine/Topaz/lens versions and image outputs. Auto Refine defaults OFF; capturing alone adds no paid edit. Durable pass/upscale receipts recover by lookup; copies clear jobs; uncertain image edits are never replayed. Diagram positions and lens interpretations are approximate.

Vector (4.41, SugerMilks 72c77e3): manual Fal SVG generation/vectorization with PNG outputs, passive SVG validation, durable receipts, artwork layers/transforms/grouping/color/text, local font/layout references and saved looks. Our existing Output accepts SVG/alpha for Vector companions; PNG remains the default. Scumble boxes_tool.js and inpaint_layered.js were inspected: retain image-space geometry, explicit selection and one-step edits; this port remains an SVG artwork editor rather than Scumble raster/PSD editing.

Menu refinements (4.42): adapt upstream keyboard/focus behavior in our existing CanvasMenuBar. ArrowDown opens the first item, ArrowUp the last; leaving project controls closes the menu; Escape restores focus. Existing project-name/preset controls and Image/Video workspace pages remain.

Timeline navigation (4.43): retain our existing playhead-anchored zoom; add Fit Timeline with track-gutter allowance and a persistent keyboard-operable horizontal range synchronized to scroll/resize. Extra visible tail permits stable zoom anchoring. View changes do not edit clips or media. Adapted behavior from SugerMilks editorViewport into our Assembly owner.

Project Canvases (4.44, SugerMilks 72c77e3): flat version-2 graph with per-node/group canvasId, named/reorderable tabs, independent viewports/session undo, copy/move/duplicate/import, and shared Project or Canvas assets. All canvases save/autosave together; legacy documents migrate to Canvas 1. Server reads/package writes preserve metadata and older writes cannot overwrite version 2. Jobs retain project ownership while switching pauses visible media. Delete/transfer confirmations preserve files; busy/last canvases cannot be deleted. Watch Me remains excluded.
