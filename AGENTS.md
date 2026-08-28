# NewtNode Agent Instructions

These instructions apply to the entire repository. NewtNode is also called Newt Node in product copy and NewtBuilder in older discussions. Treat those names as the same application unless a task explicitly distinguishes them.

## Required Reading Order

Before changing code, read:

1. `docs/node-standards.md` - the normative engineering and UX contract.
2. `docs/architecture.md` - the current runtime, ownership, data-flow, and compatibility map.
3. `docs/development.md` - the implementation and verification workflow.
4. The relevant operational document under `docs/`, such as `performance.md`, `dependencies.md`, or `comfyWan-requirements.yaml`.

Do not begin a feature by searching only for the visible UI label. Internal types and compatibility names can differ from product labels. Examples include Timeline / `assembly`, WanWarp / `videoStitch`, and WanSegment / `transitionBuilder`.

## Source Of Truth

- The user's current requirement defines the intended change.
- `docs/node-standards.md` defines the durable product contract.
- Current source and tests show how that contract is implemented.
- `src/nodeRegistry.js` is the canonical node catalog and order.
- `src/modelOptions.js` owns callable model and Utility labels and shared option lists.
- `package.json` and `package-lock.json` own JavaScript dependencies and app version metadata.

If code, tests, and standards disagree, investigate the mismatch. Do not silently preserve an obvious bug or silently replace a documented contract. Make the implementation, tests, and affected documentation agree in the same change.

## Non-Negotiable Product Rules

- Preserve saved-workflow compatibility. Stable node ids, edge endpoints, port ids, reference bindings, result shapes, and legacy internal node types must survive upgrades through normalization or migration.
- Keep `NodeEditor.jsx` as an orchestrator. Put reusable logic in the focused modules listed in the standards ownership map.
- Use React Flow for canvas transforms, handles, selection, and edge paths. Do not add a second canvas coordinate system.
- Keep the canvas useful at production scale. Nodes and edges must remain stable at 5%, 8%, 30%, and 100% zoom without proxy/map substitution, flicker, broken lines, or viewport snap-back.
- Never crop preview media merely because a node, modal, layout, or output rail was resized. Preserve the complete image/video with contain/letterbox behavior unless the user is explicitly operating a crop tool.
- Preview nodes are viewers. Producer nodes own generation, timeline playhead, result state, and transport behavior.
- Keep files portable with workflow packages. Uploaded, generated, copied, and derived assets must use managed workflow/output helpers instead of machine-specific browser paths.
- Keep provider routing explicit. Do not silently switch providers, keys, models, or endpoints when the selected route fails.
- Record paid work honestly in history and Stats. Include provider, endpoint, model, relevant settings, media metadata, and cost or an explicit unpriced state.
- Expose real generation progress when available and label estimates as estimates.
- Keep credentials server-side and local. Never put secrets in browser logs, history, fixtures, screenshots, docs, or committed `.env` files.
- Preserve both Windows and macOS launch, restart, file-dialog, path, and update behavior whenever platform-sensitive code changes.
- Keep output claims technically honest. A 10-bit ProRes transcode does not restore precision absent from an 8-bit source and is not automatically HDR.

## Required Change Process

1. Inspect `git status --short --branch` and preserve changes you did not create.
2. Trace the feature through every affected surface using the impact matrix in `docs/node-standards.md`.
3. Find and reuse the existing owner, helper, result shape, route wrapper, and UI pattern.
4. Add compatibility normalization before changing persisted fields, ports, types, labels, or URLs.
5. Implement the smallest coherent change across frontend, backend, persistence, history, and tests.
6. Run the validation tier required by `docs/development.md` and the standards verification checklist.
7. Update standards, architecture, setup, model catalogs, or operational docs when their truth changed.
8. Review `git diff --check`, `git diff`, and final status before reporting completion.

Do not commit, merge, pull, push, switch branches, or discard local work unless the user asks. When those actions are requested, follow the repository's existing remote and branch configuration rather than guessing.

## Definition Of Done

A feature is not complete because its primary control renders. It is complete when:

- old and new workflows load without stale edges or missing assets;
- ports connect, reject, auto-connect, animate, and reanchor correctly;
- run order, results, previews, output routing, history, Stats, progress, and errors agree;
- loading, empty, disabled, success, partial-success, and failure states are usable;
- resize, zoom, text editing, keyboard behavior, and media aspect ratio remain correct;
- Windows and macOS assumptions are either shared or deliberately implemented on both platforms;
- focused tests pass, the full suite passes when shared behavior changed, and production build/smoke checks pass when applicable;
- the relevant documentation describes the behavior that now exists.

Use `docs/node-standards.md` for the complete rules and verification matrix.
