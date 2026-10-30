# Video outpainting proof

## Official-source audit, 2026-10-29

Reviewed [fal's Seedance 2.5 prompting guide](https://fal.ai/learn/devs/how-to-use-seedance-2-5), [BytePlus's Seedance 2.5 prompt guide](https://docs.byteplus.com/en/docs/modelark/seedance-2-5-prompt-guide), and [Atlas's reference/edit API](https://www.atlascloud.ai/docs/en/more-models/bytedance/seedance-2.5-reference-to-video/generateVideo). These document editing semantics and limitations; they do not promise a seamless outpainting composite.

| Practice | Current implementation |
| --- | --- |
| Explicit editing task, one source master, inherited ratio/duration | Fal task=editing; Atlas omni_reference_task_type=edit, adaptive ratio, duration=-1; Krea uses its separate documented edit inference. No silent provider fallback. |
| Identify @Video1 as sole editing master and constrain edit scope | Strengthened submission wrapper: only prepared extension/overlap changes; source positions, camera, performance, occlusion and event order remain authoritative. |
| Keep references few and assign narrowly defined roles | Three visible reference slots; Environment now explicitly preserves source lighting/object positions and excludes reference camera composition and people. Existing larger saved reference sets remain compatible. |
| Avoid restaging the motion already supplied by the video | Analysis asks for brief boundary interactions and direct inheritance of the source performance, retaining its entrances/exits. Existing user captions remain editable. |
| Use compatible frame counts for editing and check actual correspondence | Existing 8n+1 provider grid plus guard tail, all native source frames retained, final rational source clock restored. Timing/coverage checks remain required. |
| Preserve quality through generation and local finishing | Atlas requests MOV/4:4:4 intermediate; Fal requests high bitrate and H.264. New local canvases/finished MP4s explicitly convert/tag BT.709. Higher precision cannot recover lost detail. |
| Inspect and use the generated plate independently of the restored source | Show composited source selects the video used by Preview, Output, downstream nodes, download and drag; switching views makes no provider call. |

Both fal and BytePlus document approximate editing duration; timestamp guidance is not a guarantee of frame-accurate motion. A generation with incompatible poses at a source boundary cannot be made valid by feathering alone. Full temporal dope-sheet conditioning, tracked foreground mattes, optical-flow correspondence, content-selected seams and multiband lighting/texture integration are additional compositor work, not capabilities already supplied by the current rectangular inward feather. The [CVPR video-outpainting paper](https://openaccess.thecvf.com/content/CVPR2022W/NTIRE/html/Dehan_Complete_and_Temporally_Consistent_Video_Outpainting_CVPRW_2022_paper.html) supports foreground/background estimation and temporal propagation; [Adobe's content-aware fill guidance](https://helpx.adobe.com/after-effects/using/content-aware-fill.html) supports reference-frame and lighting-correction workflows. Those techniques motivate future contextual compositing; this audit does not claim they are implemented.

## Current controls (4.19)

The proof notes below describe earlier experiments. For current timing/provider behavior, see [the node standards](node-standards.md).

Seedance Edit supports the selected Fal, Atlas Cloud or Krea route. Duration follows the complete source frame count after Start; Canvas repeats repeats that complete segment before submission. Keep all repeats (debug) retains all copies and guard tail; disable it to deliver the final copy. Original picture/audio restoration follows the native source clock. No frozen reference plate is composited.

Connect the same approved reference image nodes across takes and assign each Image role: Environment for set layout/materials, Wardrobe for clothing, or the legacy Appearance guidance. Keep reference order/roles consistent. Source footage controls visible content, framing, camera, performance and timing. References improve continuity but cannot guarantee identical generated geometry.

Enable Match extension color for bounded per-side color offsets that stay constant through the shot. Inconsistent evidence is skipped and reported. Refinish selected result applies finishing settings to retained raw media locally on its saved geometry/timing, appends a result and makes no new paid request. Source restoration and a nonzero Blend width are required for color matching; legacy finishing stays unchanged until this control is enabled.

Analyze & draft prompt retains frame evidence and native video analysis, describing completed scenery in each missing region throughout the video. Green #00FF00 is a visual replacement cue rather than a documented hard mask; first-frame completion remains a model limitation. Analysis and generation still require separate explicit actions. Restart the backend and refresh the UI after updating.

## Historical proof

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

Select Utility > Video > Video Outpaint. Connect the original source video; a mask input is not required. By default the source remains centered and fully visible on the selected 9:16 (default), 16:9 or 1:1 canvas. Canvas Edit, above Prepare canvas & mask, opens a fixed-ratio output frame that can move and resize across or beyond the source. Source outside the frame is cropped; black areas inside it are filled by outpainting. Apply & prepare saves the frame and builds the local source/mask preview. Cancel or Escape discards the editor draft. Playback, seeking and numeric frame coordinates help check the composition across the shot. Prepare canvas & mask creates portable local dependencies and a preview without a provider call. Black borders in the source preview correspond to white generation regions in the mask.

Choose Manual, Auto or Auto + guidance; Auto modes use the prepared source and mask. Review/edit the Prompt before Run. The reference-image input can guide the composition/person during generation. Run makes one Fal Wan VACE request per requested generation through the existing Utility pipeline. Preparation is refreshed from current settings before a run. Old results remain available during refinement, after failed requests and after save/reopen. A raw-result link lets you compare source-restored and generated content.

Controls include segment start/duration, target ratio, prompt mode/guidance, inference steps, guidance scale, seed, negative prompt, original-source restoration, seam feather and 720p/1080p delivery. Defaults retain the proof framing and the first 3.375 seconds. The segment is standardized to source fps rounded to 8–30 and a compatible 4n+1 frame count (81–241); actual timing appears in the prepared preview. Short clips automatically repeat the footage remaining after Start at normal speed until the selected compatible duration is filled (at least 81 frames: 3.375 seconds at 24 fps). Final source restoration and audio use the same repeated segment; the delivered result retains the extended duration. Loop boundaries may show a cut, and generation does not guarantee a seamless loop. A start time with no source frame remaining fails before paid generation. Frames entirely covered by source video expose Export crop and use no provider, require no generation prompt, and record zero cost.

Generation and prompt analysis remain separate paid actions. Video quality limitations observed in the proof remain; automatic anatomy or perspective correction is not promised. Delivery is 8-bit SDR H.264, and a larger delivery size can upscale generated borders. The selected source audio is retained. If final restoration/export fails after successful generation, the raw paid result is returned and recorded with its cost and a visible warning, so another paid request is unnecessary to recover it.

Verification includes real FFmpeg synthetic-media checks for source-center restoration, generated-border preservation, audio and timing; browser checks for local preparation, editable prompt analysis, generation settings, stale preview invalidation, retained results after failure, saved settings and collapsed input handles; and an isolated backend preparation/missing-key smoke check with no provider calls.

Editable frame geometry is stored in source-width units with height derived from the target aspect ratio. Backend crops are quantized to even source pixels for video compatibility. The retained-source rectangle, placement and mask are shared with final source restoration; cropped-out footage cannot reappear during compositing. Target-ratio changes keep an edited frame centered on its current center while adjusting its locked height. Old workflows with no edited frame retain the existing centered-fit behavior. Prepared masks invalidate when framing changes.

Canvas Edit includes soft snapping to clip edges and center while moving or resizing. The Snap checkbox defaults on and persists with the Utility node. Guides show active alignment; drag farther to release or hold Alt to bypass snapping. The capture distance is eight screen pixels and the release distance is 1.6 times that, independent of workspace scale. Arrow keys and numeric coordinates remain unsnapped for precise placement.


## Seedance 2.5 engine

Choose Outpaint model below Model to compare Wan VACE 14B (the existing default) with Seedance 2.5. Framing, preparation, editable analysis, source restoration and delivery are shared. Seedance shows one Resolution selector (480p/720p/1080p) for both generation and final export, with no Auto or separate delivery-size control. Saved mismatched delivery settings normalize to the selected generation resolution. It hides Wan-only steps, guidance scale, seed and negative prompt. Generation uses your Settings > Model Providers > Seedance choice (Fal or Atlas); unsupported Krea edits fail explicitly. Prompt analysis still uses Fal video vision.

Analyze examines the same prepared footage and expansion mask as Wan, extrapolates the missing scene from visible context, and writes an editable instruction suitable for Seedance. Every Seedance outpaint edit additionally receives scene-extension instructions to fill the black padding, match colors, perspective, lighting, camera motion and parallax, preserve the source composition, and avoid static borders. The mask is analysis context only and is not sent as an editing input. Manual prompts receive the same underlying outpainting instruction.

Seedance preparation uses at least four seconds at 24–30 fps, looping shorter source segments without slowing playback. Outputs keep that prepared duration for later trimming. Durable editing jobs retain the original provider/key and recover after restart. Raw paid output is retained when finishing fails, and unknown editing prices stay explicitly unpriced. Seedance may regenerate the original scene or shift timing: restoring source pixels does not guarantee matching border motion or seamless joins. This integration has local/mocked regression coverage; generated outpainting quality needs shot-specific comparison.
