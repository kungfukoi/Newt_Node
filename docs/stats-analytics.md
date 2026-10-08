# Spend analytics

Run `node scripts/playtestStats.mjs` from this checkout on HAL4090, then open
http://127.0.0.1:5296 and choose Stats. API/control ports are 3346/3347.
The launcher refuses occupied ports and leaves existing Newt Node instances running.
This isolated checkout has independent settings/history; an empty ledger is expected
until records exist. No generation is needed to inspect the panel.

Local means this installation's retained history plus its durable accounting ledger,
not complete lifetime or cross-machine history. `/api/stats/local` sanitizes records
through a strict allowlist. New history appends persist to `server/data/stats-ledger.json`
and retain a previous-write backup. Existing retained history bootstraps the ledger;
already-evicted events cannot be recovered automatically. Corruption fails visibly,
preserves the source, and does not cancel or replay generation. The legacy `/api/stats`
contract remains available. Historical costs are never recalculated with today's rates.
Missing/non-USD amounts remain unpriced; known zero remains priced. Estimates and
provider charges are separate, and averages count priced runs only.

Local filters intersect: date, stable workflow/project ID, provider, model, credential
fingerprint, state and run/job/file text. Last 5/30 days include today using local calendar
days; custom dates are inclusive. Workflow filename is metadata, not identity: rename
keeps identity, deliberate Save As follows existing new-project identity behavior.
Identically named files with distinct IDs stay separate. Older unlinked records remain
unknown. Completed records are not a live queue or complete failed-job audit trail.

Future runs capture only SHA-256 credential fingerprints server-side. Old events are
not retroactively attributed to today's key. UI labels show a short fingerprint, never
the key. Provider public key IDs used in Global are a different identity space and
are not assumed to map to local fingerprints. Account switches invalidate cached results.

Global queries happen only on the explicit Query providers action. Global uses UTC days
and a maximum 180-day range, independent of paused workflow/run filters. Supported
provider responses are bounded, paginated, contract-checked and cached for 60 seconds.
Incomplete, overlapping, malformed or unsupported-currency sources withhold totals.
Balances are current account/workspace snapshots, independent of model/key/date filters.
Local and Global are never added together. Provider coverage and freshness remain visible.

| Provider | Official spend source | Remaining balance | Requirements / limits |
| --- | --- | --- | --- |
| Atlas Cloud | [model-costs](https://www.atlascloud.ai/docs/public-api), grouped model/key, account or self | Account available USD | Billing-read role for account scope; self means the user's keys, not only calling key. 180-day UTC window. |
| Fal | [usage](https://fal.ai/docs/platform-apis/v1/models/usage), discounted cost_total and public key IDs | Workspace current credits | Admin-scope credential; cost buckets can change before final invoice. |
| Krea | Unavailable | Unavailable | [No public API balance endpoint](https://www.krea.ai/docs/developers/api-keys-and-billing); enterprise compute usage excludes direct API USD jobs. Use Krea dashboard. |
| OpenAI | [Organization Costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs) | Unavailable | Separately configure OPENAI_ADMIN_KEY and restart; regular generation key is not used for costs. Nullable key attribution; no model filter integrated. |
| Google/Gemini | Unavailable here | Unavailable | [Cloud Billing BigQuery export](https://docs.cloud.google.com/billing/docs/how-to/export-data-bigquery) and separate permissions/backend required. |
| ElevenLabs | Unavailable USD spend | Remaining subscription characters | [Subscription endpoint](https://elevenlabs.io/docs/api-reference/user/subscription/get), user-read permission; characters are not money, overage not included. |

No permissions are expanded automatically. Existing runtime keys are reused only for
permitted read-only provider queries. No service is provisioned and no local usage is
uploaded to a third party. Provider queries send date ranges and optional public IDs.
Mock-based tests exercise provider contracts; real account queries were not performed.

Export downloads `newt-accounting-v1` sanitized records. Import comparison validates up to
10,000 rows and previews a deduplicated merge without persisting or changing Local totals.
Stable provider + run/job IDs prevent replay duplicates; actual charges can replace
estimates, missing costs can be filled, existing known prices are preserved. Anonymous
legacy records cannot guarantee globally unique identity. A future approved shared backend
can consume this format with authenticated device IDs, idempotent event ingestion and
explicit conflict review. A shared API key alone does not synchronize installations.

Validation: `npm test`, `npm run build`, `npm run smoke:isolated`,
`npm run test:browser`, `npm run test:performance`, `npm run bundle:report`.
The stats browser suite uses fixtures and blocks external API requests. Its screenshots
cover overview, combined filters, stale errors, Global scope and a narrow viewport.
