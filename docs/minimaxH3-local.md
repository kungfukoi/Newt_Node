# Local MiniMax H3

Newt can route the MiniMax H3 Video Model through Fal or a loopback [SGLang](https://docs.sglang.ai/) service. Choose the route in **Settings > Model Providers > MiniMax H3**. The selected route is authoritative; Newt never falls back silently.

## What Newt Expects

- An SGLang server reachable from Windows at `http://127.0.0.1:30010`.
- The asynchronous OpenAI-compatible video API: `POST /v1/videos`, `GET /v1/videos/:id`, and `GET /v1/videos/:id/content`.
- A healthy `GET /health` response.
- `768P` selected on the Video Model node.
- Media paths visible to both Newt and the inference environment.

The primary service handles text-to-video and first/last-frame video. Reference-to-video is a distinct H3 variant and can be exposed on `MINIMAX_H3_LOCAL_REF_URL`, normally port `30011`.

## SGLang Runtime

SGLang''s H3 runtime requires a compatible Linux, Python, PyTorch, CUDA, and GPU environment. On Windows, use WSL2 or a Linux container with NVIDIA GPU access. Follow the current [SGLang Diffusion installation guide](https://docs.sglang.ai/diffusion/index.html) and [MiniMax H3 example](https://docs.sglang.ai/diffusion/models/minimax_h3.html) for version-matched installation and launch flags.

A single 24 GB GPU deployment normally needs SGLang''s INT8 and layerwise-offload options. The official command shape is:

```bash
sglang serve \
  --model-path MiniMaxAI/MiniMax-H3 \
  --model-variant fl2va \
  --quantization kitchen_int8 \
  --attention-backend fa \
  --performance-mode memory \
  --layerwise-offload-components dit,text_encoder \
  --dit-offload-prefetch-size 1 \
  --dit-layerwise-resident-layers 0 \
  --port 30010
```

Use the version-matched official example if an option name differs. Start a second `ref2va` service on port `30011` only when reference images, video, or audio are required.

SGLang expects a complete loadable H3 model repository or snapshot. A standalone ComfyUI `.safetensors` file is not by itself the expected model directory.

## Windows / WSL Media Mapping

Conditioned H3 jobs receive `file://` URIs. Native Windows and WSL paths differ, so configure a shared mapping in Newt''s local `.env`:

```dotenv
MINIMAX_H3_LOCAL_URL=http://127.0.0.1:30010
MINIMAX_H3_LOCAL_REF_URL=http://127.0.0.1:30011
MINIMAX_H3_LOCAL_HOST_MEDIA_ROOT=C:\
MINIMAX_H3_LOCAL_ENGINE_MEDIA_ROOT=/mnt/c
```

Both root variables must be set together. Narrow the host root when all workflow media lives under one project directory. Restart Newt after changing `.env`.

## Verification

1. Open `http://127.0.0.1:30010/health`; it should return success.
2. Open Newt Settings. The MiniMax H3 Local detail should say SGLang is ready.
3. Choose **Local**, save routing, and select **768P** on the H3 Video Model node.
4. Start with a short text-to-video or Start Frame job.
5. Configure and test the Ref2VA service separately before using reference media.

Newt copies completed video content into its normal managed output location and records `local-sglang` with zero hosted-provider cost in history.

