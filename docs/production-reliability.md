# Production Reliability

Implemented 2026-09-04 for NewtNode `3.0.0-beta.0`, based on the production/performance audit. Scope is Priority Findings and Efficiency/Engineering Improvements only. No Jobs dashboard, node search, take manager, Post node, or other proposed creative features were added.

Read `node-standards.md` first when extending the application. This document explains the operational consequences and verification of this pass.

## What Changed

### History And Project Outputs

History reads no longer delete history/index files after an exception. The history store retries transient reads, preserves a last-good backup, quarantines corrupt JSON when a valid backup can be restored, and refuses unsafe writes when recovery is unavailable. Settings reports recovery. Atomic writes flush a same-directory temporary file and rename it; failed renames do not fall back to overwriting a live file.

The 500-entry recent-history cache is no longer the project's permanent generation record. A separate project catalog records local outputs before recent history is trimmed. Deleting a source node or generating in another project does not evict those catalog records. The rail reports a total, loads older pages, and merges new results without resetting older loaded items. Video entries use cached posters rather than passive video decoders. Single-column, proportional, uncropped previews and original-media drag/open behavior remain unchanged.

Catalog metadata is mirrored into packaged workflows. Save As copies/remaps catalog assets, including outputs whose generating nodes were deleted. Package relocation can repopulate the catalog on a new installation. Existing retained history seeds the catalog; media whose history had already been evicted before this update cannot be fully reconstructed automatically.

### Generation Recovery

Seedance 2.0/2.5 through Fal and Krea retain per-generation accepted-job tracking, original credential binding, independent batch completion, and a 20-minute warning rather than timeout. Unknown acceptance now releases the foreground wait and displays Needs attention. Inline controls let the user verify/attach the original provider job ID, import its completed local video, or dismiss local tracking. None of those actions submits a new paid generation. Dismissal is not cancellation or a refund.

Request specifications and mutable checkpoints are separate files. Migration retains a legacy backup. Unchanged heartbeats persist at most every 30 seconds; acceptance, transitions, errors, and download/finalization checkpoints persist immediately. Scoped delta polling and coalesced status reads avoid repeated full-store responses. The latest 32 redacted events per run preserve state/error causes without exporting private payloads. See `remote-video-recovery.md` for the exact protocol and limits.

### Runtime And Work Admission

Windows and macOS production launchers now share the API/client supervisor. It uses per-service PID ownership, rotating logs, exit reasons, bounded restart backoff, and explicit restart-marker handling. Production source edits do not trigger watched restarts. Settings Diagnostics reports supervision and restart count. Existing watch-mode sessions need a normal relaunch after active work settles; this change does not forcibly replace them.

Selected-node execution retains dependency ordering with configurable global/provider/local-resource limits. Durable Seedance admission is also bounded server-side across batches. The main server's FFmpeg wrapper has a separate budget. Existing image-generation and media-persistence limits remain intact. These are resource limits, not timeouts and not permission to change the selected provider. Client `VITE_` values require rebuild; server values require restart. Defaults and names are in `.env.example` and `development.md`.

### Canvas And Media

Dirty-state detection reuses unchanged immutable document fragments and still recognizes undo-to-saved content. Connection topology is reused until node IDs/edges change, while source data continues to reach connected viewers. Handle measurements respond to geometry/port changes instead of unrelated progress updates. Full-detail nodes remain mounted at 5%-250%; no proxy mode, map mode, or canvas culling was introduced.

Regression testing exposed two additional existing timing problems in the touched UI paths: Timeline render-time ref callbacks could cancel decoded frame callbacks, and immediate copy after multi-selection could read the previous frame's selection. Stable Timeline media refs and live React Flow selection reads fix those paths. Preview nodes remain passive viewers and their implementation was not rewritten.

### Diagnostics And Engineering

Settings > Diagnostics optionally collects ten minutes of event-loop delay, browser long tasks, media decode/drop counts, failed loads, work counts, and redacted job events. Export downloads a local JSON support snapshot with version/commit/runtime metadata. Raw logs, credentials, prompts, signed URLs, and workflow assets are not included. Collection is off by default and expires automatically.

History, project catalogs, job persistence, work scheduling, geometry observation, recovery UI, and diagnostics now have focused owners instead of more inline logic in the largest files. The existing React Flow/provider/node architecture remains. Compatible lockfile updates were included; application runtime dependency ranges did not change.

## Verification

- Node failure-injection and regression suite: 547 tests passed, covering history access/corruption/concurrency/backup restoration, atomic writes, catalog pagination/restart/relocation, job migration/recovery/identity, provider budgets, and graph/workflow compatibility.
- Supervisor process test: an isolated child crashes twice, restarts with increasing backoff, rejects a duplicate owner, and responds to an explicit restart. It never starts or stops the user's app.
- Production build and JavaScript/PowerShell syntax checks passed. The macOS launcher is LF-normalized and passes Bash syntax checking; native macOS launch/dialog/GPU testing was not available on this Windows host.
- Chromium production-client suite: 12 tests passed, covering 271 nodes at 5/8/15/30/100%, actual pan/zoom and wire attachment, text/resize/marquee/selection/paste, rail pagination/aspect ratios, real decoded Timeline pixels, mocked generation propagation, Save As/reload, recovery UI, and diagnostics. The immediate multi-select/copy timing regression also passed five consecutive runs.
- Isolated real API smoke passed startup, project catalog/posters, diagnostics, Save As, reopen, clone catalog, and manual uncertain-result import. Temporary source/data and generated media were used; no keys, real workflows, or provider submissions.
- Fixed 271/600-node serialization budgets passed. Warm cached medians were 0.255/0.547 ms versus 5.429/10.927 ms for full cloning on the same fixtures. These are serialization measurements, not an FPS claim; see `performance.md`.
- Windows/macOS GitHub Actions validation is configured. Remote CI has not run as part of this local uncommitted pass.
- Live Windows API/client startup and HTTP smoke passed at `http://127.0.0.1:5176/`. The version-1 registry migrated with all 23 completed and one uncertain job IDs/states preserved, plus a retained legacy backup. No active accepted runs were present and no paid jobs were submitted. Diagnostics remained off, with supervision active and zero restarts at verification.

## Remaining Boundaries

The provider can remain queued or internally stalled despite a healthy status endpoint. Newt keeps tracking the accepted job and reports uncertainty honestly; it cannot guarantee remote success. Other model families retain their existing recovery contracts. Completed job specifications remain retained on disk; this pass does not introduce SQLite, automatic pruning, or a new cross-project job browser.

The catalog pages the rail but does not virtualize it; browsing thousands of loaded entries still accumulates lightweight DOM. Native platform dialogs, hardware-specific flicker/frame pacing, real provider completion, and resource tuning should be checked on the intended workstation. None of the excluded feature suggestions is required to use these improvements.
