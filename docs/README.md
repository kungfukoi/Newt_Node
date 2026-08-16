# NewtNode Documentation

This directory separates current product standards from operational manifests, drafts, and historical design notes. Runtime source and tests win if a document and the implementation disagree; update the affected document in the same change.

## Canonical

- `../README.md`: product overview, supported workflows, setup, and common commands.
- `node-standards.md`: current engineering and UX contract for nodes, media, persistence, providers, progress, canvas behavior, and verification.
- `performance.md`: current React Flow rendering architecture, measurement commands, and bundle baseline.

## Operational

- `comfyWan-requirements.yaml`: machine-readable ComfyUI custom-node and model requirements for WanBlend/WanWarp.

## Drafts And Historical Notes

- `blog-newt-node-vibe-coding.md`: copy draft and screenshot plan, not an engineering source of truth.
- `latent-wan-transition-handoff.md`: archived 2026-06-04 research note. Current WanSegment/WanWarp behavior is documented in `node-standards.md` and implemented under `server/wanwarp/`.

## Maintenance Rule

When behavior changes:

1. Update `node-standards.md` when a durable engineering or UX rule changes.
2. Update `performance.md` when rendering architecture, startup loading, or measured bundle output changes.
3. Update `README.md` when user-visible setup, model catalogs, or major capabilities change.
4. Keep historical notes labeled as historical instead of rewriting them into false present-tense guidance.
