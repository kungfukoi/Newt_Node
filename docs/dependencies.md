# NewtNode Dependencies

NewtNode's application dependencies are declared in `package.json` and pinned by `package-lock.json`. Do not maintain a separate hand-written install list; update both package files whenever an npm runtime dependency changes.

For setup commands, validation tiers, environment overrides, and troubleshooting, see `development.md`.

## Runtime Requirements

- Node.js 20 or newer.
- npm, distributed with Node.js.
- Network access to the npm registry when dependencies are missing or the lockfile changes.
- FFmpeg and FFprobe are supplied by `ffmpeg-static` and `ffprobe-static`.

Important direct runtime packages include:

| Package | Purpose |
| --- | --- |
| `react`, `react-dom` | Application UI runtime. |
| `@xyflow/react` | Node canvas, handles, viewport behavior, and connector rendering. |
| `three` | Frame It and 3D media previews. |
| `express`, `cors`, `multer` | Local API and uploads. |
| `@fal-ai/client` | Fal model requests. |
| `ffmpeg-static`, `ffprobe-static` | Local media inspection and editing. |

## Automatic Launcher Install

`Launch_NewtNode.ps1` on Windows and `NewtNode.command` on macOS run `scripts/ensureDependencies.mjs` before building or starting NewtNode. The preflight runs `npm install --no-audit --no-fund` when:

- `node_modules` has not been initialized;
- `package.json` or `package-lock.json` changed after the last install;
- a declared top-level package is missing; or
- an installed top-level version differs from `package-lock.json`.

Automatic installs use the gitignored `server/data/npm-cache` directory so launch does not depend on write access to the operating system user's global npm cache.

This ensures a normal git pull followed by launch installs additions such as `@xyflow/react` automatically. Run the same check manually with:

```bash
npm run deps:ensure
```

ComfyUI custom nodes, Python packages, and Wan model files are separate machine-level dependencies documented in `comfyWan-requirements.yaml`.

SGLang, its Python/CUDA environment, and MiniMax H3 weights are optional machine-level dependencies for the Local MiniMax H3 provider. They are intentionally not npm dependencies; setup and shared-path mapping are documented in `minimaxH3-local.md`.
