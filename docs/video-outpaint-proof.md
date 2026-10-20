# Video outpainting proof

This is a development experiment using the existing Fal Wan VACE 14B Inpainting route, not a new Utility capability.

Prepare a source clip with:

```powershell
node scripts/prepareVideoOutpaintProof.mjs "source.mp4" 0 432
```

The script creates a unique ignored `outputs/outpaint-proof-*` folder containing an 81-frame, 24 fps, 432×768 padded source, a matching mask video, framing stills, a manifest, and a request body. The default source region is a centered 432×432 crop with 168 pixels of expansion above and below. The optional third argument controls source height; source clips must be wide enough for that crop. Source media is never modified. Preparation does not submit paid work.

Submit the saved request once through the running backend's `POST /api/node/utility-video`. Preserve submission time and the Fal request ID before any recovery attempt; do not repeat a paid request merely because the client disconnects. Save the JSON response with its HTTP status as `response.json` in the proof folder. This route uses existing server credentials, provider routing, managed output downloads, and History/Stats recording.

Finish a successful result with:

```powershell
node scripts/finishVideoOutpaintProof.mjs "outputs/outpaint-proof-..."
```

This restores footage directly from the original source over the generated center with an eight-pixel vertical seam feather and creates a 1080×1920 H.264 comparison plus contact sheets. It uses the preparation manifest's crop geometry. The proof is 8-bit SDR, even if the source is 10-bit SDR. Upscaled borders are not native 1080p detail. These experimental scripts use bundled FFmpeg/FFprobe and require no additional dependencies.

## First real test, 2026-10-20

- Source: square 1440×1440, 24 fps, 10-bit SDR, 97 frames. Used the first 81 frames without discarding any of the square composition.
- Endpoint: `fal-ai/wan-vace-14b/inpainting`; seed 12345; 30 steps; guidance 5; preprocessing and prompt expansion disabled.
- Result: 720×1280, 81 frames, 24 fps, 3.375 seconds. Provider completion took 137 seconds.
- Newt's recorded cost estimate: USD 0.405, not verified account billing.
- Sampled frames show a plausible wall/window extension above and carpet/arm continuation below. This establishes successful end-to-end generation and compositing; full motion review is still needed before judging production quality. Generated anatomy, temporal texture stability, seam visibility, and invented room geometry remain review points.

Before building the node, review the raw and source-restored videos at playback speed, including the first/last frames and the arm crossing the lower boundary. The first proof does not establish quality on longer shots or other camera motion.

## Prompt guidance in Utility

Choose Wan VACE 14B Inpainting or Wan 2.2 VACE Inpainting in Utility > Video. Connect a padded/reframed source and matching mask. The mask uses white for generation and black for protected content. Select Manual to write the Prompt directly, Auto to infer conservative extensions from the videos, or Auto + guidance to include your creative direction. Click Analyze & draft prompt, review/edit the resulting Prompt, then Run separately to generate video. Analysis uses Fal video vision and incurs its own text-analysis cost; provider/model/usage are recorded in History and Stats. Missing inputs, connected text prompts, failures, and changed inputs do not overwrite your current prompt. Restart an older backend before using the new analysis route. The new controls do not create the source padding or expansion mask automatically.

Live Auto + guidance validation on the prepared source and mask succeeded on 2026-10-20 through Fal `openrouter/router/video`, model `google/gemini-3.1-pro-preview`. It returned an editable scene-specific prompt in 18 seconds; recorded analysis cost was USD 0.017. No follow-up video generation was submitted. The automatic draft still proposes unseen shoulder/torso content, reinforcing that the prompt requires review rather than implying anatomy has been verified.

## Integrated Video Outpaint Utility

Select Utility > Video > Video Outpaint. Connect the original source video; a mask input is not required. By default the source remains centered and fully visible on the selected 9:16 (default), 16:9 or 1:1 canvas. Canvas Edit, below Prepare canvas & mask, opens a fixed-ratio output frame that can move and resize across or beyond the source. Source outside the frame is cropped; black areas inside it are filled by outpainting. Apply & prepare saves the frame and builds the local source/mask preview. Cancel or Escape discards the editor draft. Playback, seeking and numeric frame coordinates help check the composition across the shot. Prepare canvas & mask creates portable local dependencies and a preview without a provider call. Black borders in the source preview correspond to white generation regions in the mask.

Choose Manual, Auto or Auto + guidance; Auto modes use the prepared source and mask. Review/edit the Prompt before Run. The reference-image input can guide the composition/person during generation. Run makes one Fal Wan VACE request per requested generation through the existing Utility pipeline. Preparation is refreshed from current settings before a run. Old results remain available during refinement, after failed requests and after save/reopen. A raw-result link lets you compare source-restored and generated content.

Controls include segment start/duration, target ratio, prompt mode/guidance, inference steps, guidance scale, seed, negative prompt, original-source restoration, seam feather and 720p/1080p delivery. Defaults retain the proof framing and the first 3.375 seconds. The segment is standardized to source fps rounded to 8–30 and a compatible 4n+1 frame count (81–241); actual timing appears in the prepared preview. Clips too short for the selected segment fail before paid generation. Frames entirely covered by source video expose Export crop and use no provider, require no generation prompt, and record zero cost.

Generation and prompt analysis remain separate paid actions. Video quality limitations observed in the proof remain; automatic anatomy or perspective correction is not promised. Delivery is 8-bit SDR H.264, and a larger delivery size can upscale generated borders. The selected source audio is retained. If final restoration/export fails after successful generation, the raw paid result is returned and recorded with its cost and a visible warning, so another paid request is unnecessary to recover it.

Verification includes real FFmpeg synthetic-media checks for source-center restoration, generated-border preservation, audio and timing; browser checks for local preparation, editable prompt analysis, generation settings, stale preview invalidation, retained results after failure, saved settings and collapsed input handles; and an isolated backend preparation/missing-key smoke check with no provider calls.

Editable frame geometry is stored in source-width units with height derived from the target aspect ratio. Backend crops are quantized to even source pixels for video compatibility. The retained-source rectangle, placement and mask are shared with final source restoration; cropped-out footage cannot reappear during compositing. Target-ratio changes keep an edited frame centered on its current center while adjusting its locked height. Old workflows with no edited frame retain the existing centered-fit behavior. Prepared masks invalidate when framing changes.

Canvas Edit includes soft snapping to clip edges and center while moving or resizing. The Snap checkbox defaults on and persists with the Utility node. Guides show active alignment; drag farther to release or hold Alt to bypass snapping. The capture distance is eight screen pixels and the release distance is 1.6 times that, independent of workspace scale. Arrow keys and numeric coordinates remain unsnapped for precise placement.
