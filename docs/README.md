# NewtNode Documentation

This directory separates the current product contract from architecture, build guidance, operational manifests, drafts, and historical notes. Agents adding or changing features must begin at the repository `AGENTS.md` and read `node-standards.md` before implementation.

## Agent Reading Order

1. `../AGENTS.md`: repository-wide agent rules and Definition of Done.
2. `node-standards.md`: normative engineering and UX rules for every NewtNode feature.
3. `architecture.md`: current app boundaries, ownership, data flow, storage, and compatibility layers.
4. `development.md`: setup, implementation loop, validation tiers, and troubleshooting.
5. The operational document relevant to the feature.

## Canonical

- `../README.md`: product overview, supported workflows, user setup, and common commands.
- `node-standards.md`: current engineering and UX contract for nodes, media, persistence, providers, progress, canvas behavior, and verification.
- `architecture.md`: descriptive snapshot of the current frontend, backend, graph, media, persistence, and launch architecture.
- `development.md`: agent/developer workflow for building and validating features.
- `performance.md`: current React Flow rendering architecture, measurement commands, and bundle baseline.

## Operational

- `dependencies.md`: npm/runtime requirements and automatic launcher installation behavior.
- `comfyWan-requirements.yaml`: machine-readable ComfyUI custom-node and model requirements for WanBlend/WanWarp.
- `../.env.example`: documented credential, port, local-tool, ComfyUI, concurrency, and model override variables.

## Drafts And Historical Notes

- `blog-newt-node-vibe-coding.md`: copy draft and screenshot plan, not an engineering source of truth.
- `latent-wan-transition-handoff.md`: archived 2026-06-04 research note. Current WanSegment/WanWarp behavior is documented in `node-standards.md` and implemented under `server/wanwarp/`.

Historical documents may explain why a feature exists, but they do not override current standards, source, or tests.

## Maintenance Rule

When behavior changes:

1. Update `node-standards.md` when a durable engineering or UX rule changes.
2. Update `architecture.md` when ownership, runtime boundaries, ports, storage, or data flow changes.
3. Update `development.md` when setup, scripts, validation, or troubleshooting changes.
4. Update `performance.md` when rendering architecture, startup loading, or measured bundle output changes.
5. Update `../README.md` when user-visible setup, model catalogs, or major capabilities change.
6. Keep historical notes labeled as historical instead of rewriting them into false present-tense guidance.

When a document and implementation disagree, do not merely document the accidental behavior. Determine the intended contract, then make code, tests, and docs agree in the same change.
