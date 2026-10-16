# Documentation audit — 2026-10-15

Audit target: local Newt Node checkout 4.5.0-beta.0, source commit 2b9210e before this documentation update. Scope: feature catalog and workflows, documentation navigation, provider/model descriptions, persistence, runtime setup and performance guidance. This is a source-and-local-test audit, not a live-provider or exhaustive end-to-end quality certification. This audit changed documentation only, not application behavior, credentials or production media. A concurrent uncommitted Character/CU regeneration change appeared in NodeEditor.jsx during the audit and was preserved; measurement/tests describe the live local snapshot, not an isolated copy of the starting commit.

## Findings and corrections

| Finding | Correction | Source evidence |
| --- | --- | --- |
| Main README and current architecture/standards/creative guide still identified 3.0.0-beta.0 | Identify audited checkout 4.5.0-beta.0; distinguish checkout version from published release | package.json; package-lock.json |
| Feature navigation omitted several existing guides and lacked a full catalog/recipe reference | Add features-and-workflows.md and link Explore, Stats, model and upstream guides | src/nodeRegistry.js; docs directory |
| Standards catalog omitted Explore and Audio Model | Add both roles; explain that grouped standards table is not palette order | src/nodeRegistry.js; src/audioModel.js |
| Recent Coverage features were append-only notes and missing from overview | Document Subject/Location, Interior/Exterior, inference control, nine shots, optional input precedence and partial-result/Stop behavior | coveragePresets.js; CoverageSettings.jsx; NodeEditor.jsx; mediaModels.js |
| Preview workflow lacked recent interactions | Document before/after reorder, full-resolution canvas copies, mixed-media Left/Right gallery, numbered image tiles and image-only export | PreviewLayoutTile.jsx; previewLayout.js; MediaViews.jsx; NodeEditor.jsx |
| Found Footage/Camcorder lacked integrated discovery | Document Style versus Approach, all nine approaches, flashlight/POV/VHS direction and Still/audio constraints | modelOptions.js; filmDirectorApproaches.js; filmDirectorStyle.js |
| Creative guide instructed removed inline Video dialogue editing/preparation | Replace with Audio Model dialogue → completed track → Video Reference Audio; explain sample mode and legacy compatibility | AudioModelNodeBody.jsx; audioModel.js; NodeEditor.jsx; server/index.js |
| README claimed editor boxes/selection cache are discarded on close and implied automatic scanning | Describe explicit Scan, Done draft persistence and portable selection-PNG metadata; distinguish installation-local cache | ImageEditStudio.jsx; imageEditSelectionState.js; server/image-selection-references.js |
| README model list omitted Image 2.5 variants, Flux 3 and Nano Banana 2.1; architecture contradicted Krea 2.1 support | Reconcile catalog/provider descriptions; distinguish dated availability notice from live verification | modelOptions.js; modelProviderRouting.js; nanoBanana21.js; kreaApi.js |
| Architecture omitted Atlas H3 and Atlas/ElevenLabs credential context | Align with configured routes and distinct services | modelProviderRouting.js; Settings and server routes |
| Performance baseline was dated September; ordinary bundle report counted retained old hashes | Refresh single-build baseline from an isolated fresh output directory; preserve active dist and historical benchmark labels | vite.config.js; scripts/reportBundle.mjs; production build |

Short source names above identify files under src, src/components or src/nodeRunners unless a server/docs prefix is given. Catalog counts and provider tables in the feature reference were derived directly from current exports; descriptions were reconciled with controls, request builders, existing tests and operational guides. Historical blog/research/reliability implementation dates remain historical rather than being rewritten as new measurements.

## Verification

Current export inventory: 26 registered node types, 22 palette entries and four legacy load-only types; nine Director Approaches, 12 image-model labels and eight video-model labels. Counts describe source catalogs, not every tool's enabled menu. Validation on 2026-10-15: full npm test suite passed (1,191 passed, three skipped, zero failed); production build passed; isolated fresh build and bundle report completed; smoke:app passed for the running client and API; git diff --check passed. Local Markdown destination/anchor checks covered 45 links across nine updated/new documents; export coverage checks found every node type, image/video model label, and Director Approach in the new reference. No paid generation was run. No new native macOS, GPU/external-service or full browser-suite validation is claimed.

## Remaining boundaries

- Provider availability/pricing notices are time-sensitive; this audit did not call vendors or validate every paid route. Estimates are not invoices.
- Native macOS dialogs/startup, GPU inference, ComfyUI and local SGLang execution were not exercised here.
- Legacy compatibility code is not proof of a current visible control. The reference distinguishes hidden/load-only nodes and feature-gated Utility SAM tools.
- The generic in-app Coverage description still says a standard nine-angle set; detailed documentation now includes Location and optional references. No UI copy was changed in this documentation-only task.
- Production dist deliberately retains prior hashed assets for open-window compatibility. A raw directory aggregate includes those historical assets; do not call it the current payload or delete active assets to improve that number.
- First-image geography and generated cinematic consistency remain model-dependent; a location scout is not a verified spatial reconstruction.
