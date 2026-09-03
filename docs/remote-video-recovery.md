# Seedance Generation Recovery

## User Behavior

Seedance 2.0 and 2.5 requests made through the node API now run as saved background jobs, for both Fal and Krea. No extra setting is required in the Video Model node.

- Each generation in a batch has its own job ID and lifecycle. A 20-minute elapsed time is a warning per job, including queue time, not a batch deadline or a failure.
- Queued or processing jobs remain pending. A responsive status endpoint does not prove that inference is advancing; the UI reports what the provider actually says, without claiming it can reliably detect an internal stall.
- Status/network failures retry with backoff. Delayed jobs poll less frequently. No new paid request is submitted to recover an accepted job.
- Completed clips appear individually, updating connected Preview nodes, the generation's Output target, and project history while other batch clips are still running.
- Restarting Newt resumes jobs with saved provider IDs. Reopening the original workflow restores pending state and applies new results once. Save As copies and unrelated workflows do not adopt those jobs.
- Changing or disabling the provider key pauses provider access until the original key is enabled and selected again. There is no silent provider or account fallback.
- Confirmed provider failure, cancellation, or input rejection fails that job. If submission might have succeeded but no provider ID reached Newt, it remains **submission outcome unknown**. Check the provider before manually starting another generation; blindly retrying could incur a second charge.
- If downloading or saving fails, the generated result remains pending for local-save recovery. An expired download link triggers retrieval from the original provider job again.

This cannot guarantee provider completion, and it cannot retrospectively recover pre-update jobs that never entered the registry. Other model families and legacy synchronous callers keep their existing behavior. Composer callers of the node API receive the same recovered response while open, but automatic graph reconciliation after reopening currently targets Video Model nodes. Recovered results are still available in project output history.

## Ownership

| Module | Responsibility |
| --- | --- |
| `server/remote-video-jobs.js` | Durable registry, one worker per run, restart recovery, state transitions, retry scheduling, public job/progress views |
| `server/seedance-job-provider.js` | Fal/Krea submission and status/result adapters, bounded HTTP calls, original-key fingerprint checks |
| `server/routes/remote-video-jobs.js` | Idempotent acceptance, concurrent preparation deduplication, job lookup/list routes |
| `server/index.js` | Existing Seedance validation/uploads/request construction, managed output reservation/download, metadata/cost/history finalization |
| `src/remoteVideoJobClient.js` | Wait for accepted jobs across local connection interruptions without creating new run IDs |
| `src/remoteVideoJobs.js` | Shared scope, model eligibility, terminal-state and result-deduplication helpers |
| `src/remoteVideoRecovery.js`, `src/useRemoteVideoRecovery.js` | Reconcile reopened Video Model results and still-connected Output targets without rebuilding the graph on every poll |

## Protocol And Storage

`POST /api/node/generate-video` retains the existing body and adds `durableGeneration: true` plus a stable `generationRunId` for Seedance callers. Normal reference validation and uploads happen before acceptance. A successful acceptance returns `202 { job }`; other model contracts and legacy synchronous callers are unchanged. Repeating the same run ID and body returns the existing job; changing the body with that ID returns 409.

`GET /api/remote-video-jobs/:runId` returns the job and its normal typed result after completion. `GET /api/remote-video-jobs?scope=...` lists jobs for an exact workflow scope (project ID, package ID and normalized package path). These read-only calls use the control API lane. `GET /api/generation-progress` merges durable progress with request-scoped progress, without exposing prompts, credentials, or provider payloads. Completed siblings remain in progress accounting while their batch has active jobs.

The versioned registry is `server/data/remote-video-jobs.json`, ignored by git. It includes prepared provider inputs, workflow/output context, provider ID, credential fingerprint (never the key), download checkpoint, and final result. Treat it as private project data. Do not delete it to clear a stuck render: that discards recovery and duplicate-submission protection. Records are retained; there is no automatic pruning in this first iteration. A corrupt registry fails startup closed rather than treating accepted jobs as new.

State sequence: `accepted -> submitting -> queued/running -> downloading -> completed`. Confirmed failures become `failed`. Temporary polling, credential, or persistence problems become `recovering`. A submission without a safely recorded ID becomes `uncertain`; it is not automatically submitted again, including after restart.

Persist `submitting` before the paid POST and the returned provider ID immediately afterward. The unavoidable crash window between provider acceptance and saving its ID must remain uncertain, not become a retry. Provider POSTs deliberately avoid SDK automatic retries. New model adapters must honor this contract.

Polls normally run every 3 seconds, slow to 15 seconds after 20 minutes, and back off up to 60 seconds after errors. Provider HTTP requests have a 60-second connection/request bound; media downloads have a 5-minute bound per attempt. Neither bound cancels the provider job. Resumed local saves reuse the reserved path and checkpoint; history/Stats deduplicate by generation run ID. The registry assumes one Newt backend process owns this data directory.

## Verification

Run `npm test`, `npm run build`, `npm run smoke:app`, and `node --check server/index.js`. Targeted tests cover independent long-running batch jobs, restart recovery, duplicate HTTP acceptance, original credential binding, ambiguous submissions, provider terminal errors, expired links, saved output checkpoints, scope isolation, and client/result reconciliation. Tests use fake providers and temporary stores, not paid generations or production history.

For a live check, start a small authorized Seedance batch, confirm each result appears separately, and reload the workflow while another job is pending. Restart the backend only after its provider IDs are recorded. Verify that IDs remain unchanged, one history/cost record exists per completed generation, and Preview/Output use local media. Native macOS runtime checks still require a Mac; no Windows-specific APIs are used by the recovery modules.
