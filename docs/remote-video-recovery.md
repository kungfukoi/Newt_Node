# Seedance Generation Recovery

## User Behavior

Seedance 2.0 and 2.5 requests made through the node API now run as saved background jobs, for both Fal and Krea. No extra setting is required in the Video Model node.

- Each generation in a batch has its own job ID and lifecycle. A 20-minute elapsed time is a warning per job, including queue time, not a batch deadline or a failure.
- Queued or processing jobs remain pending. A responsive status endpoint does not prove that inference is advancing; the UI reports what the provider actually says, without claiming it can reliably detect an internal stall.
- Status/network failures retry with backoff. Delayed jobs poll less frequently. No new paid request is submitted to recover an accepted job.
- Completed clips appear individually, updating connected Preview nodes, the generation's Output target, and project history while other batch clips are still running.
- Restarting Newt resumes jobs with saved provider IDs. Reopening the original workflow restores pending state and applies new results once. Save As copies and unrelated workflows do not adopt those jobs.
- Changing or disabling the provider key pauses provider access until the original key is enabled and selected again. There is no silent provider or account fallback.
- Confirmed provider failure, cancellation, or input rejection fails that job. If submission might have succeeded but no provider ID reached Newt, it becomes **Needs attention: acceptance unknown** and stops holding the node in an endless running state. Check the provider before manually starting another generation; blindly retrying could incur a second charge.
- If downloading or saving fails, the generated result remains pending for local-save recovery. An expired download link triggers retrieval from the original provider job again.

This cannot guarantee provider completion, and it cannot retrospectively recover pre-update jobs that never entered the registry. Other model families and legacy synchronous callers keep their existing behavior. Composer callers of the node API receive the same recovered response while open, but automatic graph reconciliation after reopening currently targets Video Model nodes. Recovered results are still available in project output history.

### Resolve An Uncertain Submission

Expand the affected run's **Needs attention** row inside the Video Model node, open its Fal/Krea link, and confirm that you checked the original provider run. Then choose one of these actions:

- Attach the provider's original job ID. Newt validates it through the original provider/model endpoint and credential before resuming tracking. URLs and IDs already tracked by another run are rejected.
- Import the completed video downloaded from that run. Newt validates the local video, copies it to managed output storage, and completes normal result/history/catalog reconciliation. This does not submit to the provider.
- Dismiss local tracking. This retains the durable record but does not cancel a remote generation or refund its charge.

These are inline recovery controls, not a cross-project Jobs dashboard. Acknowledgement is required; Newt cannot independently prove that a manually chosen video or ID represents the intended take. Recovery controls are transient UI state and are not copied into workflow ownership.

## Ownership

| Module | Responsibility |
| --- | --- |
| `server/remote-video-jobs.js` | Durable registry, one worker per run, restart recovery, state transitions, retry scheduling, public job/progress views |
| `server/remote-job-store.js` | Per-job specifications/checkpoints and version-1 migration backup |
| `server/job-diagnostics.js` | Bounded, allowlisted state/error event trail |
| `server/seedance-job-provider.js` | Fal/Krea submission and status/result adapters, bounded HTTP calls, original-key fingerprint checks |
| `server/routes/remote-video-jobs.js` | Idempotent acceptance, concurrent preparation deduplication, job lookup/list routes |
| `server/index.js` | Existing Seedance validation/uploads/request construction, managed output reservation/download, metadata/cost/history finalization |
| `src/remoteVideoJobClient.js` | Wait for accepted jobs across local connection interruptions without creating new run IDs |
| `src/remoteVideoJobs.js` | Shared scope, model eligibility, terminal-state and result-deduplication helpers |
| `src/remoteVideoRecovery.js`, `src/useRemoteVideoRecovery.js` | Reconcile reopened Video Model results and still-connected Output targets without rebuilding the graph on every poll |
| `src/remoteVideoRequests.js` | Coalesced in-flight/recent status reads; scoped incremental list requests |
| `src/components/RemoteVideoAttention.jsx` | Confirmed inline attach/import/dismiss controls |

## Protocol And Storage

`POST /api/node/generate-video` retains the existing body and adds `durableGeneration: true` plus a stable `generationRunId` for Seedance callers. Normal reference validation and uploads happen before acceptance. A successful acceptance returns `202 { job }`; other model contracts and legacy synchronous callers are unchanged. Repeating the same run ID and body returns the existing job; changing the body with that ID returns 409.

`GET /api/remote-video-jobs/:runId` returns the job and its normal typed result after completion. `GET /api/remote-video-jobs?scope=...` lists jobs for an exact workflow scope (project ID, package ID and normalized package path). These read-only calls use the control API lane. `GET /api/generation-progress` merges durable progress with request-scoped progress, without exposing prompts, credentials, or provider payloads. Completed siblings remain in progress accounting while their batch has active jobs.

The registry manifest is `server/data/remote-video-jobs.json`, ignored by git. Version 2 stores immutable prepared specifications in `remote-video-jobs.json.d/<run-hash>.spec.json` and small mutable checkpoints in matching `.state.json` files. Specs include provider inputs, workflow/output context, and credential fingerprints (never the key). Checkpoints retain provider IDs, save targets, results, and the latest 32 redacted events. Treat the directory as private project data. Completed specifications remain retained but are no longer rewritten by polling. A version-1 store migrates with a `.legacy-backup`; corrupt data fails startup closed. Do not delete the registry or rows to clear a stuck render.

`GET /api/remote-video-jobs?scope=...&cursor=...` returns changed summaries, a new epoch/revision cursor, a reset flag, and a suggested 3-second active or 15-second idle polling interval. Restart invalidates old cursors safely. Individual status requests share in-flight and brief recent snapshots. `POST /api/remote-video-jobs/:runId/recover` requires exact scope, acknowledgement, and an idle uncertain run; actions are `attach`, `import`, and `dismiss`. This POST is never blindly retried.

State sequence: `accepted -> submitting -> queued/running -> downloading -> completed`. Confirmed failures become `failed`. Temporary polling, credential, or persistence problems become `recovering`. A submission without a safely recorded ID becomes `uncertain`; it is not automatically submitted again, including after restart. Explicit dismissal becomes terminal `dismissed` for local tracking only. Uncertain jobs are attention-required, not terminal provider results or active generation progress.

Persist `submitting` before the paid POST and the returned provider ID immediately afterward. The unavoidable crash window between provider acceptance and saving its ID must remain uncertain, not become a retry. Provider POSTs deliberately avoid SDK automatic retries. New model adapters must honor this contract.

Polls normally run every 3 seconds, slow to 15 seconds after 20 minutes, and back off up to 60 seconds after errors. Provider HTTP requests have a 60-second connection/request bound; media downloads have a 5-minute bound per attempt. Neither bound cancels the provider job. Resumed local saves reuse the reserved path and checkpoint; history/Stats deduplicate by generation run ID. The registry assumes one Newt backend process owns this data directory.

Unchanged successful heartbeats update memory but persist at most once per 30 seconds. State transitions, acceptance IDs, errors, and download/finalization checkpoints still flush immediately. Fal and Krea each admit two active durable submissions by default, configurable with `NEWTNODE_FAL_VIDEO_CONCURRENCY` and `NEWTNODE_KREA_VIDEO_CONCURRENCY`. Waiting for an admission slot is not provider failure. Existing accepted jobs continue to be tracked even if a limit is subsequently reduced.

## Verification

Run `npm test`, `npm run build`, `npm run test:browser`, `npm run smoke:isolated`, and `node --check server/index.js`. Targeted tests cover independent long-running batches, restart/migration, duplicate acceptance/ID attachment, original credentials, ambiguous submissions, recovery actions, provider terminal errors, expired links, save checkpoints, delta cursors, and client/result reconciliation. The isolated real API test imports a synthetic uncertain run into managed output/history/catalog. Tests use fake providers and temporary stores, not paid generations or production history.

For a live check, start a small authorized Seedance batch, confirm each result appears separately, and reload the workflow while another job is pending. Restart the backend only after its provider IDs are recorded. Verify that IDs remain unchanged, one history/cost record exists per completed generation, and Preview/Output use local media. Native macOS runtime checks still require a Mac; no Windows-specific APIs are used by the recovery modules.
