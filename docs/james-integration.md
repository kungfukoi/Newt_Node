# James Fisher feature integration

Adapted from `jamesmfisher1979-source/NewtNode` commit `ba55fdbf4de3aa4b5b239a12fcbf3bf8de827ce1` (October 25, 2026). `JAMES_CHANGES.md` retains his original notes; this document describes our integration.

- CorridorKey: separate Install and Run, readiness badge, progress/elapsed time, Cancel keying, live output and `server/data/corridorkey/last-keyer-run.log`. Stage-weighted percentages are explicitly estimates; displayed window/stage messages come from the engine. Installation cannot be cancelled. New nodes use balanced 8-frame windows; saved Auto/low settings are preserved. macOS still reports that CUDA keying is unavailable without downloading packages.
- Canvas: eased cursor-anchored wheel zoom, inertial background drag, trackpad pan and Shift+wheel horizontal pan. Pointer-down settles the viewport before node dragging. Canvas options beside zoom expose wheel behavior, smooth motion and hover scrub preferences. Reduced-motion disables easing/glide.
- Connections: clicking a wire highlights it cyan; Delete/Backspace removes the selected wire through the existing editor handler.
- Preview: paused videos with controls inside node cards can scrub on hover. Playing clips, touch gestures, button-held gestures and player controls are excluded. Timeline editors retain their transport ownership.
- Reload: the bottom-right button detects a changed built main script every eight seconds and saves recovery before reload. It does not fetch or install repository updates.
- Workspace: the active tab, node palette, output panel and full draft recover after reopening. Existing window drafts take precedence. Server recovery retains up to 20 independent window slots and ignores stale revisions; atomic writes use the existing JSON store. Browser backups cover interrupted close requests; visible save failures offer retry. Use normal Save/Save As for durable, portable projects.

Rebuild the client and restart the backend after active work finishes to activate the new routes. A reload alone does not install server changes. No dependency versions change.

The separate Python launcher's Git/update/refresh controls described in section L of James's notes are outside this NewtNode port and were not copied. NewtNode's existing Windows/macOS launch and Settings update flows remain the owners of those operations.
