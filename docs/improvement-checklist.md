# Production Improvement Checklist

Scope: the 2026-09-04 audit's Priority Findings and Efficiency and Engineering Improvements. The missing-feature proposals are excluded. Preserve all existing node/workflow behavior and Windows/macOS compatibility. No commit or push was requested.

## Implementation

- [x] P1: preserve history after read/parse failures; recoverable backups and atomic writes. Failure-injection tests pass.
- [x] P2: uncertain submissions release the foreground wait; inline confirmed attach/import/dismiss controls preserve recovery identity and prevent automatic paid resubmission. Diagnostic causes and duplicate-ID checks are tested.
- [x] P3: permanent project output records, paginated rail, package metadata, and Save As/relocation support. Tests cover 1,000+ outputs, other-project activity, deleted source nodes, refresh, and restart.
- [x] P4: shared supervised production launch, rotating logs, bounded backoff, restart status, ownership lock, Windows/macOS launcher integration. Isolated process lifecycle and shell syntax tests pass; native Mac execution awaits a Mac/CI.
- [x] P5: incremental dirty detection, topology reuse, narrower geometry invalidation, and live copy/delete selection. Undo/result propagation and fixed 271/600-node budgets pass.
- [x] P6: per-job persistence/coalesced heartbeat updates and coordinated incremental polling. Migration/recovery/delta tests pass.
- [x] E1: deterministic generated-media browser fixtures, performance budgets, and Windows/macOS CI configuration. All 12 browser tests pass.
- [x] E2: configurable selected-node/provider admission, durable Seedance server admission, and separate GPU/FFmpeg budgets; existing limits retained.
- [x] E3: cached video posters and incremental rail pages; proportional single column, no canvas culling.
- [x] E4: focused history, project catalog/package, job store/events, scheduling, geometry, recovery, and diagnostics owners.
- [x] E5: opt-in expiring diagnostics and allowlisted local support export, no Jobs dashboard or new creative tools.

## Verification

- [x] Focused failure-injection, compatibility, concurrency, and performance tests.
- [x] Full Node suite: 547 passed; production build passed; 52 JavaScript modules and PowerShell/Bash launchers syntax-checked; final diff reviewed.
- [x] Browser checks: 12 passed, including 271 nodes, 5/8/15/30/100% zoom, real pan, resize, text selection, marquee, paste, wires, media containment, result propagation, Timeline, save/reopen, recovery, and diagnostics.
- [x] Isolated API/client smoke and platform-sensitive launcher checks. Real local media/recovery/package flows passed without provider calls.
- [x] Standards, architecture, development, dependencies, recovery, README, and performance documentation updated; production reliability guide added.

## Status

Complete on `main`, uncommitted and unpushed. Baseline was clean `6c2c1a0` with 513 tests. Runtime dependency audit reports zero vulnerabilities. Automated verification used generated fixtures, alternate ports, and temporary copies without paid-provider calls. The final live Windows API/client smoke passed after supervised startup; registry migration retained its legacy backup and all 24 original job IDs/states (23 completed, one uncertain). Native macOS checks and remote CI have not run locally. Missing-feature proposals remain excluded. See `production-reliability.md` for operational boundaries.
