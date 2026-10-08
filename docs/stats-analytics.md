# Spend analytics

Run `node scripts/playtestStats.mjs` from this checkout on HAL4090, then open
http://127.0.0.1:5296 and choose Stats. API/control ports are 3346/3347.
The launcher refuses occupied ports and leaves existing Newt Node instances running.
This isolated checkout has independent settings/history; an empty ledger is expected
until records exist. No generation is needed to inspect the panel.

For populated morning playtesting, open **http://127.0.0.1:5296/stats-demo.html**.
This separate development entry has a persistent SYNTHETIC DEMO notice. Every amount
is fabricated in memory using dates relative to today; no API request, credential,
local/session storage or real ledger is used. Import/export are disabled. Exercise
workflow/provider/model/key filters together, last 5/30 days, custom dates, reset,
run Details and Global. Use `demo/model` / `demo-public-key` as the public fixture IDs.
Simulate demo outage, then Refresh records; restore demo connection and Retry to
inspect stale/error recovery. Closing the page discards its data.

Normal production builds exclude this entry. To include it for preview/browser tests
in PowerShell: `$env:NEWTNODE_STATS_DEMO='1'; npm run build; npm run test:browser`.
The browser fixture preview test verifies zero API requests and zero browser storage.

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
days; custom dates are inclusive. All Time runs from the earliest valid retained/ledger
record through now, across years, and intersects the other Local filters. An empty
ledger shows today. It cannot recover evicted records or other installations. Global
billing retains its explicit 180-day limit; All Time is a Local option. Provider choices
remain available without recorded usage, including Krea. The page title is Stats.
Workflow filename is metadata, not identity: rename
keeps identity, deliberate Save As follows existing new-project identity behavior.
Identically named files with distinct IDs stay separate. Older unlinked records remain
unknown. Completed records are not a live queue or complete failed-job audit trail.

Future runs capture only SHA-256 credential fingerprints server-side. Old events are
not retroactively attributed to today's key. UI labels show a short fingerprint, never
the key. Local API-key options use the current Settings credential names as
`Provider–API name`, including saved inactive/unused credentials. The server maps
names to provider-scoped SHA-256 fingerprints without returning secret keys. Renaming
a credential updates its display name without changing run attribution. Multiple
names for the same provider/key share one filter choice. Removed/unlisted keys keep
their fingerprint fallback; legacy unattributed runs stay unknown. Provider public key IDs used in Global are a different identity space and
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

## Unpriced runs: findings and reconciliation design

The current `createHistoryPricing` reconciliation only visits retained recent history,
not ledger-only runs. It fills text usage and selected Atlas media estimates. It does
not recover original invoices; Atlas calculate quotes use current account rates.
`ProviderPricing.falCharge` attempts one immediate lookup after a request, so delayed
billing or missing billing permissions leaves runs without a settled charge. The
history store also refuses to replace existing estimates, although the ledger merge
already supports replacing an estimate with a provider-reported charge.

To recover accurate costs, retain a server-only reconciliation record for every paid
request: provider request ID (separate from local run/record ID), endpoint, credential
fingerprint, timestamp, original settings/usage and the price snapshot at submission.
Keep this beyond recent-history eviction. Reconcile against the original account/key;
never attribute an old request to whichever credential happens to be active today.

1. Fal: read paginated billing events by date/endpoint and match exact request IDs.
   Retry delayed events with bounded backoff; use cost_total after account discounts.
   Preserve failed/permission-required results for later retry without resubmitting jobs.
2. Atlas: use original per-request charges when available. Aggregate model-costs buckets
   cannot be allocated to individual runs reliably. Saved calculate quotes remain
   estimates; do not relabel current-rate quotes as historical billed charges.
3. Krea: preserve any documented job charge and original parameter-specific price
   snapshot. Official billing docs describe per-generation parameter pricing and no
   public balance endpoint. Do not infer a per-job charge from workspace compute units
   or a balance change. Historical runs need matching billing evidence from Krea or
   a provider-supported export; undocumented charge fields must be verified first.
4. OpenAI/Google/ElevenLabs: retain original usage and applicable rate versions for
   estimates. Account totals/character allowances cannot establish individual charges.
5. Apply verified charges idempotently to both history and the durable ledger, including
   ledger-only runs. Actual may replace an estimate; never replace a known actual with
   an estimate. Preserve source, checked time, previous amount and reconciliation audit.

Expose a reconciliation preview with recovered/pending/insufficient-evidence counts,
then apply supported matches. Tests must cover delayed billing, account changes,
multi-output requests, duplicate events, discounts, ledger-only runs and unavailable
provider APIs. Every run can have an explicit pricing state; a guaranteed accurate
numeric price is impossible when original usage/rates or billing evidence is missing.
This design is investigated, not implemented; this UI change does not rewrite costs.

Sources checked: [Fal billing events](https://fal.ai/docs/platform-apis/v1/models/billing-events),
[Atlas public billing API](https://www.atlascloud.ai/docs/public-api), and
[Krea billing](https://www.krea.ai/docs/developers/api-keys-and-billing).

Export downloads `newt-accounting-v1` sanitized records. Import comparison validates up to
10,000 rows and previews a deduplicated merge without persisting or changing Local totals.
Stable provider + run/job IDs prevent replay duplicates; actual charges can replace
estimates, missing costs can be filled, existing known prices are preserved. Anonymous
legacy records retain matching occurrence counts across retained-history snapshots,
so identical legacy events are not silently collapsed. Standalone anonymous appends
receive synthetic ledger record IDs. Cross-machine anonymous overlap cannot be verified;
read-only comparisons explicitly disclose this ambiguity. Cost, display-name, filename
and key enrichment do not split anonymous events. Changes to their timestamp, provider,
workflow ID, model or endpoint cannot be reliably reconciled without a stable source ID.
A future approved shared backend
can consume this format with authenticated device IDs, idempotent event ingestion and
explicit conflict review. A shared API key alone does not synchronize installations.

Validation: `npm test`, `npm run build`, `npm run smoke:isolated`,
`npm run test:browser`, `npm run test:performance`, `npm run bundle:report`.
The stats browser suite uses fixtures and blocks external API requests. Its screenshots
cover overview, combined filters, stale errors, Global scope and a narrow viewport.
