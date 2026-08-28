# Latent Wan Transition Handoff

Status: archived research note. It records the 2026-06-04 design exploration and is not the current implementation guide. Current WanSegment/WanWarp behavior lives in `docs/node-standards.md` and `server/wanwarp/` in the current checked-out source.

Date: 2026-06-04
Historical branch: `wan22-animdiff-transition-dev`

## Goal

Build a Newt_Node transition workflow that uses a black and white matte as a spatial influence field between two keyframe images, then regenerates the result with Wan and a motion/style LoRA.

The target is not a literal composite and not classic mask inpainting. The desired behavior is latent-space weighting:

```text
latent_mix = W * latent_image_1 + (1 - W) * latent_image_2
```

Where white areas in the matte favor image 1, black areas favor image 2, and gray areas smoothly interpolate. Wan should then denoise/regenerate the mixed latent so the result looks unified, animated, and model-native.

## Current Understanding

Public Fal Wan endpoints are useful but do not expose the true latent tensor or custom sampler loop. That means they cannot directly implement per-pixel latent influence weighting.

Known public Fal approximations:

- Wan 2.2 A14B LoRA Image-to-Video can use image 1, optional end image, LoRAs, guidance, guidance 2, and shift.
- Wan 2.2 Video-to-Video can reinterpret a guide video using global `strength`.
- Wan VACE endpoints accept mask videos, source videos, and reference images, but treat masks more like masked generation/inpainting guidance than a true latent influence map.

Most likely real implementation path:

- Prototype the latent operation locally or in a custom cloud Python service.
- Use Wan VAE to encode both keyframe-derived video stacks.
- Resize the matte video into latent resolution.
- Blend the two latent stacks.
- Add noise according to denoise strength.
- Run Wan denoising with prompt plus LoRA.
- Decode to video.

## Provider Options

Preferred prototype options:

1. Modal
   - Best for Python-first sampler experiments.
   - Supports GPU functions, web endpoints, persistent volumes, and custom PyTorch code.

2. RunPod Serverless
   - Good cost and GPU flexibility.
   - Better once the container/code is less experimental.

3. Replicate
   - Good productized API path via Cog.
   - Less flexible than Modal for weird sampler iteration.

4. Fal Serverless
   - Nice because Newt_Node already calls Fal.
   - Requires Serverless access request.
   - Useful if approved quickly.

5. ComfyDeploy / RunComfy
   - Good if the solution becomes a ComfyUI custom node/workflow.
   - Less direct if we want standalone sampler ownership.

## Proposed Custom Endpoint

Working name: `latent-wan-transition`

Input shape:

```json
{
  "image_1_url": "https://...",
  "image_2_url": "https://...",
  "matte_video_url": "https://...",
  "prompt": "A cinematic generated transition...",
  "negative_prompt": "flat composite, split screen, hard mask edge...",
  "num_frames": 81,
  "fps": 16,
  "resolution": "720p",
  "seed": 12345,
  "guidance_scale": 3.5,
  "guidance_scale_2": 4.0,
  "shift": 5.0,
  "steps": 27,
  "denoise_strength": 0.65,
  "matte_blur": 6,
  "matte_gamma": 1.0,
  "latent_anchor_strength": 0.45,
  "latent_anchor_start_step": 0,
  "latent_anchor_end_step": 12,
  "loras": [
    {
      "path": "https://...",
      "weight_name": "motion.safetensors",
      "scale": 1.5,
      "transformer": "both"
    }
  ],
  "debug_outputs": true
}
```

Expected outputs:

```json
{
  "video": { "url": "https://..." },
  "debug": {
    "latent_guide_video": { "url": "https://..." },
    "matte_resolved_video": { "url": "https://..." },
    "first_frame": { "url": "https://..." },
    "last_frame": { "url": "https://..." }
  },
  "seed": 12345,
  "settings": {}
}
```

## Sampler Design

The simplest version blends once before denoising:

```text
z1 = encode(repeated image 1 video)
z2 = encode(repeated image 2 video)
w = resize(matte video to latent T/H/W)
z_mix = w * z1 + (1 - w) * z2
z_noisy = add_noise(z_mix, strength)
z_out = wan_denoise(z_noisy, prompt, negative, loras)
video = decode(z_out)
```

Better version adds an anchor schedule during early denoising:

```text
for each denoise step:
  z = scheduler_step(...)
  anchor = schedule(step) * latent_anchor_strength
  z = anchor * z_mix + (1 - anchor) * z
```

This should make the matte behave like an influence field early, while allowing Wan to unify the final texture and motion later.

## Newt_Node Integration Plan

Add a new Utility Video model:

```text
Latent Wan Transition
```

Inputs:

- Prompt
- Reference Image In, expecting two keyframes
- Mask Video In, using the matte as a weight video

Controls:

- Provider: Modal, RunPod, Fal Serverless, Replicate, Local
- Endpoint URL or endpoint id
- Denoise strength
- Latent anchor strength
- Anchor start/end step
- Matte blur
- Matte gamma
- LoRA list with scale and transformer target
- Guidance, guidance 2, shift, steps, seed
- Debug outputs toggle

Outputs:

- Generated Transition
- Latent Guide Debug
- Resolved Matte Debug

## First Experiments

1. Public API baseline
   - Build a soft weighted guide video from the two images and matte.
   - Run Wan 2.2 V2V with `strength` values around 0.45, 0.65, 0.8.
   - Purpose: establish a cheap visual baseline.

2. Local latent proof
   - Use Diffusers or Comfy/WanVideoWrapper logic to encode image/video latents.
   - Implement matte-weighted latent blend.
   - Decode the mixed latent before denoising as a sanity check.
   - Then add denoise and LoRA.

3. Cloud endpoint proof
   - Start with Modal unless Fal Serverless is approved first.
   - Store model weights in a persistent volume.
   - Return MP4 plus debug outputs.

4. Newt_Node wiring
   - Add the model option and controls after the endpoint returns useful output.
   - Keep WanWarp separate or name it clearly so it does not confuse the public API approximation with the true latent workflow.

## Acceptance Criteria

The workflow is promising if:

- The matte controls where image 1 versus image 2 influence appears.
- The output does not look like a hard alpha composite.
- The blend zones are regenerated into plausible shared content.
- The motion/style LoRA visibly affects the whole transition.
- The result remains temporally coherent.
- The same seed/settings can reproduce roughly comparable outputs.

## Open Questions

- Which Wan model should be the first true sampler target: Wan 2.2 A14B I2V, Wan 2.2 TI2V-5B, or Wan 2.1 through existing Comfy wrappers?
- Can we fit the desired model on a practical GPU tier, or do we need quantization/offload?
- What is the exact latent tensor shape and temporal compression for the chosen Wan model?
- Should the matte be applied to all latent channels equally, or should we experiment with channel/group weighting?
- Should LoRA application target high-noise, low-noise, or both transformer stages?
- Is the motion LoRA compatible with the chosen Wan implementation outside Fal?

## Current Implementation Reference

Do not resume development by switching to the historical branch. Start from the current development line and review the production integration first:

```powershell
cd C:\dev\Newt_Node
git switch dev
git pull --ff-only origin dev
npm.cmd test
npm.cmd run build
```

Then read `docs/node-standards.md`, `docs/comfyWan-requirements.yaml`, and the current `server/wanwarp/` implementation. Use this document only when the original latent-blending research context is useful.

## Notes From Current Branch

Recent relevant branch changes include:

- WanWarp was reworked toward a two-pass Wan LoRA plus VACE influence-mask experiment.
- Ctrl/Cmd+S behavior was restored to use the app save flow instead of the browser Save As dialog.
- The top bar now shows `Saving...` during saves.
- Wan LoRA scale is no longer clamped to `0..2` in the server payload or editor inputs.

