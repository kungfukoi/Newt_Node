# NewtNode Development Standards

Settings > Feature Usage shows this installation's node run attempts, palette additions and deduplicated recorded model operations, with 30/90-day and all-recorded-time counts, independent percentage weights, last-used dates and zero-use catalog entries. Node tracking starts with this feature and never reconstructs historical node activity from model history. A batch Run counts once; failures/stops remain attempts. Passive nodes are assessed through palette additions, excluding imports/copies/reloads/undo. Model coverage is retained history plus durable accounting, including its existing limitations and historical labels. Niche (<5% share), Active, Inactive in period and No recorded use are advisory signals, never automatic obsolescence or removal decisions. Local tracking stores no prompts, assets, workflow names or credentials, never submits provider work, and failures must not interrupt generation.

Video Outpaint exposes Show composited source, on by default. Checked routes the finished composite; unchecked routes the selected result's retained generated plate through the ordinary video output to Preview, Output, downstream nodes, download and drag. Raw generated plate labels distinguish original provider media. Saving the plate copies that complete retained file, including any provider handles, unless an explicit delivery conversion is chosen. It does not claim composite finishing or inherit the composite's original-source format conversion. The persisted choice never rewrites retained results, preparation, source-restoration settings or History and never submits generation or finishing. Comparison playback preserves the logical source-clock position and audio/playback settings; raw leading handles and provider/native clock differences are mapped for comparison. Results without a raw plate and crop-only results retain their ordinary viewer. Seedance outpaint prompts explicitly designate @Video1 as the sole editing master, limit edits to prepared extension/overlap, and restrict environment references to unseen details consistent with source lighting and object positions.

New BT.709 Seedance finishes may correct stable seam feature displacement when Auto Match is enabled. `server/outpaint-seam-registration.js` measures tangential gradient correspondence at multiple known inward depths, fits a time-constant translation/shear with strict temporal/depth agreement and ambiguity checks, and tapers the generated-only displacement spatially and at canvas edges. It never retimes, freezes or moves the original source. A managed lossless candidate must pass same-frame feature checks throughout delivery before use; unsupported or inconsistent edges retain their raw geometry. Original paid raw media and the alignment/validation evidence remain portable. All-repeat debug and legacy color plans keep their existing geometry. Color, motion, coverage and finished-boundary gates still apply after alignment; an improved connection is not a claim that lighting, unseen anatomy or the entire scene has been repaired.

New Video Outpaint preparations explicitly convert the canvas and conditioning MP4s to limited-range BT.709 SDR H.264, including actual YUV matrix conversion and matching color tags. Generation padding is written in the correct matrix so #00FF00 remains green after decoding. The saved plan records the color pipeline and original source URL/container/codec. New finishes composite in that same BT.709 space and produce one complete high-quality H.264 MP4 with the original delivery frame count, rational frame rate and audio. Output owns delivery conversion: for these results, Same as original source resolves the retained original local asset, copies a matching MP4 unchanged, or converts the complete finished clip to the original container and supported codec/profile. Preview and saving use the same target extension. Unsupported source codecs fail with an explicit format choice instead of silently substituting. Converting back does not recreate precision absent from the MP4. Legacy prepared/raw results retain their existing color/ProRes interpretation; explicit Prepare adopts the new pipeline without silently rebuilding saved canvases.

Outpaint finishing carries the source YUV matrix through RGB extension matching, converts both branches into that common matrix before overlay, and tags matrix/primaries/transfer on the ProRes master. Tagged BT.709 sources stay BT.709; unspecified legacy sources retain the conventional 601 path. An RGB round trip must not silently encode generated pixels with a different matrix from the restored core. Colored-media regression checks cover the source and extension independently.

Video Outpaint timing alignment weights changing source pixels and checks the active action independently of static backgrounds and held tails. Per-frame action matches record offset range and missing frame handles. Nonuniform timing or a correction requiring nonexistent source handles holds Output; never freeze, interpolate or invent delivery frames to claim exact correspondence. Original frame indices, rational rate and audio remain authoritative. Seedance source-restored finishes are first rendered as managed dependencies and checked at native pixel spacing across every finished seam before a checked master can replace Output. Explicit all-repeat debug delivery retains its existing exception. Match extension color fits bounded, spatially varying RGB offsets along each seam from corresponding overlap patches, with sufficient per-patch support and a time-constant fit. Unsupported patches do not receive an invented fit. Original source cores remain opaque. These measurements cannot guarantee a generative model's unseen geometry or repair a performance it has changed.

Canvas shadows are controlled in Settings > User Preferences, default on, and apply immediately across open windows. The preference affects node/group shadows and selected-wire glow while preserving selected borders and wire colors. Zooming must not abruptly switch shadows at 12–14% or toggle a forced canvas compositor layer. Keep the left toolbar stable and its menus usable during canvas navigation; retain the leaf-only grid update path and all full-detail node content.

Text Agent's User prompt treats Enter and Shift+Enter as text formatting. Typing must never submit a request; use the Send button to submit that field.

File drops/uploads reuse a byte-identical file already inside the current workflow package's inputs tree. Verify content rather than names, keep the existing managed URL, and do not modify the original. Different contents require a new managed file even when names match; imports without a matching managed input are copied into managed storage rather than linked to an external path.

Preview groups expanded batch entries by connected producer/output port and exposes the full result list in its thumbnail browser. Selecting a result on the producer updates Preview even if Preview saved an older index; selecting a Preview thumbnail updates the real producer, never a synthetic batch-entry node. Existing batch outputs must be browsable without rerunning generation.

Connection wire colors follow the current source output port, including Prompt outputs carrying private batch context. Normalize stale saved colors when loading or changing graphs; connection direction must not change the completed wire's type color. Existing selection and inactive-state highlights remain separate visual states.

Resizing a node normalizes automatically laid-out text fields to the available interior height. Text Agent's Response and User prompt fill its available interior together; a draggable, keyboard-accessible divider determines their relative sizes and persists its ratio across node resizing and reload; Batch progress/result footers keep their natural height on every node. Explicit textarea resizing remains a separate saved mode. Saving/reloading automatically sized nodes must not restore stale measured field heights as fixed inline sizes.

Preview video result thumbnails are passive lazy still posters, not one video element per saved result. Keep original video URLs in selection/drag payloads and use actual video elements for active playback. Missing posters fall back to a film placeholder, never another thumbnail player. Canvas motion must draw in the animation frame that computes its viewport; do not queue a second presentation frame. Preserve the existing easing, momentum, reduced-motion and saved preference behavior.

Project controls belong to the left node toolbar above its Nodes header. Recent Projects, File, Save, New and Presets icons sit above the directly editable workflow-name field. File sits between Recents and Save and owns New canvas, Open, Save, Save As, Rename and Import. Name edits update the current workflow through its existing project-name state; Enter finishes editing and Escape restores the name from focus entry. Rename focuses/selects that field. There is no full-width menu row or separate menu collapse tab. Collapsing the node toolbar hides its project controls too; the canvas-edge palette tab restores both. Panel visibility remains persistent. Preserve unsaved-change guards, portable package actions and keyboard Save/Save As. Menus support arrows, Home/End, Escape with focus restoration and outside-click dismissal. Popovers must escape the node-list scroll area without clipping. Canvas coordinates and media sizing remain owned by their existing paths.

Batch creation is available only in the contextual selection bar for two or more compatible media nodes (all images or all videos). Hide Batch from the node panel and the right-click add-node menu, while preserving its registered type and saved workflows. Single-node, non-media and mixed-modality selections do not expose the Batch action.

Running a node executes only that node and consumes existing connected results. Never refresh, generate, or refinish upstream nodes implicitly, including batch Text Agents and unfinished Outpaint sources. Run upstream nodes explicitly to populate missing results. Run All executes the selected runnable nodes in dependency order. Pending collection context still propagates through the Text Agent's ordinary Prompt output; unavailable batch entries fail without upstream submission. Explicit failed-entry retry retains its captured prompt/media pair.

Text Agent media batches start each entry with an empty conversation and no current prompt. The shared user instruction and any entry direction are applied independently to that entry's media; saved single-agent history and other entries' responses are excluded. Keep the shared instruction available for explicit reruns. The normal Prompt output privately pairs each original image/video with its generated prompt. Run All completes the entire upstream node before starting dependent nodes; entries within each node remain concurrent under the existing admission limits. Migrate saved special Batch-output wires onto normal outputs and use each paired entry prompt instead of the aggregate response. Retrying an entry retains the other pairs and source order. A fresh run clears prior batch results before publishing current checkpoints; empty or failed runs must not expose previous prompts as current results. Normal output ports and wires survive empty/running/failed states; batch processing never adds a second media output.

Video Outpaint batches share one framing configuration across all sources. Explicit Prepare creates a separate canvas/mask for each entry and caches it by source/canvas URL. If no frame was edited, derive one normalized frame from the first source and reuse it for every entry, including videos with different dimensions. Run selects the matching cached preparation; it does not silently rebuild canvases. Canvas Edit continues to set the common frame. Stop prevents further queued preparations and preserves completed caches.

Batch audition (`4.27.0-beta.0`) is a passive, single-modality image or video collection with live upstream media wires and/or managed dropped files. Selection → Batch preserves source nodes. Remove disconnects membership without deleting the source. Existing entry order is preserved, with no move arrows or file/selection buttons in the container. Thumbnails use contain sizing and distinct caption/remove regions at default and custom node sizes. Optional per-entry prompts remain keyed to source node/output port or uploaded-entry UUID. Batch outputs connect wherever their image/video kind is accepted, preserving model-specific input enablement and setup/preparation requirements. Runnable consumers get isolated per-entry graph inputs and state; standard node generation counts still apply inside each entry. Up to three entries run concurrently, reduced for local GPU/media work or stateful processors; existing server admission limits apply. Preview, Timeline and Composer receive all collection members through their normal media controls. Processed image/video collections travel through each node's normal media output. Text/Text Agent processing retains original media paired with generated per-entry prompts behind its normal Prompt output. Downstream execution privately supplies the matching media through an active, compatible normal input; no additional wire or port is required. Multiple Batch inputs pair by index with equal lengths, broadcasting singleton inputs; no implicit Cartesian product. Preserve result order and per-entry source identity, checkpoint partial results, allow explicit failed-entry retry, and preserve completed results on Stop. Accepted cloud work may still finish. Reloaded interrupted batches show an interruption notice and never automatically resubmit. Standalone text/CSV collections and Cross UI are outside this audition.

Kling 4.0 Image-to-Video uses the explicitly selected Video Model provider (Fal or Atlas Cloud). Start Frame is required, End Frame optional, and Middle Images accepts up to eight images in connection order. Duration is 3–30 whole seconds; aspect ratio follows keyframes. Fal supports native 720p/1080p; Atlas also offers clearly labeled ESR enhancements. Director, Character and audio/video references are unsupported. No provider audio toggle is exposed. History records the route, settings and managed output; Stats uses provider evidence or an explicit unpriced state. See [Kling 4.0](kling4.md).

James Fisher's October 2026 interaction additions are integrated: CorridorKey has separate Install/Run controls, installation status, estimated stage/window progress with elapsed time, local run logs, and job-specific cancellation. New nodes default to the 8-frame memory mode; explicit saved values remain unchanged. Cancellation waits for the owned engine process to close; installation itself is not cancellable. Saved-workflow/port/result identities remain unchanged.

Canvas wheel zoom eases toward the pointer and background dragging can glide. Trackpad scrolling pans; Shift+wheel pans horizontally. Settings > User Preferences exposes mouse wheel behavior, smooth canvas motion and hover video scrubbing; these choices save and apply immediately, retaining existing browser preferences. Reduced-motion preferences disable easing/glide. Settle motion before node/wire gestures. React Flow remains the viewport/edge owner. Clicking a wire selects it visibly for Delete/Backspace. Hover scrubbing applies only to paused controlled node videos, excludes their controls, and does not drive Timeline playback.

Workspace recovery remembers the active tab, panel visibility and complete canvas draft. Each browser window has its own server recovery slot (20 most recent), with ordered revision-checked atomic writes and browser backup. Reload preserves that window's draft; a fresh window restores the latest recovery. Recovery is not a replacement for Save/Save As or portable workflow packages. Save failures are visible with retry. The reload button saves recovery before reloading and detects a changed locally built frontend; it does not install GitHub updates. See `james-integration.md`.

Video Outpaint exposes three persistent image slots with independent input ports, automatic source filenames, and Appearance/Environment/Wardrobe roles. Analysis and generation compact connected slots in slot order while keeping their roles paired, including repeated image URLs. Legacy shared-input wires migrate in order when there are up to three; larger legacy bundles remain intact. Names follow connected files; roles persist independently of canvas preparation.

Video Outpaint retains the last prepared canvas across settings edits. Analyze and Run reuse its files and geometry; Prepare canvas & mask and Canvas Edit Apply & prepare explicitly rebuild it. Pending canvas settings are labeled. Reference roles and finishing-only options apply without rebuilding. Source/model changes or missing saved assets require explicit preparation, never silent regeneration. Older nodes can recover preparation from their most recent result. The collapsed Advanced section contains Canvas repeats, Restore source, Match extension color, Local finish and Blend width. Restore source and Match extension color default on; explicit saved off values remain off.

Video Outpaint drafts and positive submission prompts begin with `Full frame <scene description>`, describing the completed first-frame scene before observed action. Analysis privately inventories every intersecting person, limb, garment and prop as well as background coverage. Generation wrappers omit colored-padding instructions, region headings, pixel rectangles, outward-generation commands and lists of unwanted transitions. Source placement, anatomy attachments, appearance references and observed motion remain preserved. Wan retains its separate negative prompt. Re-analyze existing drafts after updating; saved user text is not rewritten.


Video Outpaint permits the same image asset in multiple reference slots, such as Environment and Wardrobe. Preserve slot order, numbered prompt references and roles through provider submission; do not collapse these slots by URL.

Production launcher sessions shut down 15 seconds after the last connected app window closes. Refresh/reconnection cancels pending shutdown; minimized/background windows remain connected, and closing one of several windows does not stop shared work. Shutdown stops both supervised servers and their owned process trees (including local media/GPU helpers), without crash-restarting them. WSL MiniMax services are stopped only when NewtNode observed them inactive and started them in this supervisor session. Independently running ComfyUI/inference services and already accepted cloud jobs are not canceled. Development/headless sessions are not stopped by browser closure. Reopen through the launcher after shutdown.

CorridorKey first-use setup belongs to the server job, with visible stages and retryable errors. Supported Windows NVIDIA systems install missing Python, packages, engine and weights automatically. Unsupported platforms/drivers fail before downloads. macOS explains that this Python adapter requires CUDA; the separate commercial Mac runtime is not integrated.

This is a living standard for NewtNode. It describes the current conventions for nodes, UI, media flow, backend routes, cost tracking, and verification. Amend it when the app deliberately changes direction. Do not bypass it casually.

Documentation audited against checkout version `4.5.0-beta.0` on 2026-10-15; see [audit scope and evidence](documentation-audit-2026-10-15.md). Runtime source and tests expose the current implementation; this document defines the intended durable contract. Resolve drift in the same change that discovers it.

Before starting any new feature, read this document first. If the feature changes a core workflow, update this document in the same change so the next feature starts from the current truth.

## Goals

Preview playback controls must never start node movement. If native media controls consume a mouse release during a node drag, the next movement with the left button released ends the gesture before moving the node. Escape and window blur also release it through React Flow's normal drag-stop path.

Timeline live viewers retain their last displayed image until its replacement has decoded. Pending preview frames are coalesced rather than accumulated, and stale callbacks are discarded on source changes/unmount. Playback holds the complete previous composition while any active visible layer seeks/loads, preventing lower-layer flashes; real timeline gaps remain black. Canvas buffers resize only when composition dimensions change. Timeline timing, edits, hidden tracks and export sources are unaffected.

Canvas Stop applies the same server-side durable-job dismissal to Video Model and Utility Video Outpaint nodes. Outpaint batches share a generation group and include batch indices/totals in tracked requests, so stopping during preparation also blocks later acceptance of that group's requests. Recovery polling must not resurrect dismissed jobs or replace results after Stop. Stopping local tracking does not promise cancellation or a refund for a cloud job already accepted; a new explicit Run uses a new group.

Seedance Video Outpaint duration is automatic. The node has no Duration input: saved manual durations cannot truncate new submissions. Preparation reads the actual source frame count (decoding to count when needed), takes every remaining frame from the frame-aligned Start, then repeats that complete segment. A 94-frame shot repeated twice contains 94 + 94 source frames before the provider guard tail. The provider clock remains supported by Seedance; source frames are assigned to it one for one, with no frame dropping or interpolation. Finishing returns the same frame indices to the original exact frame rate, including fractional rates such as 24000/1001, with common overlay timestamps so restoration cannot slip a frame. Original audio repeats on the original source clock. Prepared metadata and results record both clocks/counts; v17 fingerprints invalidate old shortened preparations. Old raw results reprocess using their retained original counts rather than being reinterpreted as full-source generations. A read-only source frame/rate/duration summary replaces the Duration control. Over-limit inputs fail locally and require fewer repeats or an upstream trim.

Explicit full-repeat debug outputs may flow to connected Output even when source/coverage checks flag defects: preserving those defects is the requested diagnostic behavior. The result retains its debug warning and full check report; it is not labeled as a verified quality pass. Normal final-copy results retain the existing rejection gate.

Video Outpaint exposes the standard Generations selector (1–4) through persisted `batchCount` and the shared Utility batch runner. Each requested generation produces its own result/history entry; existing result selection and partial-failure behavior apply. Canvas repeats controls copies within each generation independently of this count.

Seedance Video Outpaint exposes Canvas repeats, an integer total-copy count defaulting to 1. Preparation repeats the selected moving shot at its original frame rate before the held guard tail. Keep all repeats (debug) currently defaults on: repeated submissions deliver every copy from frame zero plus the held guard tail, repeating the original restored picture/audio across copies and checking correspondence/coverage across the full submission. Timing alignment is disabled for this debug output to preserve frame zero. Disabling debug restores final-copy-only output. Both settings persist in preparation/history. Requests exceeding 30 seconds including guard and frame-grid padding fail locally before provider submission. Wan ignores these settings. Longer inputs increase paid generation duration. Debug output can retain the unwanted fill animation for inspection.

Seedance 2.5 Edit and Video Outpaint support the explicitly selected Fal, Atlas Cloud or Krea provider. Krea's public API infers editing from an in-place edit prompt and reference_videos, preserving source duration and aspect ratio internally; no unsupported task flag or auto enum is sent. The source duration is measured, schema-valid ratio/duration values are provided, and prompt enhancement stays off. Seedance 2.5 Krea requests omit deprecated generate_audio; Generate Audio still controls local delivery stripping. The exact submitted prompt, selected credentials, durable recovery and separate draft limitations remain intact. Krea edit costs are explicitly unpriced until provider usage is available. Missing selected keys never trigger a provider fallback.

Seedance Video Outpaint uses chroma green (#00FF00 / RGB 0, 255, 0) in the submitted video's outer padding and authorized inward overlap. Analysis identifies conditioning regions privately; generation prose describes the completed scene without padding colors or replacement commands. The original moving picture, timing, repeats, source restoration and provider remain unchanged; the original black-padded canvas stays local for correspondence checks. Seedance receives no mask or frozen first-frame image. New preparation fingerprints invalidate cached black/gray conditioning. The border check flags retained green padding with encoding tolerance and still supports historical gray/black plans. Wan retains RGB 127 conditioning. This color cue does not guarantee selection or first-frame fill.

CorridorKey 2.0 is a Utility Video model, not a separate catalog node. Legacy `keyer` nodes migrate to `utility` with stable node/port IDs and saved settings/results. The existing Cutout, Matte and Foreground ports retain their identity. Model changes map the primary source/output ports where compatible and prune unsupported auxiliary wires. Extract Frame, Wan VACE Mask-to-Video and Wan VACE 14B Inpainting are retired Utility models: hidden in pickers/preferences, disabled in the UI and rejected by the Utility video endpoint, with saved results preserved. Timeline extraction and the distinct Wan 2.2 VACE Inpainting model are unchanged.

Utility’s CorridorKey 2.0 option invokes a separately installed CorridorKey 2.0 CUDA engine. Source footage and matte hints enter through input ports only; no upload picker or uploaded-source fallback is used. A persistent Video disclosure above Model collapses the viewer/configuration while keeping input/output ports and Run available. Optional first-frame image and full-video matte hints are enabled only in the selected hint mode. Automatic, 8-frame and low-VRAM 4-frame settings preserve the explicit upstream route. Viewer tabs do not change output identity: Cutout, Matte and Foreground always resolve the selected run's corresponding pass. Cutout is silent ProRes 4444 straight RGBA; preview passes are display-referred video, not HDR/EXR. Input is display-coded sRGB/Rec.709. Engine paths remain server-local; source/hint/pass URLs and settings remain portable workflow assets. Background job polling and reconnect never resubmit inference. One Keyer job runs per backend; reported stages/windows are real, not percentage estimates. Failed jobs preserve previous results; completed local processing records zero provider charge with hardware/electricity excluded. See `keyer.md` for setup, limitations and upstream licensing.

Seedance source restoration checks temporal correspondence against the original prepared picture before overlay. A local low-resolution comparison searches within half a second of the planned trim. It adjusts the generated trim only when all three shot segments agree within one frame, the match error is low, and it improves at least 25% over the nominal trim. Static or inconsistent evidence keeps nominal timing. Source timing/audio and delivery frame count stay unchanged; generated frame coverage is required. History retains matching.temporalAlignment including the applied frame offset. This is deterministic timing alignment, not paid QC or generation; spatial deformations remain model limitations.

Utility Video Outpaint has a green video input `canvasVideoIn` beside the Canvas row. A connected canvas overrides generated framing and can be used without a source connection. It must be 9:16, 16:9 or square with rectangular black outer borders. Local crop detection unions picture bounds across the selected shot; internal dark objects are not holes. Preparation preserves the supplied framing, derives white generation masks including the inward Blend Width, and restores only the detected original picture. Seedance and Wan retain their existing conditioning and timing policies. Disconnecting Canvas restores the saved source framing. The prepared fingerprint includes the Canvas URL; switching/replacing inputs invalidates preparation. Health-gated clients reject older backends rather than silently ignoring the Canvas input.

Wan Outpaint wraps every editable prompt with a completed-scene caption naming the actual expanded sides and requiring complete coverage from frame one. It removes Seedance media tags, preserves the user's scene direction, and adds persistent transition/unfilled-area negatives. History stores original and submitted prompts separately, the actual negative prompt, and conditioningVersion. Health exposes videoOutpaintWanConditioning so the running backend can be verified after restart.

Wan VACE Outpaint prepares a separate neutral-gray (RGB 127) conditioning video wherever the white generation mask applies, including the inward Blend Width overlap. Its black-padded original remains available for analysis and source restoration. The provider receives the gray conditioning video and matching mask with preprocessing disabled because preparation is local. A static analysis matte enables reference-aware frame inspection for Wan too, using the complete prepared Wan frame count without Seedance preroll. Wan Analyze drafts descriptive completed-scene captions rather than Seedance editing commands. Wan submissions retain user negatives and add black-bar/unfilled-region/transition negatives. QC remains disabled; paid generation quality must be visually verified.

Video Outpaint currently keeps QC disabled while generation behavior is evaluated. Normal Seedance submissions use a concise edit instruction, scene-specific user direction, and a short preservation instruction. Pixel coordinates, restoration rectangles and feather widths stay in local preparation/finishing metadata, outside the model prompt. Analyze drafts describe the missing regions and supported continuation without compositing instructions. This prompt experiment does not change source timing, framing, provider, resolution or finishing.


Character Sheets lists completed image and CU video sheets separately, including Base Identity and each wardrobe. Completed sheets remain viewable during generation. Wardrobe images checkpoint into the library before the matching CU request finishes so a slow or failed CU request does not hide a completed image.

Adding wardrobe references to a locked Character automatically unlocks it and starts Generating. Current base and wardrobe sheets are reused; missing wardrobe image and enabled CU Video sheets are generated through the existing checkpoint flow. The Character locks again when the batch finishes, with partial failures reported in its notice.

The image editor enters Object Selection without submitting inference. Scan image for objects in the right panel starts an explicit SAM 2 scan; defaults are 32 × 32 sampling and 0.75 confidence. Save selections and boxes creates an Image Selection node with visible boxes and @tags, plus portable PNG metadata containing descriptions, coordinates and exact source masks. Image generation reads the embedded metadata and includes tag mappings in model prompts; guide graphics must not become output artwork. Done saves selected/subtracted regions, brush selections, boxes, drawing marks, prompt and edit method locally by image content identity and closes without a discard prompt. Reopening restores the draft without paid work. Done with empty regions clears the saved selection. Draft records remain local; exported PNG records travel with managed workflow assets. Ideogram box operations must allow scene-wide cleanup and destination integration beyond object footprints; explicit Keep boxes remain protected. Hidden instructions cover move/removal/replacement effects, relighting, contact/cast shadows, reflections, natural edges, occlusion and source reconstruction.

Storyboard now follows upstream directing skill 2.2.0 for independent plans:
Auto selects the needed panel count; explicit counts must match exactly. Approach,
pacing and optional duration guide planning. Generate Missing only fills panels
without an image; completed panels require explicit Run or Regenerate Selected.
Replacing a plan requires confirmation and cannot replace protected panels.
Cast fingerprints prevent manual camera/prompt edits from inheriting stale
hidden blocking. Connected Character inputs work with monochrome rendering.
Idle panels can be edited, selected, protected or restored while another renders;
queued/active panels remain immutable. Exports and new paid work wait for the run.
Our Director input, legacy uploaded characters, ports and saved responses remain
compatible. See [Storyboard upstream comparison](storyboard-upstream.md).

- Keep every node predictable to build, use, save, load, preview, run, and debug.
- Preserve a clean canvas by default, with advanced controls hidden behind Settings.
- Make media types explicit so connector lines, ports, previews, stats, and backend routes stay in agreement.
- Track generation cost honestly whenever the app can estimate or record it.
- Prefer small, compatible changes over one-off node behavior.
- Keep saved workflows portable enough that another user can open and run a packaged graph from a shared drive when the needed assets are included.
- Keep runtime configuration, update, and restart behavior local, visible, and cross-platform.

## How Agents Must Use This Standard

Before implementation:

1. Read `AGENTS.md`, this document, `architecture.md`, and `development.md`.
2. Inspect the current branch and dirty worktree. Preserve changes not created for the task.
3. Identify the internal node type, persisted fields, port ids, routes, result types, and compatibility names involved.
4. Complete the feature-impact audit below and find the current owner in the code-ownership map.
5. Read the closest tests and representative old workflow normalization before editing.

During implementation:

- Extend an existing contract instead of creating a node-local result, request, storage, preview, or persistence shape.
- Design old-workflow normalization before renaming or removing persisted data.
- Keep reusable behavior out of `NodeEditor.jsx`; move pure logic into a focused owner and test it there.
- Treat frontend, backend, persistence, history/Stats, progress, error states, and documentation as one feature when the change crosses those boundaries.

Before completion:

- Run the validation tier in `development.md` plus the relevant checks at the end of this document.
- Inspect the final diff and worktree for credentials, generated files, machine paths, and accidental runtime data.
- Update this document when a durable rule changed and update `architecture.md` when ownership or data flow changed.
- Do not commit, merge, pull, push, switch branches, or discard work unless the user explicitly requests it.

## Current Product Snapshot

- Editable model prompts preserve whitespace as typed, including trailing and repeated spaces. Prompt composition and request normalization must not trim the value displayed in an editable field.

- Canvas node copy/paste uses native clipboard events so selections can move between workflows and app windows without clipboard-read permission. Incoming node clipboard data takes precedence over older local storage; local storage and memory remain fallbacks. Text controls retain normal text copy/paste.

- Timeline media bins accept successive video drops and all results from connected multi-video outputs. Connected batch entries retain independent result positions; legacy single-result connections use position zero. The bin’s right-edge divider resizes its width in canvas coordinates and saves it with the timeline.

- Widening the Timeline media bin adds columns of fixed-width thumbnails rather than enlarging media. Items fill columns in order, retain their aspect ratios, and wrap back into fewer columns when narrowed.

- Deleting or disconnecting a Timeline input removes its linked media, associated timeline clips and derived audio. Other connected sources retain their bindings and edits; directly dropped media remains independent.

- Timeline offers Include audio beside Render, enabled by default for new and older workflows. The setting persists with the timeline and controls rendered outputs only. Enabled renders mix unmuted audio tracks and embedded video audio; disabling it writes a video without an audio stream. Preview playback and track mute settings remain independent.

- Timeline render requests carry the audio setting explicitly. FFmpeg normalizes audio clips to 48 kHz stereo and rebuilds timestamps from sample counts before and after mixing so source time bases cannot corrupt the output audio stream.

- Preview Layout Export copies every collected image and video in Layout order into a new folder beneath the selected destination, including video-only Selects. Export preserves original video files without transcoding.

- Coverage checkpoints each completed angle into the node and refreshes output history during the batch. Completed images remain visible if later angles fail or the run is stopped; stopping prevents submission of remaining angles.

- Canvas groups repeat their editable name inside the upper-left corner in a large label. Compact up/down arrows beside the group name adjust label size in 8-pixel steps from 24 to 320 canvas pixels (64 by default), without a visible size caption or numeric field. The size persists with workflows and copied groups, and follows the React Flow zoom transform.

- Utility Video / Video Outpaint uses Seedance Edit in the Outpaint model field directly below Model. Seedance reuses contextual source/mask analysis, sends only the padded source to its selected Fal/Atlas/Krea editing route, and uses durable job recovery with managed raw/finished results. Its single Resolution setting controls Seedance processing-canvas, generation and export size (480p/720p/1080p; default 1080p), with no Auto or separate delivery size. Its model submission uses at least four seconds and source fps clamped to 24–60, holds the selected shot’s last frame for padding, and adds a half-second generation guard when needed. Delivery is trimmed to the real selected source frames/audio, without repeating or freezing delivered frames; generated coverage shorter than delivery rejects. Wan-only steps, guidance scale and negative prompt are replaced by Seedance resolution controls. Provider editing costs remain unknown unless verified. Every Seedance request includes source-preserving scene-extension instructions; source restoration is optional and cannot guarantee temporal alignment when the model changes motion. It accepts source video, optional reference image and optional prompt; mask preparation is automatic. The default 9:16 canvas fits the complete source centrally. Canvas Edit opens a modal with a draggable/resizable frame locked to the selected target ratio; the frame may extend beyond the source. Its normalized source-relative coordinates persist with the workflow. Video outside the frame is cropped and empty areas inside it are outpainted. Canvas Edit snapping defaults on and persists per Utility node; an eight-screen-pixel capture band and wider release band softly align frame edges/centers with clip edges/center, including ratio-locked corner resizing. Dashed guides identify active snaps and Alt bypasses snapping. Numeric and keyboard positioning remain precise. Snap preferences do not invalidate prepared media. Cancel/Escape preserve the prior frame; Apply & prepare saves it and regenerates local preview/mask assets. The same pixel-quantized source crop and placement drive preparation, analysis and final source restoration. Fully covered frames export locally through Export crop without a prompt or paid provider request. Prepare canvas & mask is local and exposes a contained video preview. Prepared assets invalidate when source or settings change. Manual generation prepares fresh dependencies automatically; Auto modes require preparation and keep the editable review step before Run. Duration defaults to the tested first 3.375 seconds, uses source fps rounded/clamped to 8–30 and an 81–241 frame 4n+1 segment; short source segments repeat at normal speed to fill the requested compatible frame count (at least 81 frames), including matching repeated audio for final restoration. Empty segments fail before paid work. The output keeps the extended duration; seamless loop boundaries are not guaranteed. Outpainting controls omit static explanatory notes, retain editable user guidance and actionable errors, and put disabled-analysis prerequisites in a tooltip. Original-source restoration defaults on with a 32-pixel authorized inward overlap for feathering and 1080p delivery. Finishing uses 10-bit 4:4:4 processing and a ProRes 4444 XQ MOV master; encoding cannot restore precision/detail missing from a provider result. Source audio is retained for the selected segment. Raw paid results and cost are preserved if final composition/export fails, with an explicit warning. All derived assets use managed workflow dependencies/outputs and History/Stats retain source, geometry, prompt, provider, model, seed, native resolution and cost. Output routing and saved graph identifiers remain unchanged.

- Video Outpaint preserves the original core through an inward overlap feather. Optional Match extension color uses bounded paired-overlap RGB offsets constant through the shot; uncertain matches are withheld. Legacy Auto Match remains saved but does not enable this control. Aesthetic QC and AI review are off; local source-motion/coverage checks remain active and never resubmit inference. Refinish selected result processes the retained raw footage locally on its saved geometry and records zero new provider cost. Failed correspondence cannot replace an accepted Output, except explicit full-repeat debug output. A new explicit Run is required for a new fill. No check guarantees perfect reconstruction.

- Utility Wan VACE Inpainting offers Manual, Auto, and Auto + guidance outpainting prompt modes. Auto modes explicitly analyze the connected source video on its intended canvas and matching white-generate/black-preserve mask using Fal video vision. Analyze & draft prompt is paid text analysis only, recorded in History/Stats with workflow, node, provider, model and source/mask metadata. It never launches video generation. The resulting Prompt remains editable before Run; connected text prompts block replacement, and source/mask/mode/guidance/prompt changes during analysis preserve the current prompt. New nodes default to Auto + guidance; older nodes with a prompt retain Manual. The analysis controls do not pad or reframe source media.

- Video Outpaint exposes Seedance Edit and Wan VACE 14B (Fal). New Utility nodes default to Seedance; explicit saved Wan selections remain Wan. Switching engines invalidates prepared assets and preserves results, user framing and prompt. Wan uses its existing source-plus-mask video route, steps, guidance and negative prompt, with a 720p processing canvas and selectable delivery size. QC remains disabled for both engines. Legacy preparation/result metadata retains its original engine for safe timing interpretation; mismatched legacy raw footage cannot be refinished as Seedance.

- Seedance Video Outpaint preparation is local: it creates the full-resolution source canvas and a static PNG matte for local matching, prompt analysis and QC. It generates no mask video or Wan fill. Seedance stays in Edit Existing Video mode on the selected provider and receives only the source canvas plus user image references and contextual extension instructions. No matte media is sent to Seedance. Generation automatically runs fill, local color matching/edge finishing and final QC in sequence; there is no separate Local finish or Reprocess raw result button. Current QC policy forbids automatic video/image generation retries, even for incomplete fill, geometry or timing defects; one explicit Run submits one fill per requested batch item. Local matching/feathering and AI review remain active. A server guard rejects legacy automatic retry requests from older windows. Context-only guidance forbids unsupported new foreground objects/occluders at joins; review checks their evidence against the original. Native-pixel registration moves generated pixels only when overlap gradient correspondence supports a stable translation across the shot, and retains the baseline if the candidate worsens measured edges. The original core stays opaque.

- Video Outpaint keeps matching and Final QC diagnostics in result metadata and History, without rendering the diagnostic report, result-warning copy or raw-result link in its settings. Resolution and editable finishing controls remain available. A compact QC Status output directly below Resolution shows live finishing tasks, retry repair targets and the final pass/review state in at most a few lines; the detailed report remains hidden. QC processing and publication checks still run.

- Newly created Utility nodes start with their Image/Video settings drawer expanded. Saved workflows retain their existing drawer state. Composite Video places its Model selector and all layer settings inside the Video drawer. Collapsing the drawer hides those settings and keeps compact input handles available.

- Composite Video shows a local live thumbnail before rendering. Blend, mix, layer wiring and image/video masks (invert, blur and expansion) update the sampled frame immediately; muted playback and seeking preview video layers. Work is bounded to a 320-pixel thumbnail and approximately 12 fps, and playback pauses while hidden. The browser thumbnail is an approximation; Run creates the full-quality FFmpeg result, available through Rendered output, with existing downloads and preview actions. Live preview never replaces persisted results or submits a render.

- Composite layer and mask input dots start gray. Connected image inputs turn image blue and video inputs turn video green; colors follow the connected source without restricting either accepted media type. Still images remain visible for the first video layer's full duration, or default to five seconds when no video is connected.

- Utility Composite Video accepts 2–32 ordered image/video layers. Each layer has a dedicated media dot, optional image/video mask dot, blend method and opacity; masks support inversion, blur and expansion. + adds a layer and each − removes that layer and its connections, leaving at least two. Layer IDs remain stable when deleting another layer. Transparent images preserve alpha; complete media is fitted to the base dimensions without cropping. Output is a video following the first video layer's duration/fps/audio, or a configurable duration (default five seconds, 24 fps) for image-only stacks. Shorter videos hold their last frame. Legacy shared Video inputs migrate in connection order and legacy mask/mix controls belong to the former overlay layer.

- Edit Image Crop and the enlarged image editor share Normal, Fixed Size, and Fixed Ratio controls with video cropping. Fixed Size uses source pixels, Fixed Ratio uses source-aware proportions, and image editor undo restores the crop style alongside the region.

- Edit > Video > Crop offers Normal (freeform), Fixed Size (pixel dimensions), and Fixed Ratio (user-entered width:height proportions). All modes allow positioning; Fixed Size disables resize handles and Fixed Ratio constrains corner resizing using source dimensions. Its enlarged editor supports playback and frame seeking; settings persist with the workflow and produce an even-pixel local FFmpeg crop. Legacy centered pixel crops normalize using source dimensions.

These are durable current surfaces independent of the checked-out branch name:

- The Settings workspace is part of the app shell and owns local API keys, update repository, branch status, pull/update, and restart requests.
- React Flow is the active canvas runtime. Proxy, compact, and map render modes are currently disabled; complete node bodies and all edges remain mounted from the minimum 5% zoom through working zoom.
- Image, video, and text model runs expose per-node generation progress with queue, generation, download, finalization, batch, elapsed-time, and terminal states.
- The canvas exposes a red X beside Snap and zoom in the bottom-right controls to stop every active canvas node and cancel queued selected-node runs. Per-node Stop buttons are removed. Stop releases the canvas wait and preserves results; late callbacks cannot overwrite the ejected run. Durable video tracking is dismissed server-side and remains stopped after restart. Stop does not claim cancellation or refunds from a cloud provider, and already executing local media work may finish.
- Generation elapsed time must remain monotonic for the full run, including runs longer than three minutes, unchanged provider status, acceptance retries, and transitions into durable background tracking. A retry with the same run ID must retain its original start time. The latest terminal elapsed time remains visible on its node until that node submits another run; completion freezes the elapsed time rather than continuing to count.
- The File menu owns New, Save, Save As, Open, and Import. New and the New Project button start an untitled blank canvas with no nodes, edges, or groups at 100% zoom, through the same unsaved-change guard as Open and Import. Fresh sessions without a saved draft also start blank.
- Text Model defaults to GPT-5.6 Terra through Fal OpenRouter unless environment variables override it. Text Agent follows Settings > User Preferences > Text Agent Model: GPT-5.6 Sol (default) or GPT-6 Astra. Saving applies to subsequent messages through Fal, OpenAI, or Atlas Cloud; the preference is independent of Director and takes precedence over generic text-model environment defaults. Settings can route text processing through Fal, direct OpenAI, or Atlas Cloud. For Text Model, direct OpenAI and Atlas Cloud use the configured OpenAI text model, currently GPT-5.6 Luna by default. Connected videos still use Gemini 3.1 Pro Preview through Fal's native-video OpenRouter route because Atlas Responses does not accept native video. Director processing separately follows the User Preferences choice between GPT-6 Astra and GPT-5.6 Sol.
- Current Image Model labels are `Z-Image`, `Seedream 5.0 Pro`, `Nano Banana 2`, `Nano Banana Pro`, `OpenAI Image 2.5 Flare` and `OpenAI Image 2.5 Sunburst`, `OpenAI Image 2`, `REVE 2.1`, `Ideogram 4.5`, `Flux 3`, `Nano Banana 2.1`, and `Krea 2 Large`. New Image Model nodes prefer `OpenAI Image 2.5 Flare`, while `OpenAI Image 2` remains available as an explicit legacy selection. Current Video Model catalog labels are `Seedance 2.0`, `Seedance 2.5`, `MiniMax H3`, `Kling O3 Pro`, `Kling O3 4K`, `Gemini Omni Flash`, `FLUX 3 Max`, `Wan 2.7 Reference-to-Video`, and `Creatify Aurora`. New Video Model nodes prefer `Seedance 2.5` when it is enabled. Callable labels, enabled preferences, and workspace filtering remain owned by `src/modelOptions.js`.
- Utility coverage includes local media transforms, pose/depth/matte tools, hosted Wan/VACE and upscaling models, and local ComfyUI WanBlend/WanSegment/WanWarp workflows. SAM 3 options remain hidden while `sam3SegmentationModelsEnabled` is false.
- Stable node ids are the canonical graph identity. Visible titles and `@tokens` may change, but saved edges, reference bindings, Output routing, and dependency scheduling must continue to resolve by id.
- An attached Output node redirects generated files to its configured target without replacing the source node's playable result URLs or breaking Preview nodes after save/reopen.
- Workflow saves should stay fast: the client upserts the returned project summary, and the server rebuilds workflow indexes after the save response rather than blocking the write path.
- Multiple app windows reuse one backend per checkout/data directory, retain independent session drafts, and may submit distinct generation runs concurrently. Scope progress/results to the owning workflow; share provider admission limits across windows. Reject a second backend owner before opening job/history stores, including when custom HTTP ports differ. OS-held data ownership releases on normal exit or forced termination. Claim output filenames before asynchronous existence checks so simultaneous exports cannot collide. Concurrent editing of the same saved workflow still targets one document; use separate workflows for independent edits.
- App version displays derive from package metadata and update with the release bump; never hard-code a version in UI copy.

## New Feature Checklist

Use this quick pass before implementing a feature, and again before committing it.

- Read the relevant standards in this document first.
- Identify which surfaces the feature touches: node catalog, node data, ports, run order, backend routes, asset persistence, stats, saved workflows, and UI states.
- Use the code ownership map below before editing `NodeEditor.jsx`; prefer the focused helper modules for pure logic, persistence, media handling, and API calls.
- Prefer existing helpers and patterns before adding a new storage, request, preview, or result shape.
- Preserve existing saved workflows with normalization or migration when fields, ports, node types, or asset URLs change.
- Keep generated files and copied dependencies inside the current workflow package when a package is attached.
- When a frontend/server change affects startup, routing, or lazy assets, run `npm run smoke:app` with the dev server running in addition to tests/build.
- Update this document when the feature intentionally changes one of these standards.

## Feature Impact Matrix

Audit every applicable row before declaring a feature complete.

| Change area | Required surfaces to inspect |
| --- | --- |
| Node type or control | Catalog/icon, config, defaults, normalization, UI body, resize, CSS, empty/disabled/error states, tests |
| Ports or references | Port ids/colors, compatibility, auto-connect, edge normalization, handle measurement, dependency order, `@` bindings, copy/import |
| Provider or model | Stable label, enabled-model Settings, credential/provider routing, capability-specific controls, request builder, validation, response normalization, progress, failure diagnostics |
| Generated or derived media | Managed local persistence, result items, selected index, Preview, output rail, download, drag/drop, downstream connections, save/reopen |
| Paid operation | Provider/endpoint/model metadata, duration/resolution/input counts, reproducible settings, cost or unpriced state, history, Stats |
| Workflow persistence | Current document shape, old normalization, Save As, autosave, Recent, package identity, asset rebasing, missing-file behavior |
| Canvas or geometry | React Flow ownership, live resize/drag, handles/edges, selection, text editing, pan/zoom, 5/8/30/100% checks, large graph behavior |
| Backend or control route | Input/schema validation, route owner, API wrapper, health capability, smoke test, timeout/cancellation, small response shape |
| Filesystem or desktop action | Path containment, filename sanitation, managed roots, Explorer/Finder/dialog parity, Windows/macOS launch/restart/update behavior |
| Heavy UI or dependency | Focused module/component, lazy boundary, package files, dependency preflight, production bundle report |

## Refactored Code Ownership

`NodeEditor.jsx` remains the canvas/UI orchestrator, but new work should not default to adding more pure logic there. Keep reusable logic in the smallest existing module that owns the concern.

| Area | Primary files | Standard |
| --- | --- | --- |
| API clients | `src/api/newtApi.js` | Add browser-side route wrappers here instead of scattering raw `fetch` calls. |
| App shell and Settings | `src/main.jsx`, `src/SettingsPage.jsx`, `src/api/newtApi.js`, `server/routes/core.js`, `server/index.js` | Lazy-load Settings from the app shell. Keep settings API wrappers in `newtApi.js`; register Settings, update, restart, health, and storage routes through `server/routes/core.js`; keep runtime config implementation in `server/index.js`. |
| Node registry | `src/nodeRegistry.js`, `src/NodeEditor.jsx` icon map | Add catalog definitions in `nodeRegistry.js`; add only the display icon mapping in `NodeEditor.jsx`. |
| Node config/defaults/normalization | `src/NodeEditor.jsx` | `getNodeConfig`, `createDefaultNodeData`, and `normalizeCurrentNode` still live here. Keep backward-compatible migrations close to these functions until they are deliberately extracted. |
| Run scheduling and result state | `src/nodeRunner.js`, `src/nodeRunners/*` | Batch counts, batch result aggregation, selected-node dependency scheduling, and run status text belong in `nodeRunner.js`. Node-specific API runners and reusable request/result builders belong in focused files under `src/nodeRunners/`. |
| Generation progress | `src/generationProgress.js`, `src/generationProgressStore.js`, `src/components/GenerationProgress.jsx`, `server/generation-progress.js` | Build run metadata and aggregate batches in the client helpers, poll through the shared store, render the accessible node progress bar in the component, and keep request-scoped provider state in the server module. |
| Media drag/drop and imported asset shape | `src/mediaAssets.js` | Output-rail drag payloads, external file type detection, file-to-node mapping, and media accept rules live here. |
| Result items | `src/mediaResults.js` | Normalize, append, label, and download result items here. Do not hand-roll result array merging in node run branches. |
| Character sheet library | `src/characterSheetLibrary.js`, `src/characterVideoSheets.js`, `src/NodeEditor.jsx` | Keep generated/custom sheet identity, normalization, selection, and downstream reference resolution in the focused helpers. `NodeEditor.jsx` coordinates upload, generation, removal, and display only. |
| Character generation workflow | `src/characterSheetWorkflow.js`, `src/characterWardrobeGeneration.js` | Checkpoint successful base and CU Video sheets independently. Keep base signatures, wardrobe edit source selection, partial retry, and image/video variant preservation in these helpers. |
| User-created Newt Presets | `src/newtPresets.js`, `src/useNewtPresets.js`, `src/components/NewtPresetDialog.jsx`, `server/newt-presets.js`, `server/routes/newtPresets.js` | Capture only selected nodes, internal edges, and complete groups; strip credentials and transient jobs; copy durable media; remap every inserted ID; and expose optional typed reusable inputs. Keep this user library independent from any future bundled/system preset catalog. |
| Output routing and tokens | `src/outputConnections.js`, `src/outputTokens.js`, `server/outputTargets.js` | Keep accepted source kinds and browser token insertion focused in `src`; keep path expansion, unique-file reservation, and external-output URL encoding server-side. |
| Cross-workflow clipboard | `src/workflowClipboard.js`, `src/workflowState.js`, `src/nodeGeometry.js` | Serialize selected graph fragments, remap copied ids and bindings, and place pasted selections through these helpers. |
| Node identity and `@` references | `src/nodeReferences.js`, `src/workflowState.js`, `src/NodeEditor.jsx` | Treat node ids as canonical identity. Keep reusable mention parsing, binding, and visible-token rename helpers in `nodeReferences.js`; remap ids and bindings in `workflowState.js`; let `NodeEditor.jsx` coordinate bindings with live node/group state. |
| Model, utility, and edit options | `src/modelOptions.js`, `src/editEffects.js` | Model names, preset names/prompts, aspect ratios, duration/resolution lists, utility descriptions, model-control option lists, and Edit node effect definitions live here. Keep labels stable because saved workflows and UI normalization rely on them. |
| React Flow canvas | `src/components/NewtFlowCanvas.jsx`, `src/components/NewtFlowContext.jsx`, `src/flowOverview.js`, `src/flowNodeInteractions.js` | React Flow owns viewport transforms, node movement, selection, handles, and edges. `flowOverview.js` owns the disabled overview-mode feature flags; `flowNodeInteractions.js` owns dynamic no-drag boundary discovery so controls and media drags are not captured as node movement. |
| Canvas chrome | `src/components/CanvasChrome.jsx` | Shared canvas overlays, selection actions, and workflow prompt UI live here. Keep hot drawing and UI chrome out of `NodeEditor.jsx`. |
| Preview/result UI | `src/components/MediaViews.jsx`, `src/components/Model3DViewer.jsx` | Shared previews, result panes, project output drawer, output lightbox, lazy output-rail media loading, and the lazy 3D viewer wrapper live in `MediaViews.jsx`. The actual GLB renderer lives in `Model3DViewer.jsx`. |
| Shared image adjustments | `src/imageAdjustments.js` | Curves, brightness, contrast, and saturation normalization and pixel math are shared by Preview/Layout and Edit. Do not maintain separate implementations that render the same controls differently. |
| Small node bodies | `src/components/NodeBodies.jsx` | Plain Text, Text Model, Text Agent, upload media, and Composer summary bodies live here. Preserve their prop-driven behavior and class names when extending them. |
| Composer/camera 3D UI | `src/components/ComposerViewport.jsx`, `src/components/CameraControlViewport.jsx`, `src/composerState.js`, `src/composerRender.js` | Interactive Three.js viewport shells for Composer and Camera live in the component files. Composer defaults, normalization, saved pose fields, and image plane helpers live in `composerState.js`; Composer Three.js rendering and mannequin asset loading live in `composerRender.js`. Composer pose preset API wrappers live in `src/api/newtApi.js`; backend pose-library persistence lives in `server/routes/composerPoses.js`. |
| Node port rows and transfer collage | `src/components/NodePorts.jsx`, `src/components/StyleCollage.jsx` | Reusable port handles/rows and the transfer mood-board collage live here. Keep class names and drag/drop behavior stable because many node bodies depend on them. |
| Settings page | `src/SettingsPage.jsx`, `server/index.js` settings routes | Runtime API key entry, repository update, restart, branch status, loaded app version, and enabled-model preferences live here. Keep settings data local and avoid exposing secret values in logs, history, or docs. |
| Project output rail data | `src/projectOutputs.js`, `src/projectOutputLoader.js`, `src/useProjectOutputCatalog.js`, `server/project-output-store.js` | Separate permanent project output records from bounded recent history. Merge paginated refreshes without dropping loaded items or changing scroll position. |
| Canvas geometry | `src/nodeGeometry.js` | Node bounds, graph bounds, rectangle math, menu clamping, and viewport modulo helpers live here. |
| Canvas media utilities | `src/canvasMedia.js` | Canvas-to-blob, browser image loading, cover drawing, and mood-board collage layout live here. |
| Color ID to Matte UI/helpers | `src/components/ColorIdMatteControls.jsx`, `src/colorIdMatte.js` | Picker UI state lives in the component file; color normalization, matte preview rendering, sample radius/tolerance bounds, and matte run item normalization live in the helper file. |
| Three.js runtime | `src/threeRuntime.js` | Lazy Three/GLTF loading and shared 3D math helpers live here. Do not import Three.js directly into common preview modules. |
| Workflow persistence | `src/useWorkflowPersistence.js` | Save, Save As, Open, Import, unsaved-change prompts, Recent workflows updates, and workflow status messages live here. |
| Draft persistence | `src/useNodeEditorDraft.js` | Browser draft loading, snapshotting, and debounced local draft writes live here. |
| Workflow files/session/state | `src/workflowFiles.js`, `src/workflowSession.js`, `src/workflowPreferences.js`, `src/workflowContext.js`, `src/workflowState.js` | File document shape, display paths, package/request context, picker preferences, graph cloning/remapping/fingerprints, deduping, and stale runtime cleanup live here. |
| Backend route registration | `server/index.js`, `server/routes/*` | `server/index.js` owns shared app setup and existing route implementations. New low-coupling route groups should register through `server/routes/*` and receive explicit dependencies from `index.js`. |
| Local custom workflow engines | `server/<workflow-name>/*` | ComfyUI or other local workflow-specific engines live in a focused server folder with tracked templates, manifest metadata, prompt patching, queue/poll logic, managed output copying, and history recording. Keep provider-specific graph patching out of browser code. |

When adding a new feature, put pure helpers in one of these modules or create a similarly focused module. `NodeEditor.jsx` should coordinate React state, node rendering, event handlers, and node-specific orchestration, not become the home for reusable algorithms.

## Migrating Pre-Refactor Features Into The Current App

Some future features may arrive as patches or branches built before this refactor. Treat those as source material, not as code to paste wholesale. The goal is to preserve the feature behavior while landing it in the current ownership map above.

Start every pre-refactor feature merge with this audit:

- Identify every touched surface in the incoming implementation: node catalog, icon, config, defaults, normalization, ports, connection rules, UI body, model options, API client call, backend route, run scheduling, result items, preview behavior, workflow persistence, stats, CSS, and tests.
- Compare those surfaces to the current ownership map before editing. Move incoming pure helpers, option lists, request builders, route wrappers, and preview utilities into their current focused modules.
- Keep `NodeEditor.jsx` as the coordinator. It may select node bodies, wire callbacks, own current node config/default/normalization functions, and call runner helpers. It should not regain large copied algorithms, static model catalogs, request payload builders, or reusable media utilities.
- Preserve saved-workflow compatibility first. If the incoming feature added or renamed fields, ports, node types, result shapes, or asset URLs, add normalization/migration for previous and current saved workflows in the current normalization path.
- Preserve UI class names and visible behavior unless the feature intentionally changes UI. When moving incoming JSX into a component, pass data and callbacks through props instead of reaching into editor state from the new component.
- Keep result arrays, selected result indexes, previews, and downloads using `mediaResults.js` and shared preview helpers. Do not introduce a new result shape for one feature unless all shared preview/download/stat surfaces are updated together.
- Keep model/provider names and dropdown option labels stable. Put new static model names, durations, aspect ratios, presets, and descriptions in `modelOptions.js`; saved workflows may depend on exact strings.
- Add browser API wrappers in `src/api/newtApi.js` before using a new route in UI code. Avoid scattered raw `fetch` calls.
- Prefer focused runner helpers under `src/nodeRunners/` for backend payloads and result normalization. The editor should assemble connected inputs and pass them to a runner/builder, not own the full request body when the shape is reusable.
- Register new backend route groups through `server/routes/*` when possible, with explicit dependencies from `server/index.js`. If extending an existing route in `server/index.js`, keep the change tightly scoped and document why it stayed there.
- Keep workflow package behavior intact. Imported or generated files should continue to use workflow context helpers so Windows and macOS users can move packaged workflows without broken asset references.
- Check cross-platform assumptions. Do not hard-code Windows path separators, drive letters, shell commands, hidden-folder behavior, or `.exe` names in browser code or shared helpers. Use Node `path` APIs server-side and document platform-specific commands separately when needed.
- Update this standards document in the same change when the incoming feature introduces a new durable pattern or changes a current one.

Use this placement guide while migrating pre-refactor code:

| Incoming code shape | Current landing place |
| --- | --- |
| Node catalog entry | `src/nodeRegistry.js`; icon only in `NodeEditor.jsx` |
| Static model names/options/descriptions | `src/modelOptions.js` |
| Edit effect groups, labels, controls, and defaults | `src/editEffects.js` |
| Upload, drag/drop, media accept/type detection | `src/mediaAssets.js` |
| Result item normalization or append logic | `src/mediaResults.js` |
| Preview/result/lightbox/output rail UI | `src/components/MediaViews.jsx` or a focused component imported there |
| Small reusable node body JSX | `src/components/NodeBodies.jsx` or a new focused component |
| Port row/collage UI | `src/components/NodePorts.jsx`, `src/components/StyleCollage.jsx` |
| Color matte picker/state/math | `src/components/ColorIdMatteControls.jsx`, `src/colorIdMatte.js` |
| Composer scene defaults, pose fields, pose presets, image planes | `src/composerState.js`, `src/api/newtApi.js`, `server/routes/composerPoses.js` |
| Composer Three.js rendering | `src/composerRender.js` |
| Camera/Composer viewport shell controls | `src/components/CameraControlViewport.jsx`, `src/components/ComposerViewport.jsx` |
| Backend request wrappers | `src/api/newtApi.js` |
| Node-specific payload/result builders | `src/nodeRunners/*` |
| Graph geometry, bounds, placement, import offsets | `src/nodeGeometry.js`, `src/workflowState.js` |
| Save/open/import/recent workflows | `src/useWorkflowPersistence.js`, `src/workflowFiles.js`, `src/workflowSession.js` |
| Draft autosave | `src/useNodeEditorDraft.js` |
| Backend routes | `server/routes/*` plus explicit registration in `server/index.js` |

Before committing a migrated pre-refactor feature, run the normal verification checklist. For frontend/server changes, include `npm run smoke:app` with the dev server running. For features that touch save/load/import, also manually test opening a workflow saved before the feature and one saved after the feature.

## Current Media Types

Use these internal media type names consistently in node config, result items, preview handling, history, stats, and connection rules.

| Media | Internal type | Color | Typical output |
| --- | --- | --- | --- |
| Prompt/Text | `prompt` or `text` history media | `#f0c83b` yellow | prompt strings |
| Image | `image` | `#3d85ff` blue | png, jpg, webp |
| Video | `video` | `#58ce63` green | mp4, mov, webm |
| Audio | `audio` | `#ff8b35` orange | mp3, wav, m4a |
| Camera | `camera` | `#ef4444` red | camera instruction |
| Style | `style` | `#9b5cff` purple | style instruction |
| Transfer | `transfer` | `#ff4fb3` pink | TRANSFER.png |
| 3D | `model3d` | `#14d8c8` teal | glb, gltf |
| Preview | `preview` | `#8d8d8d` gray | preview input only |

If a new media type is added, update this table, `portColors`, preview logic, stats media mix, connection compatibility, and result rendering together.

## Current Node Catalog

`src/nodeRegistry.js` is the canonical catalog and order. The table below groups roles; it is not palette order. Explore is also a current node (see the [complete reference](features-and-workflows.md)). Keep this list aligned when a node type is added, removed, renamed, or reordered.

| Internal type | UI label | Primary role |
| --- | --- | --- |
| `plainText` | Text | Lightweight prompt text |
| `text` | Text Model | Legacy load-only AI text processing; hidden from new-node interfaces |
| `textAgent` | Text Agent | Persistent conversational text assistance |
| `explore` | Explore | Brief-driven art directions, favorites, refinements, and resumable image queues |
| `image` | Image | Uploaded or connected image media |
| `video` | Video | Uploaded or connected video media |
| `preview` | Preview | Multi-result image, video, and 3D inspection |
| `output` | Output | Explicit filesystem save target |
| `autoAspect` | Auto Aspect | Legacy load-only type; new work uses Utility Image / Auto Aspect |
| `skillDirector` | Director | Scene package and shot-list direction |
| `storyboard` | Storyboard | Planned and generated shot frames |
| `coverage` | Coverage | Legacy load-only type; new work uses Utility Image / Coverage |
| `character` | Character | Locked character identity, wardrobe, and voice |
| `camera` | Camera | Camera instruction |
| `composer` | Composer | Composer and Frame It image-guide modes |
| `frameIt` | Frame It | Legacy load-only type retained for saved workflows |
| `style` | Style | Style instruction |
| `transfer` | Mood Board | Locked visual-transfer collage |
| `utility` | Utility | Local, hosted, and Comfy-backed image/video tools |
| `edit` | Edit | Local ffmpeg image/video editing |
| `assembly` | Timeline | Multi-track nonlinear video and audio editing timeline |
| `audio` | Audio | Uploaded or connected audio media |
| `audioModel` | Audio Model | ElevenLabs speech, dialogue/Character voices, conversion, effects, and music |
| `model3d` | 3D | Multi-view GLB generation |
| `imageModel` | Image Model | Remote image generation |
| `videoModel` | Video Model | Remote video generation |

## Text Node Roles

- `Text` is the lightweight concatenation node: it has one multi-connection Text input, one editable local textarea, one live Result, one Prompt output, no run button, and no backend call.
- Text inputs concatenate in saved edge order, followed by the node's local text when it is non-empty. Persist the combined value in `data.resultText`, and recompute chained Text output from the live graph before downstream consumption so Prompt connections, `@` references, and Output saves never depend on a stale intermediate result. Reject circular Text-to-Text input chains.
- `Text Model` is hidden from new-node interfaces but remains fully loadable for saved-workflow compatibility. Existing instances can accept text, image, video, and style inputs, call the local text-processing route, and record text model history/cost. Its default generation model is GPT-5.6 Terra through Fal/OpenRouter, with explicit environment overrides for model changes.
- `Text Agent` uses the same text, image, video, and style inputs as Text Model. `data.agentDraft` stores the unsent composer, `data.agentMessages` stores normalized user/assistant turns with the workflow, and `data.resultText` mirrors the latest assistant reply so existing Prompt connections and Output nodes continue to work. Enter and Shift+Enter insert line breaks; the Send button submits a turn. Clearing the conversation also clears the current Prompt output.
- Text Agent's Previous/Next prompt buttons recall its earlier sent user turns without submitting them and restore the unfinished draft when navigation returns past the newest turn.
- Text Agent defaults to descriptive image/video generation prompts. Once output exists, each user message edits that prompt and returns the complete revised prompt while preserving unrelated details and earlier constraints. A different prompt requires an explicit fresh-start request or Clear conversation. The visible output is the authoritative baseline, including manual edits and saved output without conversation turns; requests synchronize it into the hidden assistant history before adding the new user turn. Conversation remains persisted with the workflow, with the latest 40 turns sent to the provider.
- Text, Text Model, and Text Agent prompts may mention nodes by name with `@Node Name`. An unbound mention initially matches the visible node title, including spaces, or a compact alias such as `@NodeName` or `@Node-Name`; after that match, the referencing node stores the selected source node id in `data.nodeReferenceBindings`. Text Model and Text Agent send referenced text, image, and video nodes as structured model context; Image and Video Model prompts that consume referenced Text output also receive referenced media nodes as prompt-side references when compatible.
- Existing saved `text` nodes represent `Text Model`; keep that compatibility unless a migration explicitly changes it.
- The default text-processing provider is Fal via `TEXT_LLM_PROVIDER=fal`. The saved Text / Agent LLM preference can select Fal, OpenAI, or Atlas Cloud. `FAL_TEXT_MODEL`, `FAL_VISION_TEXT_MODEL`, `FAL_VISION_TEXT_FALLBACK_MODEL`, `STORYBOARD_TEXT_MODEL`, and `STORYBOARD_VISION_TEXT_MODEL` default to `openai/gpt-5.6-terra`; `OPENAI_TEXT_MODEL` defaults to `gpt-5.6-luna`; and `FAL_VIDEO_TEXT_MODEL` defaults to `google/gemini-3.1-pro-preview`.
- Fal text processing uses `openrouter/router` and should pass the app's text-processing instructions as `system_prompt`. Image helper descriptions use `openrouter/router/vision`. Video helper descriptions upload the connected video and use `openrouter/router/video` with Gemini 3.1 Pro Preview, preserving native temporal and audio context before Terra assembles the final response. Storyboard planning, QC, and generated export captions use the Terra routes.
- OpenAI and Atlas Cloud use the Responses protocol for text and attached-image analysis. Atlas model ids add the `openai/` namespace. Atlas does not receive native video; when video context is attached, use Fal's video route or report that a Fal key is required.

## Node Identity And Reference Standards

- Every node has a stable, opaque `id`. That id is the canonical identity for edges, `@` references, groups, previews, output routing, dependency scheduling, and saved workflow relationships.
- A node title is a user-facing label only. Never use the title as the durable key for a connection, reference, result owner, or persisted relationship.
- Graph edges store `from.nodeId` and `to.nodeId`. Renaming either endpoint must not recreate, detach, or reinterpret the edge.
- `@token` text stays readable while its saved binding points to a node id. Store bindings on the referencing node as `data.nodeReferenceBindings`, keyed by the normalized visible token without `@`, for example `{ "depth": "utility-1786..." }`.
- Renaming a referenced node updates bound visible tokens throughout node data and moves the binding to the new normalized token, while preserving the bound node id. Renaming `depth` to `dogpile` therefore changes `@depth` to `@dogpile` without changing what the reference means.
- If a user manually replaces an old token with the renamed node's current token, resolve that token against the current title and persist the same source id under the new token.
- Existing workflows without `nodeReferenceBindings` migrate lazily when references are used. When duplicate titles exist, prefer a matching node in the referencing node's group, then the nearest matching node; persist the selected id immediately so later runs do not depend on node-array order or position.
- Saved bindings take priority over title matching. A bound token must continue resolving after the source node is renamed, even before the visible token update is saved.
- Node `@tags` resolve only to sources connected upstream of the consuming node by directed graph edges, directly or through intermediates. A shared canvas/group or nearby position never grants access. Prompt text supplied by another node uses the consumer's upstream scope while retaining the text owner's saved bindings. Disconnected/downstream sources remain literal text and add no context or media, even with a saved binding. Preserve bindings across disconnection/reconnection; never redirect a disconnected bound tag to another source with the same title.
- Copy and Import create fresh ids for copied nodes. Remap `nodeReferenceBindings` whenever the referenced node is included in the copied graph, just as edges and group membership are remapped. A binding whose source is not included may fall back to normal title resolution in the destination workflow; it must never silently bind to an unrelated stale id.
- Keep reusable parsing, binding-key normalization, duplicate ranking, and visible-token replacement in `src/nodeReferences.js`. Keep graph id and binding remapping in `src/workflowState.js`.
- `$node` in an Output node may render the connected source's current title into a path or filename, but the Output connection itself remains identified by edge/node ids.
- Product labels may differ from legacy internal types, route ids, or source filenames. Preserve internal compatibility unless a deliberate migration updates old workflows, normalization, tests, and documentation together; Timeline / `assembly`, WanWarp / `videoStitch`, and WanSegment / `transitionBuilder` are current examples.

## Node Definition Checklist

Every new node type should touch the same core surfaces unless there is a clear reason not to.

- Add it to `nodeTypeDefinitions` in `src/nodeRegistry.js` with a concise label, and add the lucide icon mapping in `NodeEditor.jsx`.
- Add `getNodeConfig(type)` with all input and output ports.
- Add defaults in `createDefaultNodeData`.
- Add normalization in `normalizeCurrentNode` so saved workflows remain stable.
- Preserve the node's existing `id` during every data, title, result, and layout update. Only explicit copy/import operations should assign a new node id, and they must remap all internal edges, group membership, and node-reference bindings together.
- Add connection rules in `getConnectionError`.
- Add auto-connect behavior in `preferredAutoInputPorts` and `autoConnectionOutputKind`.
- Add edge migration/color handling in `normalizeEdgeForCurrentGraph` when needed.
- Add run behavior in `runNode`, using `nodeRunner.js` helpers for batch/result state and a focused `runXGeneration` helper for API calls.
- Add result item typing through `normalizedResultItems`, `appendResultItems`, and `appendedNodeResultState`.
- Add preview media support through `previewMediaType` and `connectedPreviewSources`.
- Add backend route support and a health route flag when the node calls the local server.
- Add history and stats tracking if the node spends money or produces media.
- Add CSS only for the node-specific differences.
- Run the verification checklist before commit.

## Node UI Standards

The node palette fits the available browser height: project controls retain their size and the full catalog shares the remaining vertical space. Short desktop windows use two compact catalog columns. Do not hide overflow to conceal unreachable node buttons or apply browser zoom to the canvas. The palette retains scrolling as a fallback for unusually small windows or expanded preset controls.

Node render-error fallback cards must follow the same positioning owner as normal cards. Inside React Flow, use the flow-managed card layout without applying the node's world translation again, so errors remain visible at the node's location.

The yellow crop box in the image preview supports freeform rectangular crops. Side handles adjust one axis; corner handles adjust both independently, with no aspect lock. Moving a crop preserves its dimensions at image boundaries. Undo and Apply retain the chosen width and height. Geometry is owned by `src/cropGeometry.js`.

Nodes should feel like they belong to the same editor.

- Header: icon, editable title, close button.
- Body: result pane first for generation nodes, then output, run button, Settings drawer.
- Default state: keep the node clean. Hide detailed controls inside Settings.
- Collapsed Settings: show port dots only when a compact representation is useful.
- Expanded Settings: show each input on its own `NodeRow` when the meaning matters.
- Use `OutputPortRow`, `NodeRow`, and `PortHandle` rather than custom port markup.
- Put short model descriptions at the bottom of model or utility nodes.
- Do not add visible explanatory UI text when a familiar control or clear label is enough.
- Keep card widths consistent. Model-like nodes currently use about `370px`.
- Avoid nested cards and large marketing-style blocks inside node UI.
- Use the app yellow for primary run actions.
- Use icon buttons for small actions such as download, step, delete, and navigation.
- Character voice selectors must reuse the Character model dropdown typography, colors, sizing, focus and disabled styling, with existing compact section labels and refresh icons. Avoid native browser-default controls or persistent explanatory paragraphs for this familiar selection.
- Media drag surfaces that appear after upload, generation, tab changes, or workflow restoration must immediately carry React Flow's `nodrag` boundary. Media wrappers should declare `nodrag` directly, while the node-card observer handles newly inserted elements and reused elements whose interaction attributes change. Do not observe `class` while also adding `nodrag`, because that can create an observer feedback loop during drag startup.
- Pasting copied nodes on the canvas anchors the copied selection's top-left at the current mouse position. Multi-node pastes must preserve the copied nodes' relative spacing and internal edges.

## Node Resizing Standards

Every catalog node uses the shared bottom-right resize handle. Resizing changes the node shell and its interior layout together; it must never create a large empty shell around a fixed-size body.

- Persist shell dimensions as `data.nodeWidth` and `data.nodeHeight`. Normalize them through `normalizedNodeWidth` and `normalizedNodeHeight` in `src/nodeGeometry.js`; do not introduce node-local width/height fields for the outer card.
- The current width range is the node type's estimated/default width through `2400px`. The current height range is `180px` through `3000px`. If a node needs a larger minimum width, add it to `estimatedNodeWidth`; if graph bounds or paste/culling behavior needs a better default height, add it to `estimatedNodeHeight`.
- Current minimum/default widths are `1080px` for Timeline, `980px` for Frame It, `920px` for Storyboard, `760px` for Director and Character, `390px` for Text Agent, Auto Aspect, and Coverage, `370px` for Image Model, Video Model, Utility, Edit, and 3D, `360px` for Camera and Style, `335px` for Mood Board and Preview, and `310px` for the remaining node types.
- A custom-size card is a column flex container. Its title and compact controls remain `flex: 0 0 auto`; the node body and primary workspace use `flex: 1 1 auto` with `min-width: 0` and `min-height: 0` so descendants can actually shrink and grow.
- Do not leave fixed heights, fixed margins, or `justify-content: space-between` behavior that turns added height into dead space. Put overflow on the controls or list that needs it, not on the entire media-first body unless the whole body is intentionally a form.
- Image, Video, generation-result, Preview, Storyboard, Character, Composer, Frame It, and Mood Board nodes are media-first when enlarged. Their preview, board, collage, or viewport must consume the largest useful share of remaining space; upload controls, tabs, ports, run buttons, status text, and settings headers stay content-sized.
- Media inside a resized region uses the full available width and height with `object-fit: contain` unless the node's explicit editing behavior requires cropping. Never stretch media or replace its native aspect ratio with a viewport-relative font/width trick.
- Fixed-aspect workspaces such as Composer and Frame It should use a size container and fit the largest complete aspect-ratio surface within both available dimensions. They must respond to height-only and width-only changes without overflow or clipping.
- Storyboard grids and Character layouts may reflow, but generated frames, the selected sheet, and essential controls must remain reachable. Enlarging these nodes should increase useful media area before it increases gaps.
- Textareas may retain their specialized resize state, but a shell resize clears stale inline textarea dimensions and lets the node layout own the available space. Typed controls must keep local draft updates responsive and should not force a whole-graph commit on every keystroke.
- Resizing is a graph edit: push one undo snapshot at resize start, update dimensions during the gesture, preserve the final dimensions in workflow saves, and include them in graph bounds, culling, paste placement, and selection calculations.
- A node-specific legacy preview-scale handle may coexist only when it scales a distinct artifact rather than the outer shell. It must not fight the shared `nodeWidth`/`nodeHeight` layout or create nested resize behavior users cannot predict.
- `ResizeObserver` must remeasure node cards and ports while dimensions change. Connector lines must stay attached throughout the drag and settle on the final endpoints without requiring a click, collapse toggle, pan, or zoom to refresh.

When adding or changing a resizable node, verify its minimum size, width-only growth, height-only growth, diagonal growth, shrink-back behavior, saved/reopened dimensions, controls at both extremes, media aspect ratio, scroll reachability, and every connected port before considering the layout complete.

Group backdrops expose resize handles at all four corners. A corner resize keeps the opposite corner anchored, updates position and dimensions live during the gesture, stops at the group minimum size, and persists the resulting bounds without moving contained nodes. Double-clicking the group background selects the nodes inside it and shows the same contextual selection action bar as selecting the group frame. The group's name/color header stays in its normal position. Double-clicking editable controls retains native text/button behavior.

## Port And Connection Standards

- Ports should be typed by media and colored from `portColors`.
- Port ids should describe purpose, not only type, when ambiguity matters.
- Generic ids like `imageIn` are acceptable for simple nodes.
- Specific ids like `frontImageIn`, `maskVideoIn`, or `referenceAudioIn` are preferred when the backend treats them differently.
- Input labels should be short and concrete: `Front`, `Mask Video`, `Prompt`.
- Collapsed input stacks should show colored dots without extra labels.
- Expanded settings should expose named inputs in rows.
- Connector lines inherit the source output color.
- Connector endpoints and all connection lookups use node ids and port ids. Titles are never connection keys.
- React Flow owns the live viewport, node transforms, handle geometry, selection, and edge paths. Do not add an independently transformed wire layer or a second viewport cache.
- Ports render as React Flow handles while preserving Newt's node ids, port ids, media colors, connection rules, and click-to-disconnect behavior. Dynamic port changes must call React Flow's node-internals update path.
- Connections begin at output ports and end at input ports. Dragging from an output must show the live connector line through completion; do not enable React Flow's click-to-connect mode as a substitute for the established drag interaction.
- Every compatible input port accepts additional incoming edges. Dropping a line on an already-connected input appends it without replacing existing lines; only an exact duplicate source-to-input connection is de-duplicated.
- Clicking a connected input dot without dragging removes every edge terminating at that node and port. Completing a dragged connection must never invoke this click-to-disconnect action.
- Image Model `imagePromptIn` retains every connected image and sends them as Image Prompt references.
- If a connected control section is collapsed, keep its handle mounted or provide a stable equivalent handle position. Presentation changes must never remove the saved edge or make a valid connection appear detached.
- Collapsing an input section changes only presentation. It must not remove the edge, invalidate its saved port id, or make its connector disappear; expanding it must remeasure the real endpoint immediately.
- Seed initial node dimensions and connected handle bounds from persisted or estimated graph geometry. Virtualization must not require every heavy node body to mount once before offscreen culling begins.
- Proxy, compact, and map modes are disabled while `flowOverviewEnabled` is `false`. Keep all React Flow nodes and edges mounted and keep `onlyRenderVisibleElements` disabled so distant graph structure does not disappear or respawn while panning. Any future virtualization or semantic mode must be opt-in, tested on production-scale workflows, and documented here before it becomes active.
- Keep normal connectors visually lightweight and use `vector-effect: non-scaling-stroke` so zoom does not make wires look fat or thin. Selection, draft, active, and inactive styles may differ, active processing retains its animated dash, and hit testing remains generous without increasing visible line weight.
- Incompatible connections should fail with a plain, helpful message.
- Auto-created nodes from a dragged connector should link only when compatible.
- Backward compatibility matters: if a port is renamed, migrate previous edge shapes in `normalizeEdgeForCurrentGraph`.

## Result And Preview Standards

- Generation nodes should keep previous results instead of clearing the result pane.
- Result panes should support image, video, and 3D model display.
- Videos should loop when played in Video and Preview nodes.
- Video result panes and video media previews preserve browser playback controls while supporting direct drag-out from the picture or drag grip. Dropping that payload on the canvas creates a Video node from the full-resolution source.
- Preview nodes should preserve existing preview history and update to the latest connected generation result.
- Preview nodes should support stepping through multiple connected or generated results.
- Preview's primary image view uses the full-resolution source, not a proxy thumbnail. Thumbnails are display-only for compact grids and rails; drag, edit, export, download, native Save Image, and downstream connections must resolve to the original media URL.
- Preview/Layout accepts image and video results in one persistently ordered board. Tiles can be dragged to reorganize mixed media, and double-click opens the original full-resolution image or playable video in the shared preview. Image export ignores video tiles and retains the visible relative order of the remaining stills.
- Preview/Layout must fit the complete board inside the resized node. All rows share the available board height, every image and video uses `object-fit: contain`, and unused cell space remains black. Resizing may scale or letterbox layout media but must never clip a row, crop media, or change its aspect ratio.
- Preview/Layout and Edit use `src/imageAdjustments.js` as the shared source of truth for curve points and brightness, contrast, and saturation normalization. Equivalent settings must produce equivalent pixels; do not fork the math or maintain visually divergent copies of the controls.
- The image lightbox pencil opens the lazy `ImageEditStudio`, separate from local crop, tone, text, and brush-inpaint controls. Drawing guides and painted selections are distinct normalized layers with undo/redo and native-size PNG output. User Preferences selects OpenAI Image 2.5 Flare or Sunburst through Fal/Atlas or Ideogram 4.5 Precise Edit through Fal; the header Edit model selector and User Preferences share one saved imageEditorModel preference. Either selector saves this choice immediately and updates the other through the shared preference event. Preserve all drawing marks, selections, prompts and results when the model changes; apply the choice to subsequent generation and show the original model on reviewed results. Disable model changes during generation or preference saving; keep the previous choice and surface save failures. Other preferences retain their existing explicit Save behavior. Existing editor preferences migrate to OpenAI Image 2.5 Sunburst. Ideogram masks use black for edit and white for preserve; never retry a paid request, send a masked edit to Google/Krea, or silently switch providers. Annotation edits send the clean original before the marked guide, selections preserve all unselected RGBA pixels, and generated results require an explicit Add Image to Canvas or Apply to Source action. Reject applying to changed or generating sources, retain the original for undo, and persist edits in the project package and History.
- Image adjustment previews must operate on a decoded copy of the source and leave the full-resolution source URL unchanged until the user explicitly applies or exports an edit.
- Generated outputs should have a node-level download affordance when possible.
- 3D outputs should be displayed with the shared lazy Three.js GLTF viewer.
- If a node returns multiple outputs, store them in `resultItems` with explicit `type`, `url`, `label`, and optional `cost`.
- Result item normalization and append behavior belongs in `src/mediaResults.js` and `src/nodeRunner.js`; do not duplicate result merging logic inside individual node branches.
- The project output rail must retain every cataloged local project generation independently of the bounded 500-entry recent-history cache. Use permanent project records, a total count, and cursor pagination, merged with live graph results. Refresh/new generations must not replace previously loaded items. Include `/outputs/<workflow-name>/...` and packaged `/workflow-assets/<workflow-id>/outputs/...` URLs; do not add absolute machine-local paths or browser object URLs. Save As and relocation must carry the catalog and referenced assets, including results from deleted source nodes.
- Assign every new or otherwise unidentified workflow a unique session ID before its first generation. Preserve that ID through normal saves so output history remains attached to the workflow, and issue a fresh ID when starting another new workflow.
- Project output rail data belongs in `src/projectOutputs.js`; shared preview/result UI belongs in `src/components/MediaViews.jsx`.
- Route API-served local media through `displayMediaUrl`. During split-port development, `/uploads`, `/outputs`, `/external-outputs`, `/workflow-assets`, `/api/media-thumbnail`, and `/api/video-preview` must resolve through the backend origin instead of accidentally requesting them from Vite.
- When a thumbnail fails, retry its known full-resolution source before showing the NewtNode logo. The logo is a missing/unresolved-media fallback, never a replacement for an existing local file.
- A model or Utility run redirected by an Output node must still write the real saved public URL into the source node's `resultItems`/`resultUrl`. Connected Preview nodes must receive those same playable items; do not substitute the Output node title, a filename-only string, or the logo.
- Fetch catalog pages lazily when the output rail first opens. Manual refresh and generation completion refresh the newest page while retaining older loaded pages. Passive video items use cached poster images; open/drag still resolves the original video. Do not introduce canvas culling as a rail optimization.
- Output rail thumbnails should keep layout stable and lazy-load image/video media as they near the visible rail; the full-size lightbox owns eager preview loading after double-click. When a lightbox was opened from the output rail, unmodified Left/Right Arrow keys step through image items only, skip other media types, and wrap at the ends. Do not capture those keys while a text or form control is being edited.
- The project output rail must resize horizontally from its left-edge grip while always retaining one thumbnail column. Resizing changes only that column's width and the preview size within it. Every image and video fills the column width, derives its height from the media's native aspect ratio, remains fully visible, and must never crop, stretch, or cover preview media.
- Dragging from the output rail into a compatible node should reuse the existing local output URL instead of re-uploading or copying the asset. Keep the imported asset shape aligned with normal uploaded assets so saved workflows remain portable.
- Dragging from the output rail onto the canvas should create a matching media node in place. Dragging external files onto the canvas should import supported media into the current workflow package/app storage and create matching Image, Video, Audio, 3D, or Text nodes; text files store file contents in the Text node.
- Video uploads and canvas drops accept MP4, MOV/QuickTime, and WebM. Preserve the original managed asset and MIME type; browser playback still depends on the codec inside the container, so an unsupported codec should produce a useful preview/run error instead of reclassifying the file as non-video.
- Double-clicking an output rail thumbnail should open a lightweight full-size preview modal instead of expanding the rail. The modal must fit the complete image or video in its native aspect ratio rather than cropping it.
- The output rail should expose an open-folder action for the current project's output folder through the local API.

## Output Node Standard

- Output uses internal type `output`, has one generic `sourceIn` sink, and accepts prompt, image, camera, style, transfer, character, director, video, audio, and 3D output kinds. The connection is an edge keyed by source and Output node ids; source titles are filename metadata only.
- The default Path is the current project's root output folder with no date subfolder. Output nodes marked `project-default` follow that project root when the active project changes; user-selected custom paths remain unchanged.
- Connecting Output to a runnable source makes it that source's save target. A separate overwrite toggle is not needed. Running Output directly copies the selected existing source result; running the source routes each newly generated result to the same target.
- The configured Path and Filename both expand tokens server-side. The visible insertion strip exposes `$node`, `$filename`, `$date`, `$index`, and `$time`. The server also preserves legacy/explicit aliases `$node_name`, `$source_node_name`, `$workflow_name`, `$output_node`, and `$output_node_name` for saved workflows and request compatibility.
- `$node`, `$node_name`, and `$source_node_name` resolve to the connected input node's current title. `$filename` preserves the connected input's original filename without its final extension. When Output follows a processing node with exactly one upstream video input, `$filename` follows that chain back to the original video filename; multi-video inputs remain on the producer result name rather than choosing an input arbitrarily. `$output_node` and `$output_node_name` resolve to the Output node title. `$date` uses local `YYYY-MM-DD`; `$time` uses local `HH-MM-SS`; `$index` is a zero-padded, incrementing available-file index.
- Tokens work in both Path and Filename. Sanitize token values and final basenames for the host filesystem, create missing directories recursively, preserve or infer the media extension, and never silently overwrite an existing file. Without `$index`, reserve a unique `-2`, `-3`, and so on suffix when needed.
- The status line previews the fully resolved filename before a run and reports the actual saved filename afterward. Filename preview must not create or reserve the target file.
- Absolute external targets are exposed to the browser as `/external-outputs/<encoded-absolute-path>/<encoded-filename>`. Persist the public URL in results; keep `externalPath` as backend/history metadata and never use a raw absolute path or browser object URL as an HTML media source.
- On reopen, every existing external Output result should resolve from its saved URL. If the original user root changed, the server may rebase the path or recover one unique nearby filename match; ambiguous or missing files should fail clearly and may then show the logo fallback.
- Redirecting storage must not sever provenance. The source node remains the result owner, Stats/history retain the generating node/model/provider, and Preview/downstream nodes continue to consume the source result normally.
- Explicit still export choices are PNG and JPEG. Explicit video choices are H.264 MP4 and ProRes 422 HQ MOV.
- Local ProRes export uses FFmpeg `prores_ks`, profile 3, `yuv422p10le`, and PCM 24-bit audio. Describe it as a 10-bit mezzanine transcode, not as restored source precision, native 10-bit generation, 16-bit media, EXR, or HDR.
- A container/codec transcode must never be presented as improving source dynamic range or bit depth. HDR labels require a real HDR transform and correct transfer, primaries, matrix, range, and metadata handling; Topaz SDR to HDR is the current explicit HDR Utility path.

## Run And Dependency Standards

- Extend the existing dependency scheduler with bounded admission; do not replace graph execution or provider routing. Use `workScheduler.js` and `nodeScheduling.js` for global/provider/local-resource budgets. Durable workers also enforce server-side provider admission across batches. Queue pressure is not generation failure, and admission must never submit a second paid request for an accepted run.

- `Run All` must respect dependencies.
- Selected-node dependency scheduling belongs in `src/nodeRunner.js`; `NodeEditor.jsx` should pass callbacks for UI status and skipped-node updates.
- Prompt/Text processing runs before media generation.
- Image-producing nodes run before nodes that depend on images.
- 3D nodes should run after their image dependencies are available.
- Video-producing nodes run after prompt, image, 3D, or utility dependencies they consume.
- Edit nodes run after their source image or video dependencies and use the same dependency stage as Utility and Video Model work.
- Output runs after its connected source when invoked independently. When a selected runnable source already routes through that Output node, do not schedule a second redundant Output copy for the same selection.
- Independent nodes of the same stage may run concurrently.
- Nodes should set `status`, `error`, `resultUrl`, `resultItems`, `selectedResultIndex`, and `resultType` consistently.
- Batch failures should report partial success without discarding successful outputs.

## Generation Progress Standard

- Model generation requests carry `generationRunId`, `generationGroupId`, node identity, generation kind/label, and one-based batch index/total metadata. Keep this metadata additive so provider request schemas remain unchanged.
- `generationProgressMiddleware` owns requests under `/api/node`; `GET /api/generation-progress` returns current entries for client polling. Do not expose API credentials, prompts, or provider payloads through progress responses.
- Supported phases are `queued`, `generating`, `downloading`, `finalizing`, `complete`, and `failed`. The UI must show a real filling track, a phase label, elapsed time, batch completion, queue position when available, and a terminal result.
- Prefer provider-reported percent or step/frame logs. When a provider supplies no usable percent, show a clearly labeled estimate derived from phase and elapsed time; never present an estimate as provider-reported truth.
- Batch progress aggregates all runs in a generation group. Preserve completed batch items when another item fails, and retain the terminal bar long enough for the user to read it.
- Keep terminal sibling entries in batch accounting while any sibling is pending, even when the normal terminal display period has expired.
- Seedance 2.0/2.5 node requests use durable job acceptance and recovery. A 20-minute elapsed time warns; it does not prove failure. Persist provider IDs before polling, retry status/downloads without a new paid submission, bind recovery to the original credential, publish each completed clip immediately, and deduplicate output/history reconciliation. Never silently retry an ambiguous paid POST. See [Seedance Generation Recovery](remote-video-recovery.md).
- Unknown submission acceptance is `Needs attention`, not running or provider failure. Release the foreground waiter, retain the durable run, and offer confirmed inline ID attachment, local result import, or local dismissal. Attachment must validate the original provider/model/credential and reject duplicate job IDs. Dismissal does not cancel a provider job or imply a refund. Never generate again as an automatic recovery action.
- An explicit terminal Atlas prediction must stop tracking even inside an HTTP-error envelope after original ID/model validation. Keep temporary HTTP errors recoverable. Durable-job diagnostics separate observed local stages from provider-reported latency; neither claims to distinguish provider queue from inference. Persist known reference-video durations in History settings and use null for unknown metadata.
- Preserve immutable job specifications separately from mutable checkpoints. Persist acceptance and finalization checkpoints immediately; coalesce unchanged heartbeat writes and coordinate incremental polling. Keep diagnostic events bounded and allowlisted, with no credentials, signed URLs, or prompt payloads.
- The progress component is node-scoped and accessible: expose `role=progressbar`, value bounds, a numeric value when determinate, and useful text when indeterminate.
- High-frequency progress polling must stop when there are no active runs; a lower-frequency mounted-workspace discovery poll may find recovered jobs. Polling must not trigger full graph updates unless result or node status actually changes. Keep subscription, recovery, and aggregation logic outside `NodeEditor.jsx`.

## Composer Node Standard

- Composer is the catalog owner for two modes: `Composer` and `Frame It`. Keep the mode in `data.composerMode`; switching modes must preserve both modes' scene data and the shared image output.
- The standalone `frameIt` type is hidden from the new-node catalog but remains fully loadable and editable for saved-workflow compatibility.
- Composer is an image-guide node. It exposes one `Image Plane` input and one `Frame` output.
- Composer should not expose prompt input or prompt output ports. Written prompts should connect directly to the downstream model that generates the final media.
- Each Composer maquette exposes a dynamic Character input below the Open Composer action, with the maquette name shown beside the port. The port id must stay tied to the maquette id so renaming the maquette does not break the binding.
- Composer maquette Character inputs accept locked Character nodes only. Treat each input as a single binding; replacing the connection should replace the prior Character for that maquette rather than stack ambiguous identities.
- When a Composer frame is connected to an Image Model image input, the image prompt builder automatically wraps the effective written prompt with the locked spatial blueprint instruction. This instruction treats the Composer frame as composition, pose, camera, crop, scale, occlusion, and negative-space authority only.
- If maquettes have Character bindings, Composer must forward those Character sheet references to the Image Model and add explicit maquette-to-character mapping text so each maquette keeps its own assigned identity. Include a short placement/color descriptor for each mapped maquette because the rendered guide frame does not visibly contain maquette names.
- Composer-bound Character references are identity-only. The Composer guide remains the authority for pose, gesture, stance, limb endpoints, crop, scale, placement, and camera.
- When an Image Model is running from a Composer frame, the Composer's bound Character input lines should animate as active generation dependencies.
- The Composer frame should be labeled as the input guide image when sent to backend image-generation routes.
- Saved workflows with pre-refactor Composer prompt edges, or Character bindings for deleted maquettes, should drop those edges during graph normalization instead of keeping stale prompt plumbing.
- The Composer modal sidebar uses a visible scene-object list for Camera, maquettes, primitive props, and image planes. Clicking a row selects that object. `Delete Selected` lives in the header as a red destructive button and deletes the selected scene object only; it must never delete the Camera.
- Maquette object controls are always visible when a maquette is selected: `Name`, `Color`, `Location`, `Rotation`, and `Scale`. Do not hide these controls behind the pose foldout.
- Pose-specific maquette controls live under a collapsible `Pose Controls` section, closed by default. When open, the section should consume the remaining Composer sidebar height and expose a working scroll area instead of clipping lower controls or leaving dead space.
- The pose preset row is labeled `Pose Presets`. It contains a legible preset-name dropdown, a trashcan button for the selected preset, and a Save button. Saving writes to the Composer-local saved pose list and attempts to persist the pose under `public/models/poses`; deleting removes the pose from the Composer-local list and deletes the library JSON through `DELETE /api/composer-poses/:poseId` when the preset has a `fileName`.
- Current maquette pose control order is: `Head`, `Upper Body`, `L Upper Arm`, `L Lower Arm`, `L Hand`, `R Upper Arm`, `R Lower Arm`, `R Hand`, `Hips`, `L Upper Leg`, `L Lower Leg`, `L Foot`, `R Upper Leg`, `R Lower Leg`, `R Foot`.
- Current saved pose field groups include upper/lower arms, hands, upper/lower legs, feet, head, upper body, hips, and `lean`. When adding a pose field, update the client and server `composerPoseFieldKeys` lists (`src/composerState.js` and `server/index.js`), `defaultComposerMaquette`, `normalizedComposerScene`, saved pose snapshots/patches through the field-key list, the Composer modal controls, and both mannequin/procedural rendering when the field is visual.

## Character Node Standard

- CU wardrobe generation must carry the exact finished outfit from the matching completed full Character sheet, including Cinematic sheets, into both body panels and visible portrait clothing. Supply that completed sheet as a wardrobe reference on fresh generation and CU-only retries; keep the CU base authoritative for layout and crops.

- Character is the identity and wardrobe authority for downstream image, video, Composer, Director, and Storyboard work. Its editable title supplies the visible `@token`; stable node ids and `nodeReferenceBindings` remain the behind-the-scenes identity when the title changes.
- Character Build accepts a portrait, up to eight wardrobe references, physical traits, voice references, and the supported sheet-generation controls. New nodes default to `Nano Banana Pro`; saved model choices remain intact, and legacy missing selections retain `Nano Banana 2`. Sheet choices also include `Seedream 5.0 Pro` at 2K, both OpenAI Image 2.5 variants, Ideogram 4.5, Flux 3 and Nano Banana 2.1. Locking first creates a neutral Base Identity sheet, then edits that base into one image sheet per wardrobe, or retains the base as the default variant when no wardrobe was supplied. Optional CU Video generation follows the same neutral-base and wardrobe-variant pattern.
- Standard regular and CU bases share upstream's plain matte charcoal swimwear foundation, including opaque chest coverage, with unchanged anatomy and panel crops. Stylized bases preserve existing source coverings instead. The CU base uses the original portrait as identity authority. Foundation/CU/wardrobe prompt versions are 3/6/5; changes take effect through explicit generation, never through a paid operation on load.
- Wardrobe references request their visible wearable accessories, including hats, eyewear, lens tint and separate helmet-mounted goggles. Transfer one complete layered outfit, preserve underlying identity and crops, allow natural accessory occlusion, and do not substitute coat-off alternatives. Apply these rules to standard, cinematic, stylized and CU edits while retaining our matching completed full-sheet wardrobe reference for CU consistency.
- Generated sheets with only `localUrl` remain valid through selection, reload and downstream routing. Prefer full-resolution managed `localUrl` over provider URLs. Display Base/Sheet labels without changing persisted selection IDs. A modern invalid library must not forward stale `resultUrl`; pre-library completed sheets and selectable Base Identity outputs remain compatible.
- `Stylized Character` persists as `stylizedCharacter` and defaults off for old and new workflows. On selects reference-relative alternate prompts that keep the required six-panel and three-panel layouts while locking the reference character's exact feature presence or absence, silhouette, proportions, materials, textures, colors, construction, and rendering style; it must not humanize or anatomically normalize the design. Stylized owns character-design fidelity while `Cinematic Sheet` remains composable: when both are enabled, Base Identity, CU Video, and wardrobe-derived sheets retain one realistic neutral-gray seamless studio cyclorama with a soft floor-to-wall sweep and grounded contact shadows. Both settings participate in the applicable Base and CU generation signatures, and the Stylized identity lock continues into downstream image, video, Storyboard, and Director instructions.
- Character Notes (`characterReferenceNotes`) are additional generation instructions. The shared `runCharacterSheetGeneration` runner appends nonblank notes to standard/cinematic and CU Video sheet prompts for every wardrobe and supported model, while preserving the base layout, portrait, wardrobe, and physical-details instructions. Blank/missing notes leave the original prompt unchanged. Notes take effect on the next generation; editing them does not automatically regenerate sheets or alter uploaded custom sheets. Storyboard character preparation remains separate.
- Generated wardrobe variants live in `characterSheetVariants`. Each variant is keyed by its stable wardrobe id, not its display filename or array position. Use the reserved `__default-wardrobe__` id when there is no uploaded wardrobe. Persist `wardrobeEditVersion` on generated wardrobe variants so changes to the edit contract invalidate only affected wardrobe sheets rather than the Base Identity sheet.
- Character wardrobe generation requests a complete sheet without rectangle masks, including regular and CU sheets. Both opaque bitmap masks and alpha masks have leaked as black geometric regions in completed provider outputs, so the client uses the locked Base Identity sheet plus strict prompt constraints instead. Older open-tab wardrobe requests must have obsolete masks removed before provider routing. Preserve intentional masks on ordinary image-edit requests. Existing generated sheets remain selectable; regenerate affected wardrobe variants explicitly to replace artifacts.
- Persist Base Identity and Base CU signatures separately from wardrobe signatures. Reuse a wardrobe result only when its base signature and wardrobe asset signature still match. A wardrobe thumbnail action regenerates that wardrobe only; Regenerate Base explicitly invalidates generated dependents. Neither action removes uploaded custom sheets.
- Custom completed sheets live in `characterCustomSheets`. Character accepts up to 16 PNG, JPEG, or WebP custom sheets through upload, multi-file drop, or compatible image-output drop. Adding a custom sheet must preserve every generated wardrobe variant and every existing custom sheet.
- Generated and custom sheets form one selectable library. Persist the selected entry in `activeCharacterSheetId` using the namespaced `generated:<wardrobe-id>` or `custom:<sheet-id>` form. A generated and custom asset with the same URL must appear only once.
- Selecting a sheet updates the Character node's full-resolution result and makes that exact sheet the active downstream identity reference. When available, a selected generated variant may provide its matching CU Video sheet to compatible video generation; custom image sheets remain valid image references and may carry a migrated matching video result.
- Sheet selection is workflow state. Save, Open, autosave, copy, and import must preserve a valid `activeCharacterSheetId`; normalization must choose a deterministic fallback when it is missing or stale. Existing workflows should continue to prefer the active wardrobe's generated sheet, then the first generated variant, then the first custom sheet.
- Removing the selected custom sheet must fall back to another valid generated or custom sheet. A locked Character stays locked when a fallback exists; it unlocks and clears its active result only when no usable sheet remains. Removing a wardrobe removes only that wardrobe's generated variant and follows the same fallback principle.
- Legacy `customCharacterSheet` and `useCustomCharacterSheet` data must migrate into `characterCustomSheets` and `activeCharacterSheetId` during normalization. Do not delete or replace generated variants during this migration, and do not display the same migrated asset twice. The legacy fields should be cleared after normalization but remain recognized as input compatibility fields.
- Legacy generated variants without workflow signatures remain valid library entries. Opening or locking an old Character must not trigger a paid Base Identity migration; regeneration begins only from an explicit user action.
- Regeneration is partial-success tolerant. Merge successful wardrobe results into the existing library, retain the previous sheet for any wardrobe that fails to regenerate, and show a concise partial-failure notice. If every requested generation fails, preserve existing valid sheets and surface the generation error.
- Character previews, sheet-library thumbnails, drag sources, and downstream references must retain the full-resolution managed asset URL. Thumbnails may lazy-load or use display helpers, but proxy images, object URLs, and logo fallbacks must never replace the persisted source.
- `src/characterSheetLibrary.js` owns generated/custom selection ids, legacy normalization, choice construction, and active-variant resolution. `src/characterVideoSheets.js` owns the selected Character reference used by video generation. Keep these rules out of ad hoc render branches.
- Character changes require focused tests for generated/custom coexistence, explicit selection, legacy migration, duplicate suppression, removal fallback, save/open persistence, downstream image/video reference choice, and partial regeneration retention.

## Backend API Standards

Local API routes should live in the smallest backend owner that fits the route. Node generation routes usually live under `/api/node/...`; focused route groups should live in `server/routes/*` and be registered by `server/index.js` with explicit dependencies.

- Validate required inputs early and return JSON errors.
- Use local asset helpers such as `readLocalAsset`, `localAssetToFalUrl`, or `uploadLocalOutputToFal` rather than passing local paths to remote APIs.
- Use managed asset helpers for uploaded, generated, and derived files so the current workflow package is honored.
- Download generated files into the attached package `outputs/` folder, or into `/outputs/<workflow-name>/` when no package is attached.
- Return local URLs such as `/workflow-assets/<workflow-id>/outputs/file.glb` for packaged assets or `/outputs/<workflow-name>/file.glb` for unpackaged assets.
- Add a health route flag for new API routes and update `scripts/smokeApp.mjs` required routes when the route is part of startup health.
- Add browser API wrappers in `src/api/newtApi.js` before UI code calls a route.
- Edit node media operations live at `/api/node/edit-media`, use local ffmpeg/ffprobe, require a local NewtNode asset URL, and must write managed image/video outputs into the active workflow package or local outputs folder.
- Edit node live previews live at `/api/node/edit-preview`, render temporary PNG frame previews with local ffmpeg, return inline preview data, and must not append history or create project output files.
- Composer pose library routes live at `/api/composer-poses`: `GET` lists library poses, `POST` saves or updates pose JSON under `public/models/poses`, and `DELETE /api/composer-poses/:poseId` removes the selected library pose file. Keep file names sanitized server-side.
- Use `subscribeFal` for Fal calls so queue and failure logging stays consistent.
- Normalize Fal file responses with `normalizeFalFile` and fallback search helpers where useful.
- Keep request fields aligned with the provider's current API schema.
- Keep response payloads small and predictable: `image`, `video`, `model`, `thumbnail`, `cost`, `seed`, `text`, as appropriate.

## Security And Trust Boundaries

NewtNode handles local files, provider credentials, remote media, workflow packages, and desktop control actions. Treat every browser request, workflow value, imported filename, provider response, and package reference as untrusted at the server boundary.

- Provider credentials are server-side local configuration. Never send a reusable key to the browser, include it in progress/history/errors, or log request headers and environment values.
- UI code calls Newt's local API; it must not call paid providers directly with a credential embedded in browser state.
- Validate route bodies, expected media type, required fields, numeric ranges, list counts, provider limits, and output schemas before use. Preserve useful provider diagnostics without echoing secrets or entire sensitive payloads.
- Resolve local media through existing managed-asset helpers. Reject path traversal, unsupported URL schemes, arbitrary browser-supplied absolute paths, and files outside approved uploads, outputs, workflow assets, or explicitly selected Output roots.
- Normalize and sanitize filenames server-side. Use Node `path` APIs, containment checks, recursive directory creation under an approved root, and collision-safe reservation.
- Validate remote downloads by status, declared/observed media type, size/timeout limits where required, and provider response shape. Copy durable results into managed local storage before persisting them.
- Browser object URLs, temporary preview files, Comfy temp paths, and provider URLs are runtime transport, not durable workflow identity.
- Keep temporary preview routes free of history, Stats, and project-output side effects. Clean up temporary files through the existing lifecycle.
- Do not serve arbitrary filesystem roots to the browser. External Output URLs must stay encoded and resolved by the server's constrained external-output handler.
- Desktop actions such as restart, update, dialogs, folder launch, and workflow file operations use the local control route and validate requested actions/paths server-side.
- Keep CORS and listener scope local by default. A feature that exposes Newt beyond loopback requires an explicit security design, authentication decision, and documentation update.
- Tests and fixtures use placeholders only. Before completion, inspect the diff for keys, bearer tokens, personal paths, signed provider URLs, workflow media, runtime settings, and generated logs.

## Settings And Runtime Update Standards

Settings is a local runtime control surface, not an account system.

- The Settings page is lazy-loaded by `src/main.jsx` and should use `settingsApi` from `src/api/newtApi.js` for every request.
- The current Settings routes are `GET /api/settings`, `POST /api/settings`, `POST /api/settings/validate-keys`, `POST /api/settings/update`, and `POST /api/settings/restart`; `/api/health` must advertise `routes.settings: true` and `routes.settingsKeyValidation: true`.
- Secrets can be loaded into Settings with `includeSecrets=1`, but UI fields must remain password-style by default with explicit reveal buttons.
- Runtime settings live in `server/data/runtime-settings.json`. Treat that file as local state: ignored by git, not a fixture, and not a source of defaults for another machine.
- Settings is the source of truth for Fal, Google, Krea, and OpenAI credentials. Each provider may store multiple locally named credentials, with at most one active credential selected by radio control; choosing `None` disables that provider. Saving Settings atomically materializes the four provider values into `.env` while preserving unrelated environment configuration: active credentials are uncommented and disabled credentials remain commented out. Existing single Settings keys and active or commented `.env` provider keys are imported as named profiles during migration, after which users should not need to edit `.env` directly.
- The update action must stay constrained to the configured repository and branch. A Git checkout should first try `git pull --ff-only`; if that fails, stage a fresh replacement. A GitHub ZIP install has no local Git identity, so Settings should identify it as a ZIP install, default it to the official NewtNode repository and `main`, and bootstrap through the replacement path without attempting a pull. Prefer a shallow clone so that first update converts the ZIP into a normal Git-backed install; when Git is unavailable, download the bounded public GitHub source archive so future Settings updates still work. Replacement updates install dependencies, preserve local `.env`, `server/data`, workflows, inputs, uploads, and outputs, swap the app folder, relaunch through the platform launcher, and remove the old install only after the replacement reports healthy. Keep Windows PowerShell and macOS bash handoff scripts aligned; do not add merge, reset, or branch-changing behavior to the Settings button.
- Branch status should compare a Git checkout's current local branch with the configured remote branch head and report a plain state such as up to date, update available, local changes, local ahead, repository differs, or check failed. A source-archive install should report `ZIP install` with its configured/default branch instead of presenting missing Git metadata as a failed status check.
- Restart requests should go through `/api/settings/restart` and the restart marker flow. Both production launchers use the shared supervisor, per-service ownership locks, rotating logs, bounded crash backoff, and explicit restart status. Source watching is for development only. Never terminate unrelated processes merely because they own a port.
- If the Settings branch tile or health payload shows the app version, derive it from package metadata so release bumps update the display automatically.

## Image And Video Model Standards

- Callable model labels, shared option lists, and workspace filtering live in `src/modelOptions.js`. Keep labels stable for saved workflows; add migrations when a provider rename must change one.
- Model-specific normalization and request builders belong in focused modules such as `src/geminiOmni.js`, `src/seedance25.js`, and `src/nodeRunners/*`. The generic Video Model UI should select capabilities and gather connected inputs, not duplicate provider schemas.
- Video Model inputs are role-specific. `startFrameIn`, `endFrameIn`, `referenceImageIn`, `referenceVideoIn`, `referenceAudioIn`, Character, Storyboard, Director, and prompt inputs must remain distinct through collection, upload, provider request construction, and history metadata.
- Gemini Omni Flash supports text-to-video, start-frame/image-to-video, image references, and reference-video editing. It is fixed to `720p`, currently supports `16:9` and `9:16`, and follows the general Video Model provider preference, stored under the legacy `veo` key. Fal and Google support reference-video edits; Krea supports generation with image references and rejects video-edit references. Never switch away from the selected provider because another key exists.
- A Gemini Omni reference video is an edit source, not a weak style hint. Prepare it as provider-compatible 720p H.264 when needed, send the actual uploaded video bytes/URI or provider URL, select the video-edit endpoint/task, and add a concise preserve-everything-else instruction unless the user already supplied one. Provider rejection must say the video was received and rejected rather than claiming the input was missing.
- Gemini Omni start frame and reference images must be sent as media parts or provider image fields, not merely described in prompt text. Normalize direct-Google text to the provider's accepted byte range before request encoding so punctuation cannot trigger ByteString conversion failures.
- Seedance 2.0 and Seedance 2.5 are separate model contracts. Fal Seedance 2.5 supports `auto` or 4-30 seconds, `1080p`/`720p`/`480p`, and auto plus the ratios declared in `src/seedance25.js`. Its image-to-video endpoint always receives `aspect_ratio: "auto"`; do not reuse the broader Seedance 2.0 duration/resolution options.
- Atlas video references must satisfy the provider's 407,696-8,295,044 pixel frame range. Normalize only reference videos outside that range before upload, preserve their aspect ratio and complete frame without crop or padding, and leave the saved source asset untouched.
- Atlas Seedance image references and start/end frames must satisfy a width/height ratio of 0.4–2.5, 300–6000 pixels per side and a file size below 30 MB. Preserve valid assets byte-for-byte; prepare out-of-range images with contain scaling and neutral white padding instead of cropping or stretching subjects. Keep saved source assets untouched and record changed source/role/dimensions/padding in History settings. Seedance 2.5 start/first+last frame routes always submit `ratio: adaptive`, independent of the visible output-ratio choice; reference-only generation retains the chosen output ratio.
- Fal Seedance 2.5 reference limits are 30 images, 10 videos, 10 audio files, 50 references total, 30.2 seconds of reference video, and 30.2 seconds of reference audio. Each timed reference must be at least 1.8 seconds, and audio requires at least one image or video reference. Validate these before provider submission and record the actual route and reference counts in history.
- Fal Seedance 2.5 reference videos accept MP4/MOV at 24-60 FPS, 300-6000 pixels per side, and aspect ratios from 0.4 to 2.5. Reference audio accepts MP3/WAV. Preserve provider validation details when a connected asset falls outside these bounds.
- MiniMax H3 is one contextual Video Model with an explicit Fal/Krea/Atlas/Local provider preference. Fal and Atlas Cloud expose text-to-video, image-to-video, and reference-to-video routes; Local uses the loopback SGLang asynchronous `/v1/videos` API. A Start Frame selects image-to-video; otherwise any image, video, or audio reference selects reference-to-video; with neither, use text-to-video. Start Frame takes route priority, and End Frame requires Start Frame.
- MiniMax H3 supports 5-15 seconds, seed, prompt expansion, and safety checking through Fal, with the resolutions exposed by the current provider schema. The Local SGLang integration supports `576P` only, uses 20 inference steps, and rejects other selections instead of submitting a workload that exceeds the supported 24 GB GPU profile. Text-to-video accepts `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, or `9:16`; image-to-video follows the source image; reference-to-video adds `adaptive`.
- MiniMax H3 reference limits are 9 images, 3 videos, 3 audio files, and 12 files total. Each video/audio reference must be 2-15 seconds, combined video and combined audio duration are each limited to 15 seconds, and audio cannot be the only reference type. Rewrite persistent `@node` mentions to positional `Image N`/`Video N`/`Audio N` for Fal and `<Picture N>`/`<Video N>`/`<Audio N>` for Local SGLang.
- Fal billing is output duration times the selected resolution rate: `$0.05/s` at 480P, `$0.06/s` at 768P, `$0.13/s` at 2K, and `$0.16/s` at 4K. The first five reference images are free; each additional reference image costs `$0.08`. Local SGLang runs record zero hosted-provider cost. Record provider, route, reference counts/durations, native-audio status, and the complete estimate in history so Stats remains reproducible.
- The selected MiniMax H3 provider is authoritative. Local requires a healthy loopback SGLang service and never falls back to Fal; Fal requires an active Fal key and never falls back to Local.
- Provider selection is authoritative. If the selected route lacks a key, capability, or valid response, report that provider's error; do not silently change service to make the run succeed.

## Hosted Utility Model Standards

Hosted utility models should follow the same request, result, history, and stats contracts as other generation nodes.

- Keep hosted utility labels and option lists in `src/modelOptions.js`; saved workflows rely on stable labels.
- Image to Color ID must request globally unique, widely separated RGB colors for every object instance or independently selectable region, including nonadjacent and repeated objects. Only disconnected portions of the same ID may share a color. Never frame uniqueness as adjacency-only or permit a cycling category palette. The current hosted image-generation path is prompt-guided and does not validate semantic object identity; do not claim guaranteed uniqueness or real Cryptomatte EXR metadata.
- Current Utility Image catalog labels are `Auto Aspect`, `Coverage`, `Color ID to Matte`, `Image to Color ID`, `Qwen Camera Edit`, `Grab Still Frame`, `DWPose`, `Depth Anything`, `Topaz Image Upscale`, `Patina`, `BiRefNet Image`, and gated `SAM 3 Image`.
- Current Utility Video catalog labels are `Extract Frame`, `Color ID to Matte`, `Composite Video`, `DWPose Video`, `Depth Anything Video`, `WanBlend`, `WanWarp`, `WanSegment`, `Wan VACE Mask-to-Video`, `Wan VACE 14B Inpainting`, the Wan 2.2 A14B LoRA and VACE variants, gated `SAM 3 Video`, `VOID Video Inpainting`, `BiRefNet Video`, `RIFE Video`, `Bytedance Video Upscaler`, `Flux Video Upscale`, `Topaz SDR to HDR`, and `Topaz Video Upscale`.
- Only options returned by the enabled Utility preference filters are callable. Hidden legacy handlers may remain for saved-workflow compatibility, but retired labels such as Luma Photon/Ray2 and Wan 2.1 LoRA must not be reintroduced to the current dropdown accidentally.
- SAM 3 image/video segmentation remains feature-gated by `sam3SegmentationModelsEnabled`; keep both options hidden together until the integration is deliberately re-enabled and reverified.
- Depth Anything Video is a Utility Video model. It requires a connected source video, supports model, colormap, resolution, max-frame, output-FPS, and side-by-side controls, and returns a normal video result item.
- Depth Anything image and video preprocessors are paid Fal utilities. Estimate cost from the available image/video duration data; mark the cost unpriced when duration is unavailable instead of inventing a fake amount.
- Topaz SDR to HDR uses `topaz/sdr-to-hdr/video` with a required source video and an `mp4` or `prores` output-format setting. Preserve the source resolution and frame rate, enforce Fal's five-minute input limit, save ProRes output as `.mov`, and price runs from source duration and resolution using the published 1080p/4K tiers.
- Flux Video Upscale uses `blackforestlabs/flux-video-upscale` with a required source video and exposes Fal's `upscale_factor` (1.5-3), `creativity` (precise `0` or creative `1`), optional creative `prompt`, and `safety_tolerance` (0-4) inputs. Prepare non-MP4 sources as MP4, enforce Fal's 20-second and 50 MB limits before submission, preserve the source aspect ratio, and price delivered output by duration, resolved 1080p/2K/4K tier, and precise/creative mode. Fal rates verified on 2026-10-20 are $0.084/$0.15/$0.33 per output second for precise 1080p/2K/4K and $0.12/$0.21/$0.474 for creative mode (https://fal.ai/models/blackforestlabs/flux-video-upscale). New estimates use these rates; recorded historical costs remain unchanged.
- Topaz Image Upscale and Topaz Video Upscale are paid Fal Utility models. Keep their image/video option lists separate because the Fal schemas differ, and estimate cost from output megapixels for image or output-resolution tier, duration, FPS, and Gaia 2 multiplier for video when that metadata is available.
- SAM 3 Image is a prompted matte generator in Utility Image. Request raw PNG masks with `apply_mask: false`; an isolated RGB subject on black is an inspection composite, not a black-and-white matte, and must not be labeled or routed as one. Keep returned masks ahead of any distinct preview item so the first result and `Mask output` are actual mattes.
- SAM 3 Video follows the same contract in Utility Video. Request an unapplied X264 mask video with `apply_mask: false`, keep the detection-threshold control bounded from 0 through 1, and expose the result as `Mask video output`. Do not describe an isolated RGB subject over black as a matte.
- Fal Wan 2.2 LoRA and VACE models stay in Utility Video. Wan 2.1 LoRA text-to-video and image-to-video are retired and should not be added back to callable model lists. Keep provider-specific payload builders in `src/nodeRunners/videoModels.js` and `server/index.js`, not inline inside generic UI rendering.
- When adding a hosted utility that can also be used as a prepass for a local Comfy workflow, keep the standalone hosted result as ordinary media and let the downstream executor decide how to consume it.

## ComfyUI Custom Workflow API Standards

Some Newt features are local custom workflow integrations rather than direct hosted model calls. WanBlend and WanWarp are the current production reference implementations: Newt presents a purpose-built node interface, then the backend patches and runs locked ComfyUI API workflows.

Use this pattern for future ComfyUI-backed custom builds.

- Store each integration in a focused server folder such as `server/wanwarp/`.
- Track the Comfy API prompt templates in `server/<integration>/templates/`. These are source fixtures, not runtime output. Keep large generated media and local Comfy output folders out of git.
- Treat production-ready Comfy templates as backend contracts. Prototype workflow changes should branch into a new template file or integration mode before replacing a locked production template.
- Include template metadata when useful, such as `templates/manifest.json`, so required models, custom nodes, output node ids, and workflow purpose are discoverable.
- Keep all Comfy-specific patching server-side. Browser code should submit normalized node settings and local asset URLs, never raw Comfy graph internals or machine-local paths.
- Use a single backend engine module to own template loading, prompt patching, Comfy queueing, polling, output copying, result shaping, and history append.
- The backend should talk to ComfyUI through its local HTTP API: check availability with `/system_stats`, upload still images through `/upload/image`, queue prompts with `/prompt`, and poll completion through `/history/<prompt_id>`. `/queue` is useful for diagnostics and monitors, but normal runs should rely on prompt history.
- Default Comfy URL should be environment-configurable. WanWarp uses `WANWARP_COMFY_URL`, defaulting to `http://127.0.0.1:8188`; WanBlend uses `WANBLEND_COMFY_URL` and falls back to `WANWARP_COMFY_URL`.
- WanBlend, WanWarp, and WanSegment runs should preflight local ComfyUI availability through `/api/comfy-wan/status`. The status check must use the Settings-managed ComfyUI root path, compare required custom nodes and models against `docs/comfyWan-requirements.yaml`, and return actionable missing-item details. If ComfyUI is not reachable or required Wan dependencies are missing, show a dialog that points the user to the requirements file for ComfyUI, custom node, model, and Python dependency setup.
- Long local renders must use a generous server-side timeout and should be environment-configurable. WanWarp uses `WANWARP_COMFY_TIMEOUT_MS`; WanBlend uses `WANBLEND_COMFY_TIMEOUT_MS` and falls back to the WanWarp timeout.
- Timeout errors must include enough context to debug, especially the Comfy `prompt_id`, and should say the render may still be running in Comfy.
- When a workflow is queued, record the Comfy `prompt_id` in history settings.
- If Comfy returns `status_str: "error"`, surface Comfy's exception message and attach raw status where possible.
- If Comfy returns success but expected output nodes are missing, return a clear 502-style error and include raw outputs for debugging.

WanWarp reference map:

| Surface | Current files |
| --- | --- |
| Comfy engine | `server/wanwarp/engine.js` |
| Locked API templates | `server/wanwarp/templates/creator-locked-full.json`, `server/wanwarp/templates/creator-locked-seg-a.json`, `server/wanwarp/templates/wanblend-refine.json` |
| Template metadata | `server/wanwarp/templates/manifest.json` |
| Backend route integration | `/api/node/utility-video` path in `server/index.js` |
| Browser request shape | `src/nodeRunners/videoModels.js` and the utility runner path in `src/NodeEditor.jsx` |
| User-facing model labels | `src/modelOptions.js` |
| Result and preview support | `src/components/MediaViews.jsx`, `src/components/NodePorts.jsx`, and shared result helpers |
| Standards/history docs | `docs/node-standards.md`, `docs/latent-wan-transition-handoff.md`, `docs/comfyWan-requirements.yaml` |

WanBlend reference map:

| Surface | Current files |
| --- | --- |
| Comfy engine | `server/wanblend/engine.js` |
| Context-smashing template | `server/wanblend/templates/context-smashing.json` |
| Backend route integration | `/api/node/utility-video` path in `server/index.js` |
| Browser request shape | `src/nodeRunners/videoModels.js` and the utility runner path in `src/NodeEditor.jsx` |
| User-facing model labels | `src/modelOptions.js` |
| External requirements | `docs/comfyWan-requirements.yaml` |

### Template Patching

- Treat exported Comfy API JSON as an immutable template. Load and clone it per run before editing.
- Patch by stable node ids, and keep those ids documented in code or manifest comments when they are part of the public integration contract.
- Patch only the fields Newt intentionally controls. Preserve creator defaults for the rest of the workflow.
- Sanitize Comfy widget values before queueing. Exported Comfy JSON can contain UI index values where the API expects strings. WanWarp normalizes Shark sampler schedulers, sampler cfg, denoise, step values, and ImageScale methods before submitting.
- Prefer structured JSON patching over string manipulation. Use `JSON.stringify(path)` only for Comfy nodes that explicitly expect quoted path strings, such as some VHS path loaders.
- Avoid hard-coding Windows path separators in template data. Resolve local asset paths with server helpers and Node `path` APIs.
- Do not bypass compile or custom-node behavior by deleting nodes unless that is part of the locked workflow contract. If a workflow requires bypassing compile nodes, document the reason and keep the template aligned with the known-good Comfy graph.

### Assets And Outputs

- Resolve Newt local URLs through existing asset helpers. Packaged `/workflow-assets/<workflow-id>/...`, unpackaged `/uploads/...`, and `/outputs/...` URLs must all work.
- Upload still images to Comfy rather than passing Newt URLs directly into Comfy image loaders.
- For video inputs consumed by Comfy path-loader nodes, resolve to validated local filesystem paths server-side.
- Never return Comfy's raw output path to the browser. Copy Comfy outputs into Newt managed assets first.
- Generated outputs must honor the current workflow package: package runs write to `/workflow-assets/<workflow-id>/outputs/...`; unpackaged runs write to `/outputs/<workflow-name>/...`.
- Return normal Newt result items for user-visible media: final outputs as `video` or `image`, with labels, local URLs, file names, mime types, metadata, and seeds where available.
- If a custom workflow produces diagnostic or segment outputs, copy those into managed assets too and return them as additional `resultItems`.

### Node Contract Pattern

WanWarp establishes a useful pattern for complex Comfy workflows that are easier to edit as several Newt nodes but should run as one locked Comfy graph.

- Use lightweight config nodes when the user needs repeated editable segments. WanSegment is config-only: it validates connected media and prompt/settings, then emits a `wanSegment` result item carrying the normalized segment payload.
- Use one executor node for global workflow execution. WanWarp receives connected WanSegment outputs and runs the full locked Comfy workflow.
- If a workflow has a useful prepass, keep it as a normal media-producing utility when it can stand alone. WanBlend outputs a regular video, and WanWarp may optionally consume that video as a keyframe/prepass source while still running the locked creator workflow.
- When a prepass can replace segment config, keep that as a separate executor mode instead of forcing fake segments. WanWarp can refine a connected WanBlend/reference video directly with Motion Map and Depth Video inputs through `server/wanwarp/templates/wanblend-refine.json`.
- Keep user-facing node names clear even if older internal code names remain during migration. In the current app, `WanSegment` replaces the old Transition Builder concept and `WanWarp` replaces the old Video Stitch concept.
- Config outputs may use a non-media internal type, such as `wanSegment`, when they are graph instructions rather than playable media. Shared preview/result code must explicitly understand that shape.
- Still expose playable media from segment nodes when a full workflow finishes. WanWarp copies Segment A/B/C/D outputs back into the connected WanSegment previews while keeping the segment config output available for chaining.
- Make ports intuitive by media role: segment config/handoff outputs should use the image/config color expected by the target port, while actual segment video outputs should stay green.
- `Run All` must respect dependency order: segment nodes prepare config first, then the executor node runs the single Comfy workflow.
- If the locked Comfy workflow supports only a bounded topology, expose that honestly. WanWarp currently standardizes on A, B, C, and optional D loop behavior that matches the creator workflow.

### Exposed Controls

- Expose stable controls that map to intentional template patch points. Do not expose every Comfy widget by default.
- Preserve creator defaults as the default Newt values unless the product intentionally changes the workflow.
- Group global workflow controls on the executor node. WanWarp owns frames, fps, size, output format, CRF, sampler steps, LoRA strengths, tail trim, and blend.
- For WanBlend refine mode, WanWarp also owns refine denoise, Control Mix, Depth/Motion mix, VACE reference strength, conditioning strength, VACE strength schedule, and frame cap. These patch how much the WanBlend RGB video, motion map, depth video, and prompt influence the final Wan 2.2 pass. A frame cap of `0` means auto: probe the connected WanBlend video and run its full length/FPS, then cap motion/depth loaders to that selected length.
- Keep prepass controls on the prepass node. WanBlend owns context-smashing prompt/negative text, color-region images, color-map video, output size/FPS, IPAdapter weight, stride, frame cap, steps, CFG, CRF, and seed.
- Group segment-specific controls on segment nodes. WanSegment owns prompt, negative prompt, conditioning strength, VACE schedule, VACE reference strengths, seed, start/end keyframes, motion map, and depth video.
- For paired sampler controls, keep `steps_to_run` no greater than total `steps`.
- For video encoding, expose CRF as an output quality/file-size control and document that it cannot fix generation noise.
- For LoRA strength controls, use the workflow's real model split names. WanWarp exposes Distill HIGH/LOW and Motion HIGH/LOW strengths because the template has separate HIGH and LOW model LoRA loaders.
- Keep handoff/overlap controls named in user language. WanWarp exposes `Tail Trim` and `Blend` to match the creator workflow's boundary handling.

### History, Cost, And Diagnostics

- Record local Comfy runs as `provider: "local-comfyui"`.
- Record cost as `$0` only because the run is local and Newt is not paying a hosted provider. Do not imply the user's GPU time is free in user-facing copy.
- History settings should include the selected model name, Comfy URL, Comfy prompt id, output node ids, workflow/template name, segment roles, loop setting, width, height, fps, frame length, render length, exposed quality controls, and input asset URLs.
- Include all copied output URLs, file names, labels, and bytes in history.
- Keep raw Comfy status/output objects out of normal history, but attach them to thrown errors when useful.

### Verification For Comfy Integrations

For code-only changes to a Comfy integration, run the normal verification checklist plus server syntax checks for the focused engine module.

For behavior changes that touch template patching, node wiring, or output handling, also run a local Comfy smoke test:

- Confirm Comfy is reachable at the configured URL.
- Run a small known-good workflow through Newt, not only directly in Comfy.
- Confirm `/history/<prompt_id>` reaches success.
- Confirm final outputs are copied into Newt managed assets.
- Confirm segment or auxiliary outputs appear on the correct nodes.
- Confirm history records the Comfy prompt id and local output URLs.
- Confirm a packaged workflow uses `/workflow-assets/<workflow-id>/outputs/...` paths.
- Confirm timeout behavior does not mark a still-running Comfy render as a failed completed run.

## Cost And Stats Standards

Every paid remote model should record cost metadata.

- Add pricing constants near the top of `server/index.js`.
- Allow environment overrides for pricing where model pricing may change.
- Add a local estimator function with a `pricingBasis` and `pricingSource`.
- Keep provider-specific estimates separate when the same model can route through different providers. Atlas Cloud runs must use Atlas pricing metadata; when Atlas does not publish a fixed locally calculable rate, leave the pre-run estimate blank and preserve the provider's returned billing data.
- Append history with `mediaType`, `provider`, `modelName`, `endpoint`, `mode`, `settings`, `cost`, and local output paths.
- Update `/api/stats` pricing payload.
- Stats must use recorded historical costs, distinguish estimates from charges, and keep missing costs unpriced. See `docs/stats-analytics.md` for Local/Global scope and reconciliation rules.
- Shared pre-run estimates belong in `src/generationPricing.js`. Resolve the provider from the model's explicit provider preference and actual configured-key availability; do not infer it from arbitrary key priority. Multiply known unit cost by batch count and label the number as an estimate.
- Preserve a history item's stored provider-specific cost when it has a named pricing source. Repricing old runs with another provider's current formula corrupts the historical record.
- `Auto` duration and any other unresolved billing input remain unpriced until the provider returns the actual value. Do not substitute a convenient default merely to display a number.
- If cost cannot be estimated, mark it unpriced rather than pretending it is free.
- Free local operations should record `$0` only when they are truly local and costless.
- Edit node ffmpeg operations are local and should record `$0` local edit cost metadata in history.

## Persistence Standards

Saved workflows are long-lived project files. Changes must avoid breaking them.

- New, Save, Save As, Open, and Import live under the left toolbar File menu. New clears the current graph into an untitled blank workflow; Open replaces the current graph; Import merges the selected workflow into the current graph.
- New, Open, and Import must use the unsaved-change guard before discarding or changing the current graph. New resets project id, package path, file path, local file handle state, groups, selections, and viewport, then marks the blank workflow clean.
- When a workflow replacement would discard unsaved graph or project-name changes, prompt with Save, Don't Save, and Cancel. Save writes never-saved workflows to the local app saved-workflows folder.
- Ctrl+S and Cmd+S save the current workflow. If it has never been saved, use the default local saved-workflows registry rather than requiring Save As.
- The Recent workflows dropdown behaves as a Recent Files list backed by the local server registry, not as a live scan of every JSON file on disk. The trash action removes the workflow from the dropdown immediately without a confirmation dialog; it must not delete the local registry JSON, packaged workflow JSON, or external workflow JSON from disk. Re-saving or re-opening a workflow can register it in the dropdown again.
- New/Save/Open/Import orchestration belongs in `src/useWorkflowPersistence.js`; workflow document construction and display paths belong in `src/workflowFiles.js`; graph fingerprints, cloning, deduping, import remapping, and stale runtime cleanup belong in `src/workflowState.js`.
- Persist `data.nodeReferenceBindings` with node data. Loading or normalizing a node must preserve valid unknown binding fields; copying/importing a graph must remap binding values for every copied source node id.
- After a successful save, update the Recent workflows list by upserting the returned workflow summary instead of immediately reloading every project. Keep the summary shape compatible with `readSavedWorkflowSummaryFiles`.
- Server saves should migrate legacy projects when needed, read summary files for collision/existing checks, write the workflow/package, return the registered workflow promptly, and schedule the workflow-index rebuild in the background.
- Background workflow-index rebuilds should log success or failure but must not make an already-successful save look failed to the user.
- The dirty/unsaved fingerprint includes nodes, edges, groups, project name, and package path. It intentionally excludes viewport pan/zoom.
- Fingerprint caches require immutable node/edge/group updates. Undo back to saved content must become clean; runtime progress, recovery controls, and Timeline frame payloads must not mark the document dirty. Measure actual geometry changes before invalidating React Flow handles; do not remeasure on every progress tick.
- A missing history file is different from an unreadable or corrupt one. Retry transient failures, preserve the last-good backup, quarantine recoverable corruption, and refuse writes after unresolved read failure. Never delete history/index data or replace it with an empty array to hide a read error. Atomic JSON writes must not fall back to copy-overwriting the destination.
- Project output records are independent of source-node lifetime and recent-history retention. Package copies must remap catalog assets as well as graph assets; old recent-history URLs must not override remapped catalog records on restart.
- Add normalization for new node fields.
- Preserve unknown data fields when normalizing unless they are unsafe runtime state.
- Migrate renamed node types or ports.
- Clear stale `running` state on load.
- After load, reconcile saved remote-video jobs only into their original workflow/package scope and existing node IDs. Preserve `data.remoteVideoRunIds` acknowledgements so completed jobs are not reinserted after the user removes a result. Do not copy job ownership into Save As workflows or newly pasted nodes.
- Keep `resultItems`, `resultUrl`, and selected result indexes compatible with existing workflows.
- Store reusable assets under `public/models` or `public/models/poses` only when they should be versioned with the repo.
- Store unpackaged generated outputs under `/outputs/<workflow-name>/`, unpackaged uploads under `/uploads/<workflow-name>/`, unpackaged helper dependencies under `/outputs/<workflow-name>/dependencies/`, and registry copies of saved workflows under `/saved_workflows`.
- Treat `/saved_workflows/inputs`, `/saved_workflows/outputs`, and `/saved_workflows/dependencies` as local app storage for copied/generated assets. Keep those media files ignored by git; only `.gitkeep` placeholders should be tracked.
- Treat `server/data/*.json`, including `recent-workflows.json` and index files, as local runtime state. These files should be ignored by git and never used as source fixtures.

## Clipboard And Import Standards

- Copy serializes every selected node, edges whose two endpoints are selected, and selected group metadata into the versioned `newtnode.workflow.nodes` payload owned by `src/workflowClipboard.js`.
- Write the payload to in-memory state, browser local storage, and the system text clipboard when available. This allows paste into another open workflow or another NewtNode tab while preserving a fallback when browser clipboard permission is unavailable.
- Ignore ordinary text and unmarked JSON during graph paste. Clipboard parsing must be defensive and must not turn malformed external text into nodes.
- Paste creates fresh node, edge, and group ids, remaps edge endpoints and group membership, and remaps `data.nodeReferenceBindings` for referenced nodes included in the copied selection. Never retain source-workflow ids in the pasted graph.
- Preserve relative node spacing and internal connections. Anchor the copied selection's top-left at the current canvas pointer; use the legacy fixed offset only when no pointer position is available.
- Cross-workflow paste copies graph data, not hidden machine state. Managed local media URLs may remain valid on the same installation, but browser object URLs, running flags, and stale runtime-only fields must not become durable dependencies.
- Import follows the same id and binding-remap rules as paste, then deduplicates and places the imported graph in a clear canvas region. Open replaces the graph and therefore preserves valid saved ids instead of remapping them.

## Workflow Package Standards

Portable packages are the default Save As shape for workflows that need to move between machines or live on a shared drive.

- Save As opens the native folder picker and lets the user choose the parent folder.
- Save As creates or updates a package folder named from the workflow, with this shape:

  ```text
  WorkflowName/
    WorkflowName.json
    autosaves/
      autosave-1.json
      autosave-2.json
      autosave-3.json
      autosave-4.json
      autosave-5.json
    inputs/
    outputs/
    dependencies/
    .newtnode/
      manifest.json
  ```

- `inputs/` contains uploaded source media used by graph nodes.
- `autosaves/` contains five rotating JSON-only recovery snapshots. A dirty packaged workflow is captured every two minutes; unchanged states are skipped, the oldest slot is overwritten, and existing package assets are referenced rather than duplicated.
- Autosaving must not overwrite the primary workflow JSON, mark the workflow clean, block manual saves, or add recovery commands to the File menu. Recovery uses the existing Open command on an `autosave-N.json` file, resolves assets against the parent package root, and leaves the restored graph dirty until the user saves it manually.
- `outputs/` contains generated media and explicit node outputs.
- `dependencies/` contains derived helper assets needed to rerun or inspect the graph, such as padded frames, composed mood boards, masks, and other intermediate support files that are not primary user uploads or final outputs.
- `.newtnode/manifest.json` records package metadata and copied asset entries. It should help diagnose missing assets without becoming required runtime state. Keep the package root visually focused on the workflow JSON and asset folders.
- A packaged workflow should still appear in the Recent workflows dropdown through the local `/saved_workflows` registry copy.
- Save updates the attached package in place. Save As copies the graph and its current local assets into the chosen package folder.
- Once a package is attached, upload and generation requests must include the workflow package context so new files are written into that package.
- Packaged assets must be served through `/workflow-assets/<workflow-id>/...`.
- Vite development proxy config must include `/workflow-assets` anywhere it includes `/uploads` and `/outputs`.
- Opening a packaged workflow must register its package path with the local server before packaged assets are expected to preview or run.
- Save As must assign a new workflow ID so the new package has an independent `/workflow-assets/<workflow-id>/...` namespace. Legacy copied packages that share an ID must remain addressable by searching every registered package root for that ID.
- Packaged asset resolution must search every registered package root for a workflow ID and may recover a uniquely matched file that was reorganized into a nested subfolder inside that package. Cache and coalesce registry reads so a canvas full of previews does not reload every workflow package per image; invalidate that cache when a registry workflow is written. Ambiguous or genuinely missing files must fail with an actionable missing-file message rather than being reported as an unregistered package.
- Importing a workflow must remap node, edge, and group IDs plus internal `nodeReferenceBindings`, and place the imported graph in a clear canvas area rather than directly on top of the current graph.
- Do not use browser-only object URLs or absolute machine-local paths as saved graph dependencies.

## Director And Storyboard Standards

- Director is the public node name. Keep `skillDirector` as the persisted type and retain focused `filmDirector*` implementation names unless a separately planned compatibility migration changes them. Normalize only legacy default titles matching `Skill Director`, `Film Director`, or their numbered defaults; never rename a custom title.
- Director uses internal type `skillDirector` and emits a built scene package from `directorOut`. Its reusable run logic belongs in `src/nodeRunners/skillDirector.js`; shot-limit, coverage, and revision helpers belong in the focused `src/filmDirector*.js` modules.
- Director approach values are stable persisted identifiers: `cinematic`, `vintage`, `animation`, `stop-motion`, `commercial`, `photography`, `music-video`, and `montage`. Approach-specific style, camera, scene rules, audio behavior, and revisions must flow through `src/filmDirectorApproaches.js`; do not implement approach labels as prompt-only UI decoration.
- Director duration value `still` is a stable persisted identifier displayed as `Still`. It forces `skillShotCount` and legacy `shotCount` aliases to `1` in UI changes, scene snapshots, workflow-load normalization, client requests, and server validation. Its single CUT must describe one static drawable instant and final prompt assembly must not reintroduce video pacing or audio policy.
- `musicIn` accepts connected audio for Music Video and optional music-driven Montage work. Music Video requires audible input and a Director-compatible downstream model. Local waveform analysis may describe measured levels and candidate energy rises, but must never invent BPM, beats, genre, instruments, lyrics, or a listening transcript. The actual connected audio remains the timing and lip-sync authority passed to generation.
- `referenceVideoIn` has mutually exclusive Extend, Camera, and Reference modes. Reference includes temporal performance, blocking, edit, composition, and sound-timing guidance while replacing source identity and styling with the active scene. Preserve the selected mode, cached source signature, analysis, and any reusable shot blueprint in the scene package. A replaced source invalidates only analysis derived from that source; it must not silently remove unrelated scene work.
- Director and Storyboard creative LLM routes use the strict schemas and reasoning instructions in `server/creative-llm.js`. Reject malformed, incomplete, refused, mismatched-count, or structurally invalid responses while retaining existing visible drafts. Successful repeated analysis may use `server/creative-analysis-cache.js`; cache hits must not duplicate recorded provider cost.
- A Director scene package may connect to Image Model `directorIn`, supported Video Model `directorIn`, and Storyboard `directorIn`. Unsupported video models must not serialize or receive a director package.
- Image and supported Video Models share Director prompt composition: a connected Text prompt is clearly labeled supplemental direction after the Director output. Keep the effective prompt a string, do not repeat character instructions already present in the Director package, and preserve all inherited visual references. On Image Models, a directly connected Style node is authoritative over conflicting Director visual treatment, and a directly connected Camera node is authoritative over conflicting Director or Style framing, lens, angle, composition, depth-of-field, and movement direction.
- Provider validation failures must surface nested error details as readable text. Never render object-shaped API errors as `[object Object]`.
- Krea Seedance submissions must stay within the provider-safe prompt budget. When Director plus supplemental Text exceeds it, preserve reference definitions, camera/shot-list detail, and the supplemental instruction while compacting lower-priority Director prose; the history `submittedPrompt` must record the actual bounded prompt sent to Krea.
- Krea Seedance reference images may use the API's multi-image array, but panoramic storyboard/contact-sheet images must be normalized to an opaque standard-ratio JPEG canvas before upload. Preserve the entire storyboard strip with padding; do not crop panels or replace the saved source asset.
- Atlas Cloud Director image analysis must use a bounded total payload of analysis-only copies rather than embedding full-resolution source assets. Divide the payload budget across every connected reference, preserve each complete image with aspect-safe scaling, never mutate the saved source, and surface Atlas response details such as HTTP 413 instead of replacing them with a generic media-analysis error.
- Atlas text and image-analysis LLM calls share one server admission slot. Explicit HTTP or envelope 429 rejections retry the same request up to three times with exponential backoff and visible progress; exhausted rate limits must not switch models. Billing/authentication failures and uncertain connection failures are not retried. Director image analysis requests its strict JSON schema explicitly.
- Building a scene locks its setup references until the user explicitly unlocks it. Revisions preserve the existing package, keep bounded revision history, and treat the user's revision note as the requested delta.
- Final prompt assembly preserves the complete locked Scene Overview, Style Direction, Camera Direction, continuity notes, and Shot List. Do not impose a global character cap or silently shorten editable Director sections; apply any required prompt compaction only in the downstream provider request builder, using that provider's documented limit while retaining the full Director package.
- Director tracks dependency signatures for Setup, Style Direction, Camera Direction, Scene Overview, and Shot List. Input changes mark only affected stages stale, retain their visible drafts and graph connections, and never start paid regeneration. Lock accepts the current draft; Regenerate is an explicit user action.
- Director may select `Use Connected Model` or an explicit supported Video Model. An explicit selection controls the downstream model, duration, resolution, aspect ratio, and audio mode; the Video Model must show the effective values. Unsupported models keep their existing behavior.
- Director audio modes are `Production Sound`, `Full Audio`, and `Silent`. Production Sound preserves dialogue and restrained location sound while forbidding score; Full Audio permits native synchronized audio; Silent disables native and connected audio. On a downstream Video Model, an explicit `Generate Audio` off setting is an authoritative local silence override: keep the toggle off, show the effective Silent override, remove connected/reference music from the request, rewrite the effective Director audio policy to Silent, and never let server-side music handling re-enable audio. Every provider path must honor the same effective audio decision.
- Director references remain typed as character, location, prop/image, and style inputs. A fresh Director build preserves every connected Character, Location, and Prop from Reference Setup in the request, tagged Reference Setup, and final prompt; do not silently truncate a category or infer omission from missing prose mentions. Revisions may intentionally remove connected assets from the active scene. Expanding a director package for a downstream node must preserve direct downstream inputs and deduplicate inherited references. The Director build's persisted `lastRunReferenceTags` is authoritative for downstream active references; do not drop a saved active reference merely because generated final prose omitted that tag. Image Models receive active locations and props through `imagePromptIn`, active characters through `characterIn`, and the built final prompt through `directorIn`. Director prompt `@tags` describe those setup assets and must not inject another image reference; direct Image Model inputs such as a Mood Board remain explicit additions. Video Models retain their existing reference-image and character routing.
- Image Models must count the fully expanded, deduplicated reference list that will actually be submitted, including active Director references and Composer-bound character references. Display the selected provider/model maximum, disable an over-limit run, and reject an over-limit server request before paid submission. Never silently truncate the tail of a user's reference list. OpenAI Image 2.5 accepts 16 reference images through its Fal and Atlas routes.
- Storyboard accepts either its normal scene-description/reference inputs or a built Director package. When Director controls the scene, derive the scene description, characters, references, and requested shot count from that package without duplicating Director's visual-style boilerplate.
- Storyboard frame count supports `Auto` and explicit bounded counts. A Director shot count may drive Auto, but the editor-wide Storyboard frame cap remains authoritative.
- A new Storyboard plan must pass `storyboardPlanIssues` before replacing current frames. Preserve every Director cut in order, group same-cut keyframes together, include required continuous-shot progression, use consecutive frame numbers, and reject duplicate or empty frame prompts. If visual QC cannot run, store `unreviewed`; never convert unavailable QC into a false pass or destructive automatic retry.
- Storyboard frame outputs and the assembled-board output are distinct connection targets. Use the shared Storyboard output resolver for previews, drag/drop, connection checks, and saved-edge migration so older frame ports remain compatible.
- Storyboard assembles a board output automatically after completed panel images settle. Generating or importing a frame creates a frame output. Assembly uses managed local assets, is debounced and does not call a provider; stale in-flight builds cannot publish after panel or project changes. Failed assembly waits for explicit retry or changed inputs. Legacy locked boards remain usable. Frame/PDF exports are available with at least one completed image, without waiting for assembly; PDF captions use the saved panel directions without a paid rewrite. Lightweight thumbnails are display-only and must never replace the full-resolution URL used for dragging, editing, export, or downstream generation.
- Saved Storyboard frame images live in a filesystem-safe subfolder derived from the node's scene name. Frame filenames repeat that scene name and preserve the frame's board number with at least two digits, for example `Scene_01/Scene_01_Frame_01.png`; explicit frame exports use the same filename convention. Never overwrite an earlier frame on rerun or re-export: append a version suffix starting at `_v02` when the preferred filename already exists.

## Newt Preset Standards

- Newt Presets are reusable graph fragments, separate from Style presets. The toolbar Presets popover groups Built-in presets and My presets and owns selection, insertion, input binding, refresh, deletion and Save selection as preset. Built-in definitions cannot be deleted; inserted copies remain editable. The floating selection action bar also starts capture. Use a nonmodal dialog popover so selects and binding controls keep their native keyboard behavior; Escape and outside clicks dismiss it without changing the canvas.
- Capture selected supported nodes, internal edges whose endpoints are both selected, and a group only when every node in that group is selected. Reject an empty selection and enforce the current 250-node and 5 MB serialized-graph limits with readable errors.
- Preserve node configuration, measured size, relative placement, internal connections, complete-group membership, and required managed media. Strip credentials, authorization values, passwords, secrets, provider job IDs, transient running state, and prototype-sensitive keys before writing a preset.
- Preset names contain 1 to 80 characters and are unique case-insensitively. Metadata JSON is local runtime data under `server/data/newt-presets/` and must stay ignored by git. Full-resolution dependencies are copied under `outputs/Newt-Presets/dependencies/<preset-id>/` and served as managed URLs.
- Every insertion creates fresh node, edge, and group IDs and places the fragment beyond occupied graph bounds. Remap nested node references as well as edge endpoints; repeated insertion must never share graph identity with another copy.
- Optional reusable slots are typed. Current roles are Image, Location, Prop, Character, Mood Board, Video, and Audio. A binding may target only a current-project node of the slot's stored node type. `Preset default` retains the copied source stored with the preset.
- Binding replaces the preset input node, reconnects its outgoing internal edges to the selected current-project source, updates matching `@tags`, and clears affected downstream results, locks, generated boards, previews, and Director build state. Insertion and binding must not trigger paid work automatically.
- Deleting a preset removes its library entry but retains copied dependency media because workflows that already inserted it may still reference those files. Do not recursively delete shared dependency media as part of preset deletion.
- Preset API work belongs behind `src/api/newtApi.js` and `server/routes/newtPresets.js`; persistence and media copying belong in `server/newt-presets.js`; graph sanitation, remapping, binding, and placement belong in `src/newtPresets.js`.

## Frame It Standard

- Frame It is the camera-plus-mannequin mode inside the catalog Composer node and captures an image result through Composer's normal image output. Internal type `frameIt` is retained only to load existing standalone nodes.
- Frame It UI and Three.js behavior live in `src/components/FrameItNodeBody.jsx`, `src/components/FrameItViewport.jsx`, and `src/frameItState.js`; keep reusable pose, normalization, joint-limit, and composition logic out of `NodeEditor.jsx`.
- Camera and figure state must normalize on load. Built-in and saved poses must respect anatomical joint limits and preserve complete compositions.
- Ordinary canvas navigation passes through the Frame It surface; only Frame It-specific modified gestures should control its camera. The node's scale is persisted independently from Storyboard and Mood Board scale.
- The bundled mannequin asset and its license remain versioned together under `public/models`.

## Provider Key Routing

- Fal is the default provider route for remote models that do not expose an explicit provider choice.
- Fal, Google, Krea, OpenAI, and Atlas Cloud each support multiple named credentials in Settings. One credential or `None` is active per provider; selecting a different credential must not delete the others.
- Models available from more than one service must expose a separate provider-routing preference. Seedance has an explicit Fal/Krea/Atlas choice; general Video Model includes MiniMax H3 and has a Fal/Krea/Google/Atlas/Local choice (Atlas and Local currently support H3 only); supported image models can route through Krea or Atlas; and text processing has a Fal/OpenAI/Atlas/Krea choice. Media runs must not silently switch away from the selected provider when that provider lacks an active key or returns an error. Provider choice, endpoint, and provider-specific cost must be recorded in history.
- Atlas generation submission is a paid side effect: submit once, persist and poll the returned job id, and never repeat an ambiguous POST. Transient polling failures may retry status checks for that same id. Provider errors must direct the user to Atlas history when acceptance is uncertain.
- OpenAI Image 2.5 uses the Fal key and preserves Fal quality-specific generation/edit pricing metadata. Flare and Sunburst are separate model choices across nodes and Settings, with no additional Variant control. Existing saved choices migrate using their variant field; explicit model names take precedence. Both text-to-image and edit requests must use the selected model’s endpoint. The node also exposes `Auto`, `Transparent`, and `Opaque` background modes; transparent output must request PNG so the downloaded original preserves its alpha channel. Existing nodes default to `Auto`. The Image Model node also retains `OpenAI Image 2` as an explicit legacy Fal/Krea option with its original quality tiers and pricing.
- Image Model nodes and image-generation fallbacks default to `16:9` aspect ratio and `1K` resolution.
- Nano Banana Pro must follow the explicit Image Generation provider preference: direct Google for Google or the configured Fal Nano Banana Pro endpoint for Fal.
- Provider failures such as high demand, quota exhaustion, overload, and 5xx/429 responses should display the selected provider's diagnostic on the node. The user may switch the relevant Model Providers setting before retrying; the runtime must not silently fall back.

## Settings Standards

- The Settings page shows local key status for Fal, Google, Krea, OpenAI, and Atlas Cloud without revealing stored secret values by default. Every saved credential has its own validation badge, and the active provider metric turns green only after a no-generation provider request verifies that selected credential; provider outages and timeouts remain unverified rather than being reported as invalid.
- Credential activation uses mutually exclusive radio controls, including a `None` option, rather than independent toggles. Saving model preferences, provider routing, and ComfyUI root configuration must preserve unchanged credential profiles. Save Routing persists explicit choices even when a selected provider has no active key; show a missing-key warning after the verified save and require credentials when generating. Show routing save confirmation and failures beside the Save Routing button, retain the draft on failure, and verify routing against an immediate Settings reload.
- Every Settings content panel must have an arrow-button header and independent collapsed state. Keep API Credentials and Model Providers open initially for first-glance clarity; secondary panels may start collapsed.
- Model Providers must show Seedance 2.0 / 2.5 Fal/Krea/Atlas, general Video Model Fal/Krea/Google/Atlas/Local, Image Model Google/Fal/Krea/Atlas, 3D Model Fal/Krea, Utility Image Fal/Krea, Utility Video Fal/Krea, and Text / Agent / Director LLM Fal/OpenAI/Atlas/Krea. Video Model owns MiniMax H3; do not show a separate H3 provider selector. Its legacy minimaxH3 preference mirrors veo after normalization; explicit veo wins when older fields disagree. Legacy H3-only preferences migrate into veo. General Video Model also lists FLUX 3 Max, Gemini Omni, Kling, Wan, and Creatify Aurora according to provider support; only Seedance has a dedicated category. Each routing tile must list the models supported by its currently selected provider. The selected media option remains authoritative until the user changes it.
- Saving User Preferences must update the mounted workflow immediately; reloading the app or remounting the Nodes workspace must not be required for display preferences to take effect.
- User Preferences must expose the Director processing model as GPT-6 Astra or GPT-5.6 Sol. The saved choice controls every Director route whose default is Astra, including planning, revision, connected-image analysis, and sampled reference-video analysis. Explicit `FILM_DIRECTOR_*` or legacy `SKILL_DIRECTOR_*` environment overrides remain authoritative.
- Local MiniMax H3 readiness and local ComfyUI configuration/preflight status remain available alongside the remote-provider controls.
- The Branch metric shows the current branch state and the loaded package version from `package.json`.
- Enabled Models controls the model dropdown preferences stored in runtime settings. It should list every callable Image Model and Video Model option exposed by `src/modelOptions.js`.
- Generation model dropdowns keep provider-incompatible models visible but disabled, gray, and labeled unavailable. Image, Video, Character, Storyboard, Coverage, Auto Aspect, Explore, and Director share the support check in `modelProviderRouting.js`. Seedance and MiniMax use their dedicated provider settings; Google's image preference retains the existing Nano Banana Pro override with other models routed through Fal. Provider compatibility does not rewrite saved model selections or change routing.
- User Preferences are normalized through `src/userPreferences.js` and stored in local runtime settings. `Show Presets Menu` defaults on and controls only the toolbar Newt Presets library, retaining the persisted `showPresetPanel` preference key. `Show Price Snapshot` defaults on and controls pre-run estimates on Generate buttons only; disabling it must not suppress completed-run costs or Stats records.
- Saving credentials must verify that every submitted credential id survives the immediate Settings reload. A stale server that does not understand a newly added provider must leave the user's form entry visible and request a restart instead of silently clearing the key.
- Repository update and restart actions belong in Settings and should call local server routes through `src/api/newtApi.js`.
- Runtime settings should remain local app state. Do not treat `server/data/runtime-settings.json` or generated history files as source fixtures.

## Cross-Platform App Standards

- Browser and shared helper code must not depend on Windows-only paths, drive letters, hidden-folder behavior, shell commands, or `.exe` names. Use URL helpers in browser code and Node `path`/`fs` APIs server-side.
- Preserve both Windows and macOS startup entry points when changing app launch behavior: `Launch_NewtNode.ps1`, `Launch_NewtNode.bat`, `Restart_NewtNode.ps1`, `Restart_NewtNode.bat`, `NewtNode.command`, `Versus_NewtNode.command`, `Versus_NewtNode.app`, and `mac/NewtNodeLauncher.applescript`.
- Launch and restart entry points must honor `PORT`, `VITE_API_PORT`, `NEWTNODE_CONTROL_PORT`, `VITE_CONTROL_API_PORT`, and `VITE_CLIENT_PORT` so side-by-side update tests do not stop, relaunch, or health-check the default NewtNode instance. Desktop file dialogs, folder launches, workflow persistence, and other control requests use the dedicated control port so long-lived generation requests cannot exhaust their browser connection lane.
- Windows and macOS launchers must run `scripts/ensureDependencies.mjs` before building or starting services. The preflight owns automatic npm installation after a pull; keep its behavior and `docs/dependencies.md` aligned with `package.json` and `package-lock.json`.
- Preserve app icons and bundle metadata when changing launchers or packaging: `public/icon.png`, `Versus_NewtNode.app/Contents/Info.plist`, and the `.icns` resources under `Versus_NewtNode.app/Contents/Resources/`.
- Keep launcher ports, health URLs, package scripts, and README startup instructions aligned. Document platform-specific commands separately rather than baking them into shared code.

## UI Design Standards

- The canvas is the primary workspace, not a landing page.
- Node cards should be functional, compact, and scannable.
- Controls should be familiar: sliders/inputs for numbers, toggles for booleans, selects for option sets, icon buttons for compact actions.
- Text must fit inside buttons, rows, cards, and panels at desktop and mobile widths.
- Avoid one-off color themes. New media colors must be distinct from existing node categories.
- Do not add decorative orbs, oversized hero elements, or marketing-style sections inside the app.
- For 3D scenes, use Three.js and verify nonblank rendering.
- Use stable dimensions for boards, previews, result panes, and tool rows so hover or dynamic content does not shift layout.
- Scrollable tool panels should consume available space before introducing nested scrollbars. When a control list must scroll, make the scrollbar discoverable and verify the first and last controls are reachable.
- Draftable text inputs and textareas update their DOM/local draft immediately and commit graph state on the shared debounce or blur boundary. Do not make each keystroke rebuild the full node graph, port map, and edge layer.
- Pan and wheel zoom use the live viewport ref and React Flow's imperative viewport API during the gesture, then commit Newt's persisted viewport state after the transient interaction. A delayed state commit must never snap the viewport back to an older value.
- Keep React Flow's offscreen culling disabled in the current full-detail mode. Every node retains its complete UI during pan and zoom, including at the 5% minimum zoom; graph execution remains independent from visibility. Reintroducing lightweight shells or overview proxies requires a deliberate feature change and production-scale interaction testing.

## Timeline Node Standard

The Timeline node is Newt Node's basic nonlinear editor and stays modular across timeline state, playback, rendering, media management, and UI.

- UI label and internal type: `Timeline` / `assembly` (legacy-compatible internal type).
- Catalog placement: after Edit and before Audio.
- Default shell: horizontal `1080px` by `520px`, with a resizable timeline workspace.
- Preview width/height fields set the shared composition and render dimensions independently in pixels. Commit on blur/Enter, cancel on Escape, and preserve drafts while typing. Wide compositions retain their aspect ratio in live preview frames; use clip Position controls to arrange simultaneous clips side by side.
- Inputs: multi-connect `videoIn`, `imageIn`, and `audioIn` ports. Each connected source is imported once into the media bin and remains identified by source node id and output port. When that same source port generates a new URL, update the existing bin media object in place and preserve its media id so every timeline clip using it follows the new result. Importing or refreshing media must not recreate timeline clips.
- Media bin: a fixed one-column rail occupies the left side of the node. It accepts connected sources and direct drops from Newt media-output drag payloads. Connected media is live-linked by source node and output port; direct drops are URL-based snapshots and do not follow later generations unless that source is also connected. Every asset preserves its visible aspect ratio, video and still assets show thumbnails, audio uses its waveform when available, and double-click opens an aspect-safe enlarged viewer.
- Bin assets are reusable source objects. Each drag to a compatible timeline track creates a fresh independent clip at the drop time, so one connection can supply any number of timeline instances. A connected source refresh preserves those clip edits and media references while replacing the source URL used by all instances.
- Media-bin drops are handled before populated thumbnails can consume native drag events. Newt preview drag-end coordinates also deliver a drop landing inside the bin if the browser omits the native drop. Repeated deliveries of the same URL remain deduplicated; different videos append without replacing prior media or clips.
- Outputs: `frameOut` emits the Timeline-owned playhead frame as an image; `videoOut` emits the most recent FFmpeg render.
- The transport shows the current zero-based frame number beside its timecode, calculated from the playhead and Timeline FPS using the same rounding as the timecode.
- Extract Frame snapshots the playhead at click time, pauses playback, and saves the visible composition as a managed full-resolution PNG at the top of the Timeline media bin. The still remains a snapshot and can be dragged to a track or onto the canvas to create an Image node. It uses active visible clips with their source trim, speed, reverse timing, layer order and transforms; In/Out render markers do not affect the still. Gaps produce black. Extraction has local busy/error states and preserves Timeline live-frame and rendered-video outputs.
- Both Timeline output rows and handles live on the right-hand node edge. Preserve the `frameOut` and `videoOut` ids when changing their layout.
- Preview nodes remain ordinary viewers. Timeline owns playback and publishes throttled playhead-frame updates through existing graph result propagation; do not add timeline state or transport ownership to Preview. Loop In/Out is a persistent Timeline transport mode: it is disabled without a valid two-marker range, starts at In whenever playback begins outside the range, and wraps from Out back to In without pausing.
- Resized Preview windows allocate the remaining body area to the media stage. Image/video intrinsic dimensions must not affect that allocation; fit the complete frame inside the stage with contain, and keep the live playback readout content-sized.
- Scrubbing remains frame-accurate and withholds a requested channel until its seek completes. Forward playback instead keeps each decoded channel visible through ordinary decoder drift, avoids issuing another correction while a seek is active, and only seeks when drift is large enough to threaten synchronization.
- Timeline timeline focus owns clip-editing shortcuts. Ctrl/Cmd+C copies the selected clip instance with its trim and slip state, Ctrl/Cmd+V pastes a fresh instance at the playhead, and Delete/Backspace removes the selected clip. Handled clip shortcuts must stop propagation so canvas-level copy, paste, undo, and node deletion do not run from the same keypress; ordinary text fields retain native editing behavior.
- Persist only normalized serializable timeline state. DOM media elements, decoder state, request state, and undo/redo stacks remain runtime-only.
- Editing operations are immutable state transitions. Current operations include split, trim, ripple delete/trim, slip, pointer-locked clip sliding with magnetic edge snapping and deliberate compatible-track switching, track add, visibility/mute/lock, zoom, scrub, persistent In/Out range markers set with I and O, marker jumps with { and }, bounded In/Out loop playback, and undo/redo.
- Visual tracks composite top-down with contain/letterbox behavior. Audio tracks and enabled embedded video audio mix at their timeline offsets.
- Media probing and waveform generation use local ffprobe/FFmpeg routes. Final rendering uses the local FFmpeg runtime and writes a managed workflow-package MP4.
- Timeline duration for display may include empty working space, but renders stop at actual content end.
- New track kinds such as subtitles or AI annotations should extend the track schema and renderer adapters without changing the master clock or Preview contract.
- The design is adapted from OpenReel Video's MIT-licensed clock/history/module patterns; provenance is recorded in `THIRD_PARTY_NOTICES.md`. Do not vendor the complete OpenReel app into Newt Node.

## Edit Node Standard

The Edit node establishes the standard for local ffmpeg-backed media editing nodes.

- UI label: `Edit`.
- Internal type: `edit`.
- Catalog placement: under Utility and above Audio.
- Output port: `editOut`, colored as image or video based on the selected source type.
- Inputs: `imageIn` for image effects and `videoIn` for video effects. Image and Video source tabs filter the effect list to compatible definitions. Switching source type or effect group should remove stale incompatible Edit edges.
- Visible effect groups are `Transform`, `Time`, `Color`, `Blur`, and `Effects`. Backend support for older hidden cleanup effects may remain for saved-workflow compatibility, but hidden groups should not appear as tabs.
- Effect definitions, labels, controls, defaults, and definitions live in `src/editEffects.js`. Backend ffmpeg filter mapping lives near `/api/node/edit-media` handling.
- Edit node operations are local ffmpeg edits. They should not call a paid provider.
- Source URLs must resolve to local NewtNode assets under `/outputs`, `/uploads`, or `/workflow-assets`; remote or browser-only object URLs should fail with a helpful message.
- Output files should be managed assets written to the active workflow package `outputs/` folder, or to local `/outputs/<workflow-name>/` when no package is attached.
- Video output formats are MP4, WebM, and ProRes MOV. Image edits output PNG.
- The Settings drawer should show a live ffmpeg-backed preview frame for the selected effect and source. Preview requests should debounce control changes, ignore stale responses, and return temporary inline PNG data instead of writing output/history entries.
- Video previews use a frame-time slider. Time-only effects should still preview a representative frame: Trim previews within the selected start/end range, Reverse maps the selected preview time from the end of the source, and FPS previews the source frame because it does not visibly change a single frame.
- Image `Crop` uses an interactive crop box and never crops the source merely because the node shell was resized. Normal dragging is freeform; Ctrl-drag preserves the current crop proportions.
- `Scale` seeds pixel Width and Height from the connected source dimensions. Sliders and direct number inputs stay synchronized; the aspect-lock toggle keeps dimensions proportional when enabled.
- Use the visible label `Invert` for the legacy internal effect id `negate`. Do not expose the hidden Cleanup group or retired one-click Flip Horizontal, Flip Vertical, Rotate 90, or Crop Center entries.
- Time `Trim` uses start/end seconds tied to a compact clip timeline. Dragging the head or tail updates the fields, and typing in the fields updates the handles. The default end time should seed from the connected clip duration when metadata is available.
- Brush Inpaint exposes `Create mask` in the compact and enlarged brush controls. It saves the current painted region as a black-background, white-region PNG result without calling the inpaint provider, and the Edit mask output port emits the newest mask result.
- Edit outputs should append to `resultItems`, preserve previous results, support download, and connect anywhere a normal image or video output can connect.
- History entries should use provider `local`, endpoint `local/edit-media`, model name `Edit: <effect label>`, and `$0` local edit cost metadata.

## 3D Node Standard

The 3D node establishes the standard for model generation nodes.

- UI label: `3D`.
- Internal type: `model3d`.
- Color: teal `#14d8c8`.
- Output port: `modelOut`.
- Output media: GLB by default.
- Preview: shared lazy `Model3DViewer` wrapper.
- Model menu: `Hunyuan 3D 3.1 Pro` (Fal or Krea) and `Rodin 2.5` (Fal or Krea). Saved unknown labels normalize to Hunyuan for backward compatibility.
- Required input: `frontImageIn`.
- Optional inputs: `backImageIn`, `leftImageIn`, `rightImageIn`, `topImageIn`, `bottomImageIn`, `leftFrontImageIn`, `rightFrontImageIn`.
- Backend payload should preserve named view mapping instead of relying on connection order.
- Rodin receives connected views in that canonical named-view order and accepts at most five images. Its mesh control maps to the supported triangle presets and always requests GLB output.
- Generated model results should be downloadable from the result pane.
- Stats should count 3D runs in media mix and estimated spend.

## Verification Checklist

Image editor pen annotations in Edit/Remove mode are location instructions, not output artwork. After generation, restore the clean original along the drawn stroke footprint plus a small edge halo so copied circles and guide marks do not survive there in saved results. Keep the interior of a circled area editable; do not turn the circle into a filled preservation mask. Compose this cleanup with selection preservation. Render sketch intentionally uses drawing as artwork and must bypass annotation cleanup.

Nano Banana 2.1 is a separate Fal-only image model in the image catalog, Explore, Character, Coverage, Auto Aspect, Storyboard, and preview editor preference. Preserve Nano Banana 2 compatibility without matching the 2.1 label as 2.0. Use the published 2.1 schema (1K/2K/4K, supported aspect ratios, high thinking, web search off); do not expose the 0.5K option mentioned in pricing copy but absent from that schema. Preserve all references because the schema specifies no count maximum. Record the 2.1 endpoint, resolution, thinking setting, model identity, and estimated cost in History. Selection edits use a final guide reference and local preservation of unselected pixels, with no native mask field. Fal's integration-only availability notice must remain documented until verified live.

- Changes to shared persistence, scheduling, runtime launch, or canvas behavior require the full Node suite, production build, isolated API smoke, fixed-fixture performance check, and relevant checked-in Playwright tests. Keep Windows/macOS CI current. Tests must not call paid providers or mutate real project data. Native dialogs/GPU checks require the corresponding platform and must be reported separately.
- Performance diagnostics remain opt-in, expire automatically, and export allowlisted counters/events rather than raw logs or workflow content. Never expose provider credentials, signed URLs, prompts, or local asset paths in the support snapshot.

Before completing source changes:

- Run focused tests while iterating, then run `npm test` when shared node, graph, workflow, runner, result, geometry, provider, or server behavior changed.
- Run `npm run build` for every source change that can affect the client or server contract.
- Run `npm run bundle:report` after startup-loading, lazy-loading, or heavy UI ownership changes.
- Run `git diff --check` for every change.
- Run `node --check server/index.js` and any touched `server/routes/*.js` file when the server changed.
- When Settings, update, restart, or health payload behavior changes, verify `/api/settings`, `/api/settings/update`, `/api/settings/restart`, and `/api/health` with the dev server running.
- Run `git status --short --branch` and confirm only intentional source/doc changes are staged. Runtime files under `server/data/`, `outputs/`, `uploads/`, and generated workflow JSON should stay ignored.
- Confirm `/api/health` reports any new route flags.
- For workflow persistence changes, test New, Save, Save As, Open, Import, Recent workflows, and the unsaved-change guard. Confirm save success is not blocked by background index rebuild failures.
- When the dev client is not on the smoke default port, pass explicit smoke URLs, for example `npm run smoke:app -- http://localhost:5176/ http://localhost:3336/api/health`.
- Check that existing saved workflows still load.
- Check that new ports connect, reject incompatible edges, and auto-connect correctly.
- Verify node identity behavior: bind an `@token`, rename its source node, confirm the visible token updates while the saved node id remains unchanged, and confirm the next run uses the same source output. Include a duplicate-title case and a copy/import remap case when reference behavior changes.
- Check collapsed and expanded node states. Confirm every connected line stays visible and reanchors without an extra interaction when a connected section collapses or expands.
- For resize changes, test width-only, height-only, diagonal, minimum, maximum, saved/reopened, and shrink-back behavior. Confirm the primary media/workspace expands first, controls remain reachable, aspect ratios remain correct, and lines track every port during the drag.
- For large-canvas changes, test at 5%, 8%, 30%, and 100% zoom with a production-scale graph. Every node and edge must remain present, node bodies must not flicker or turn into proxies, edge weight must remain screen-stable, selection must stay correct, and pan/zoom must not snap back.
- For clipboard/import changes, paste a multi-node selection with an internal edge, group, and bound `@token` into another open workflow and confirm all ids are fresh and correctly remapped.
- For Output changes, test tokens in both Path and Filename, collision handling with and without `$index`, direct Output copy, source-run redirection, Preview propagation, save/reopen, and a genuinely missing external file.
- Check Preview behavior for every output media type touched. For right-rail image changes, open an image and verify Left/Right navigation skips non-images, wraps, and leaves typing controls alone.
- For generation-progress changes, verify provider percent, estimated percent, queue position, batch aggregation, terminal success/failure, polling shutdown, and progressbar accessibility.
- Check Stats after a recorded run or with representative history.
- Restart `npm run dev` when route changes are not visible in the running backend.

## Definition Of Done

A NewtNode feature is complete only when every applicable statement is true:

- Its visible behavior, internal data, route contract, and documentation describe the same feature.
- Existing workflows normalize without losing nodes, edges, references, results, settings, package assets, or legacy internal identities.
- New ports connect, reject, auto-connect, animate, and reanchor correctly; run scheduling respects every dependency.
- Results propagate to the source node, Preview, output rail, downstream nodes, Output routes, downloads, save/reopen, and direct drag/drop as applicable.
- Paid/model work uses the selected credential and provider, reports useful failures, exposes honest progress, and records reproducible history/cost/Stats data.
- Media remains fully visible and aspect-correct in nodes, layouts, rails, modals, and previews except inside an explicit crop/edit operation.
- Loading, empty, disabled, success, partial-success, cancellation/timeout, missing-asset, and failure states are handled where relevant.
- Keyboard, focus, text editing, resize, pan, zoom, selection, and large-workflow behavior have not regressed.
- Files remain managed, portable, sanitized, and inside approved roots; no secret, personal path, signed URL, runtime data, or generated media is present in the diff.
- Windows and macOS behavior remains aligned for every platform-sensitive surface.
- Required focused tests, full tests, build, syntax, smoke, bundle, and manual checks pass at the feature's risk level.
- The final diff contains only intentional work and the user has not been promised a commit/push that was not actually requested and verified.

## Amendment Rule

### Image editor object selection

Visible box labels in the editor and saved selection PNG show only the number and description, such as `1. pickleball`, without an explicit @tag, duplicated descriptions, mode names or source suffixes. Tags, modes and source/destination geometry remain in the embedded metadata and settings controls.

New unnamed Move/Keep/Remove boxes attempt automatic object naming through the configured text/vision provider. Supply a bounded source crop plus a full-scene context image with its region outlined; never infer a name from the box mode. Confident results provide a short editable noun phrase, while uncertain results retain Object. Queue naming without locking drawing or description editing. Late responses must preserve manual descriptions, deleted boxes, changed source regions and switched source images. Successful names participate in undo/redo. Save and Generate wait for remaining unnamed boxes to finish identification. Cache matching source pixels/regions by provider/model and deduplicate request IDs; never silently replay a failed paid request. Record completed and invalid inference in History/Stats with actual provider/model/endpoint, two input images and cost or an unpriced state. This naming inference is independent from SAM shape segmentation.

The image-editor header exposes a Save icon for disk download without closing the editor or creating another canvas node. Save the selected generated result unchanged when reviewing a result; otherwise save the full-resolution current draft. Boxes include their visible numbered descriptions and embedded selection metadata. Composite drawing marks on a transparent layer so erasing marks never removes source pixels. Do not bake selection masks, hover shading, handles, compare dividers or zoom/pan into saved pixels. Disk save works without provider credentials and reports load/encoding errors in the editor.

The image editor must expose Boxes beside Object Selection, with New, Keep, Move, Remove, From Reference, and Text modes. Support named boxes, translation, scaling, and rotation of destination boxes, shared undo/redo, with no fixed box-count cap. Description-based @tags identify regions in both guided and native FLUX instructions; duplicate descriptions receive unique numeric suffixes. Save Selection is the single box-export action: save a full-resolution PNG copy to managed workflow outputs, record it as a zero-cost local History/output item, and add an Image Selection node to the canvas without changing the source. The PNG shows source/destination outlines and description-based tags, and embeds versioned UTF-8 JSON in the NewtNodeSelections iTXt chunk with all descriptions, tags, normalized source/target geometry, modes, context padding, optional masks, reference URLs and prompt. No selection-load or separate JSON/guide/sheet/instruction export controls are shown. A downstream parser can extract exact metadata; visible tags identify regions when a model only receives decoded pixels. Reference URLs identify separately managed assets. Region tags remain semantic instructions rather than additional graph ports. Double-click a box or its canvas label to edit its description; Enter or clicking away saves, and Escape cancels. Canvas labels use half-size text and corner circles use quarter-size visuals with larger drag hit areas. Generation errors remain visible over the canvas, and stale pointer gestures cannot silently block submission. Keep/Remove describe unrotated source regions; Move retains its original source separately. Keep regions override editable masks and remain unchanged through local compositing. Use the saved image-edit model and explicit provider with visual reference guides and instructions; do not silently substitute a model or promise exact semantic placement. Reference mode accepts one shared managed uploaded image per edit, respecting every supported model’s reference limit. Validate geometry, labels, Text content and reference requirements before paid work; reject fully protected edits. Use native FLUX 3 source/target rectangle rows for unrotated moves without a selected mask. Other models and rotated moves identify the subject with SAM 3 on explicit Generate if no mask exists; Remove uses identification too on non-FLUX models. Select object remains available for preview/reselection. Reuse selection-derived masks and cache each successful identification before the edit so retries do not resubmit it. Renaming a description-identified box invalidates its mask; selection-derived boxes retain theirs. Select the matching object by box overlap, retain its whole silhouette beyond the drawn box, then place only that cutout before one preferred-model cleanup generation. Use cutouts as identity/placement references, allowing destination interiors to be regenerated and relit. Restore Keep overlaps in the prepared composite and feather edit edges. Activating Boxes converts the current combined selection into a Move box in one undo step and consumes the brush/object selection, with no extra inference; retain prompt descriptions as contextual names. Keep a private per-version draft during the open editor session. Rerun Box Edit explicitly submits a new generation from the original source, resolved masks, prompt and transforms saved for that version, using the current preferred model/provider; never use the incorrect result as its source. Adjust Boxes restores the snapshot for changes. Keep earlier results and current drafts intact on rerun failure, reuse successful segmentation, and give each explicit attempt a fresh request id and normal History/Stats accounting. Do not include private snapshots in accepted result items or workflow packages. Clear a one-pixel edge around selected source silhouettes without expanding the destination cutout; Keep regions still win. Prioritize emptying the old footprint of the moved instance and reconstructing continuous contextual background, with no duplicates, old fragments or old lighting effects. Cutout guides and annotation references must use the prepared composite, never the old object position; FLUX cleanup must include an explicit source-vacancy removal row as well as destination placement instructions. The Compare divider must support direct viewport dragging without panning, synchronize with the bottom slider, and support keyboard adjustment. Record the box strategy in History. Send the clean original first for guided edits, or the prepared composite first for cutout cleanup; exclude box-guide ink from drawing-annotation restoration, and record box geometry/modes/references in History settings. Boxes require the Edit image method; Keep-only boxes require a user prompt.

Box operations include hidden scene-context instructions for removal, placement, rotation, scaling, references and text. Infer appropriate surface contact, lighting, shadows, reflections and occlusion from the full scene; preserve unrelated objects and their effects. The per-box Shadow / lighting area defaults to 35% of the shorter box side, is adjustable from 0–100%, and expands softly feathered generation guidance around source/removal and destination silhouettes. Dashed outlines show approximate context reach, not hard crop boundaries; Keep boxes override it. The complete returned scene is retained for continuous surfaces and lighting, so unrelated pixels outside Keep boxes are not guaranteed byte-identical. Model output may vary and long shadows may need a larger area.

While Object Selection is active, expose sampling density (8–64 per side), confidence and stability thresholds (0–1), and minimum region area (0–10,000 analysis pixels), defaulting to 32 / 0.75 / 0.95 / 100. Scan image for objects explicitly applies changed controls with a new Fal request; editing a control never submits work. Validate server-side before paid calls, record parameters in History, key automatic-mask caches by settings, and replace the hover map without discarding the user's current selection.

Object Selection persists successful SAM 2 scans and SAM 3 point/prompt masks in the local disk cache, keyed by source-file content, scan settings/query, and cache schema version. Reopening an image restores saved objects without provider work; identical copied assets reuse their scans regardless of URL. Cache hits work without Fal credentials and never create usage/Stats entries. Clicking replaces the selection; Shift adds and Alt subtracts (Alt wins when both are held). Clicking Boxes combines all current selection regions into one named box, preserving disjoint shapes, gaps and subtracted holes. Rename, translate, scale and rotate apply to that entire selection without additional segmentation. Undo restores the separate selection marks; redo restores the combined box. A click without a cached object uses Fal SAM 3 point selection. Select by prompt uses SAM 3 and replaces the selection with all returned matches; an empty result preserves the existing selection. Masks share the brush selection's undo/redo, clearing and full-resolution generation path. Generated edits inherit earlier masks when their oriented analysis dimensions match; Continue Editing restores them and labels them as a scan from before the edit. This preserves useful selections without claiming boundaries were recomputed. Existing target scans win over inherited ones. Changed dimensions require a new scan; Blank canvas results never inherit. Rescan explicitly bypasses cached results and replaces the current image's map without erasing the selection or the earlier image's scan. Failed cache saves warn without replaying completed segmentation or losing a successful edit. The cache lives under ignored `server/data/object-scans/`, remains local to this installation, and is not included in portable workflow packages. The generation model remains the User Preferences choice. Missing Fal credentials fail explicitly on cache misses without another provider. Record completed segmentation calls even when no masks are found or mask downloads fail; use matched Fal billing, the documented SAM 3 estimate, or explicit unpriced SAM 2 metadata. Requests never automatically replay. The existing gated Utility SAM 3 nodes remain unchanged.

This document is not law carved in stone. If a future feature needs a different pattern, update this document in the same PR or commit that introduces the new pattern. The important thing is that future development has one shared reference point.

### Explore

Explore owns its planning, sequential image queue, selected output and direction metadata. Keep the body lazy-loaded and use the shared image runner, provider routing, managed media and History. Stop leaves submitted work running; Resume never repeats completed or uncertain requests and preserves original settings. Its typed input handles remain mounted when References is collapsed. Preview receives the full image collection; other image consumers receive the selection. See [Explore](explore-node.md).

### Storyboard selected revisions

Storyboard View provides independent panel checkboxes and a revision instruction for one to eight panels. Planning reads all panel directions and selected images for context, preserving exact panel IDs and ordering. Only selected panels generate replacements; revised shot, lens, angle, beat, prompt and notes commit with each successful image. Planning failures leave all originals intact; individual image failures preserve that panel’s original image and directions. Selection and instructions survive save/reopen for explicit retry. Scene changes do not require replacing the entire board before a selected revision. Revision planning and image requests are never automatically replayed after an interrupted response. Reload/copy clears the active revision state and retains completed work with an inspection notice. Existing generation, QC, export, History and provider routing remain authoritative.

### Storyboard panel protection and versions

Protect prevents panel direction/image edits, deletion, revision, generation, restoration and reordering across that panel. Batch generation skips protected panels; creating a replacement plan requires unprotecting all panels. Protection does not prevent graph Undo or deleting the entire node/project. Successful image replacement (generation, revision, import or image edit) saves the prior image and its recorded directions, bounded to eight versions. Failed work does not create a version. Restoring preserves the current panel ID and number and saves the displaced image. Version URLs remain managed assets and travel with workflow packages. Older panels without history remain usable. `src/storyboardVersions.js` owns these rules.

### Storyboard spatial continuity

New plans and selected revisions include cast visibility plus spatial records for location/time, fixed world positions, camera setup, actual view, visible places and justified hidden occupants. The validator checks disappearing people, unexplained position changes, and changing visible occupancy in a held/returning camera. Singles, inserts, reverses, occlusion and explicit physical movement remain valid. One bounded text correction may reconcile occupants and synchronized prompts; it cannot invent camera cuts or exits, mutate unselected revisions, or repeatedly retry. Both text calls are recorded in History. Unresolved contradictions preserve the existing board. Image prompts and visual QC use physical staging and prior/anchor images. Manual prompt/camera edits invalidate future cast/spatial instructions together; generated image directions and versions retain their original staging. Legacy frames without these records remain usable and never replan on load. These are planning/review checks, not geometric simulation or a guarantee of model output.

### Storyboard quality review
Balanced is the default QC mode; legacy disabled Auto QC migrates to Off. Balanced reviews contained image copies and confirms suspected essential failures once at higher detail. Deep reviews original images. Off performs no automatic review calls. Only confident major essential failures can request the existing bounded regeneration; polish and uncertainty never trigger it. Each paid review records its own usage without automatic request replay. Review Sequence is an explicit advisory action using a compiled board when available, otherwise panel directions; it never changes panels or generates images. Saved notes indicate when their source panels changed.

### Provider pricing freshness
Settings > API Pricing provides a manual check and opt-in daily refresh, off by default. Strict official-source parsing preserves exact billing dimensions; unverifiable changed contracts invalidate future estimates, failed checks mark older estimates stale, and verified tables expire after seven days. Display account quotes expire after five minutes and are invalidated by account/catalog changes. Quote requests contain pricing settings only, never prompts or local asset paths. Atlas calculation failures and missing Fal billing events cannot cancel or replay a generation. Completed requests retain their captured estimate or matched provider-reported charge. Stats uses recorded historical amounts, including zero, and treats absent amounts as unpriced instead of recalculating them with current rates. Generation history applies a shared final pricing check for recorded Atlas settings/token usage and local Director work. Explicit local pricing reconciliation can fill missing amounts using current verified rates or original saved Atlas request quotes; it preserves existing prices and labels recovered estimates with the reconciliation date and previous cost. It never submits or replays generations.

Built-in workflow presets are shipped in `server/system-newt-presets`: Standard Workflow, Edit Image, Headshot Image, Cinematic Location, Style Transfer, and Cinematic Prop. The existing preset library lists System and User presets together. System definitions cannot be deleted; inserted copies remain editable and can be saved as user presets. Bundled example media is restored into managed preset storage when inserted, while user presets and reusable input bindings remain supported.

Canvas snap-to-grid is an opt-in local preference beside the unchanged zoom minus, percentage/reset, and plus controls. React Flow snaps node drags to the existing 28-unit canvas grid; Alt temporarily bypasses snapping. Group and selection-handle movement uses the same grid and translates contents together. Toggling the preference does not reposition existing nodes.

Audio Model is an ElevenLabs producer with Text to Speech, Speech to Speech, Sound Effects and Music modes. Keep its stable ports when modes change; disable the unused input rather than removing edges. Voice changes must respect the active credential and never substitute another voice on failure. Paid audio requests are never automatically replayed. Generated audio retains standard result, managed asset, progress, History and estimated/unpriced cost contracts.

Character ElevenLabs assignments persist voice IDs and display names without credentials. Director dialogue binds exact lines to stable Character node IDs, including copied/imported graphs and scene snapshots. Supported video adapters receive timed speech references; unsupported adapters reject the request before paid synthesis. Retain successful clips and checkpoint uncertain requests before submission, requiring explicit regeneration for replay. Durable video jobs must persist the prepared track and cue metadata and return them with portable result assets. Preserve the selected speech in finished video audio; describe model lip-sync accuracy and replacement of native soundtrack honestly.

Show an explicit voice handoff mode before video generation: exact prepared dialogue or Character voice samples. Exact preparation must submit speech only, expose playback and current-input readiness, and reuse clips on Video Run. A voice selection alone must not silently become native generated speech when audio is enabled. Voice samples carry their originating voice ID, reject stale assignments, bind to distinct speaker labels, remain managed/portable, and are never substituted for the finished dialogue soundtrack. Sample generation is an explicit paid action with existing audio History/Stats and no automatic retries.

Assigned voices belong to the Character source and must remain available to direct Character consumers, including Video Model without a Director. Exact dialogue is authored explicitly in the consuming Video node or Director; never guess paid speech from a freeform video prompt. Both paths use the same speech preparation and retry protections. Preserve stable Character IDs when combining lines, and remap direct Video dialogue on graph copy/import just as Director dialogue.

### Flux 3 images
Image Model options expose Flux output format, prompt expansion, safety tolerance and version, plus the published 512SQ/768SQ resolution tiers. Flux has no separate quality parameter. Small tiers without verified pricing are explicitly unpriced. Ideogram options expose quality, seed, prompt expansion, exact supported sizes and reference-edit precision/source geometry. Provider transport flags remain internal and image count continues to use Newt's tracked Batch control. Model-specific fields are additive and retain legacy defaults for older workflows.
Flux 3 is available through Fal for image generation, Storyboard, coverage/character sheets, and the image-edit model preference. Keep it out of Atlas/Krea image provider support until their image endpoints are verified. Shared controls offer 1K/2K/4K and supported aspect ratios, with up to ten references. References are resized without cropping to at most 4 MP and at least 256 pixels per side before upload. The image editor sends selections as an extra black-and-white reference guide (Flux has no native mask field), then restores unselected pixels locally. Record the exact endpoint, settings and a clearly labeled BFL standard-rate estimate; matched Fal billing supersedes estimates. No temporary launch discount is assumed.

Production rebuilds retain existing hashed client assets for open windows. Node API mutations must not be automatically replayed after a lost response. Ideogram validates every reference and mask before upload, using lossless provider copies with identical pixel geometry when a source exceeds 25 MB; copies still oversized fail before submission.

Audio Model offers Dialogue and character voices mode with a stable characterIn input. Connected Characters supply current names and ElevenLabs voices without requiring image sheets; manual dialogue rows require a speaker name and voice. Run creates one managed audio track with ordered lines and pauses, reusing the existing cached speech engine and per-line History accounting. Connect audioOut to a Video Model audio reference input to use the track. Video Model no longer exposes dialogue controls; existing saved dialogue remains runnable for compatibility.

Video Model retains an explicit Character voices selector for Seedance and MiniMax H3: Off or Voice samples (model dialogue). Samples mode validates current Character samples and passes them as named audio references with explicit speaker assignments. Exact dialogue authoring remains in Audio Model; saved legacy exact dialogue remains selectable when present.

Video Model ignores empty legacy dialogue placeholders when inferring its Character voice mode. Only nonblank saved speech enables implicit exact dialogue; explicit Off and samples choices remain authoritative; saved exact-dialogue mode with only blank rows is inactive. Placeholder data remains preserved.

Video Model exposes Off, Voice samples (model dialogue), and Exact dialogue audio for Seedance and MiniMax H3. Exact mode consumes one completed Audio Model or Audio node through Reference Audio; author dialogue in Audio Model, not removed inline Video controls. Explicit mode selection takes precedence; legacy saved dialogue data remains supported for compatibility. See [creative workflow](creative-workflows.md#dialogue-and-character-voices).

Video Model Exact dialogue audio now consumes one connected Audio Model or Audio node through Reference Audio. Inline dialogue authoring and Prepare ElevenLabs controls are removed. Overlength speech receives a managed first-15-second copy, preserving originals, and is submitted as the sole audio reference with lip-sync instructions and retained in the video output.

## Explore look controls

Explore Mode defaults on; off requests restrained execution. Random style and grade choices resolve once per batch, persist per result and queue, and stay fixed on Resume and refinements. Image/Product references preserve scene content and composition unless the brief explicitly asks to change them. These are generative instructions, not a pixel lock. Planning locally normalizes palettes and unused echoed metadata, validates all required creative fields, and never makes an extra paid request to repair malformed output. Legacy queue settings, image model choices, and provider selections remain intact.

## ElevenLabs v4

Eleven v4 is available only for Text to Speech, with up to 10,000 characters including literal audio tags. Multilingual v2 remains the default. Only Stability and Similarity are sent for v4; switching models preserves hidden Style, Speed and Speaker boost settings. v4 estimates use a separate $0.08/1,000 character rate with an optional environment override; missing tariffs stay unknown. A health capability prevents stale backends substituting another model. Dialogue preparation and Character voices retain their existing contracts.

## Nano Banana 2.1 provider coverage

Nano Banana 2.1 is offered across Image workspace, Image Model, Explore, Character, Storyboard, Coverage and Auto Aspect. Krea uses `/generate/image/google/nano-banana-2.1`, high thinking, 1K/2K/4K and up to 14 ordered references; it excludes 8:1 and native pixel masks/transparency. Validate complete labeled prompts, all local assets and settings before uploads. Krea estimates are $0.03/$0.0505/$0.0755 per image. Existing Fal contracts and selection-guide image editing remain supported. Atlas 2.1 remains unsupported. Nano Banana 2 and Ideogram generation are retained by user decision, with no model-retirement migration.

## Seedance 2.5 drafts, editing and references

Draft is opt-in on Video Model and per Director scene for Fal, Atlas and Krea. It displays and requests 480p while preserving the normal resolution and selected provider. Fal and Atlas drafts retain their provider ID, private receipt and conservative seven-day deadline. Finish at 1080p preserves the preview and appends the completed clip. Fal sends only draft_id, resolution 1080p and codec auto; Atlas sends only model bytedance/seedance-2.5/draft-complete and draft_id. Finishing remains available after prompt/model/provider changes and requires the originating provider's original enabled key. Legacy receipts belong to Fal. Receipts are local to the originating installation. Krea drafts have explicit nonfinishable metadata and a Preview only label; turning Draft off starts a new generation. Preview and completion have separate provider-correct History entries; draft prices remain unknown until verified request-specific estimates are implemented, without borrowing regular generation quotes. The client requires seedanceMultiProviderDrafts alongside seedanceDrafts before paid draft/finish requests.

Both previews and completion use the shared durable worker for single submission, original-key checks, restart/polling/download recovery, Output propagation and idempotent History. Never resubmit an uncertain paid request. Receipt IDs are deterministic for the provider draft and credential fingerprint, so repeated finalization cannot create alternate completion jobs. Missing draft IDs preserve the preview with a warning.

Edit Existing Video is an explicit Seedance 2.5 task on Fal, Atlas Cloud or Krea, accepts exactly one managed 4–30 second source video, optional images/audio, and no Director or Start/End Frames. Duration and framing display Source video without replacing saved settings. Fal receives task editing and auto duration/aspect; Atlas receives edit, duration -1 and adaptive ratio. Krea uses an explicit editing prompt with reference_videos; its wrapper preserves the source ratio and duration internally. Unknown editing prices stay unknown.

Video reference consumers use visible node/Character tags when the prompt names them; other consumers retain output labels. Seedance 2.5 maps to numbered @ImageN, @VideoN and @AudioN tags and rejects unmatched tags before submitting video generation. Older regular-generation workflows and existing exact-dialogue/audio behavior remain intact. Mocked tests validate contracts, not live generation quality.

Seedance 2.5 Draft is toggleable with Fal, Atlas or Krea selected. A connected Director owns its Draft setting. Never silently change providers for drafts.

Seedance Draft uses a switch for 480p previews on the selected provider; Fal and Atlas offer 1080p completion within seven days with separate billing per stage, while Krea offers previews only. Saved draft finishing always uses its originating provider and key.

Seedance output directories must be write-tested before paid submission. A completed durable video whose requested and fallback folders both fail enters save_blocked, retains its original ID and generated reference, and offers Save to workflow outputs or Retry original folder without regenerating. Atlas Seedance prompts retain complete creative instructions; the Krea 4 KB compactor and local node/file diagnostic context do not enter Atlas requests.

When a Seedance Output destination fails locally, automatically preserve the generated video in managed workflow outputs and surface the actual file path and fallback warning. The producing node remains playable; Output retains an error describing the failed requested destination. Paid input/specification remains immutable and no video is regenerated. If both storage locations fail, pause local saving with recovery actions rather than spin indefinitely.

FLUX 3 Max Keyframes reuses the stable referenceImageIn image port. Rows persist as flux3MaxKeyframes with stable port IDs and individual frameIndex values. Each row shows an image dot beside its Frame Indices field, +/− adds/removes the final row (1–10), and helper text sits at the bottom of the node. FLUX 3 Max exposes only Keyframe image inputs; separate Start/End ports and legacy frame request formats are unsupported. Boundary frames are optional. The adapter validates unique integer positions and a maximum of ten total frames before uploading or submitting. History records the keyframes endpoint, count and positions.

## Location Coverage

Coverage offers Subject (the existing Standard/Dynamic/Insane presets) and Location. Location scouts nine cinematic shooting positions from one connected image: establishing wide, opposite corner/alternate approach, reverse, left, right, entrance/arrival, elevated overview, primary feature, and detail. Interior/Exterior adapts the geography. Stay near reference favors supported geography and partial reverse views; Explore unseen space permits conservative inference. Unseen areas are inferred, not verified. Location uses its own scouting presets, independently of the retained Subject method. Settings persist with the node; old workflows default to Subject. Existing checkpoint, Stop, history, and result routing remain shared.

Utility Coverage accepts optional Style, Mood Board, and locked active Character inputs in both Subject and Location modes. Every shot includes the existing Style/grade instructions, Mood Board treatment prompt and image, and active Character sheet and identity/wardrobe instructions. Style overrides conflicting Mood Board treatment; the base image owns geography and the Coverage preset owns camera composition. Connecting Characters permits talent in Location scouting and replaces conflicting source identity without copying sheet backgrounds/layouts. Without optional inputs, existing prompts and references are preserved. These ports use stable styleIn/transferIn/characterIn ids and remain available when the Image drawer is collapsed.

Preview Layout tiles drag before or after another tile with a visible insertion edge, retaining order through save/reopen and export. Dragging a tile onto the canvas creates a media node using its full-resolution asset while preserving the Layout item. Double-click opens a Layout-scoped gallery; Left/Right wraps through images and videos in current layout order, preserving each image's own edit context. Typing/editing shortcuts retain their existing guards.

Style includes Found Footage: the shared prompt preset describes consumer camcorder/VHS/body-cam capture, first-person handheld composition, available light, limited dynamic range, analog video artifacts, and recording imperfections. Recording icons and timestamps are excluded unless requested. It uses the existing Style prompt path across connected consumers.

Director Approach includes Camcorder: suspenseful first-person handheld VHS horror lit by the unseen operator's POV flashlight. Planning emphasizes searching holds, motivated whip pans into physically staged extreme close-ups, spatial continuity, readable reveals, analog video artifacts, and the selected audio policy. Still remains one drawable instant. Camcorder uses the shared Approach dropdown, normalization, scene persistence, planning schema, Style Direction, default Camera Direction, and final scene rules. Existing approaches remain unchanged.

## Image editor details panel

The image editor inspector groups the active tool, edit instructions and output settings with consistent labels and fields. Show drawing controls only for drawing/selection-brush tools and selection prompts only in Object Selection. Keep Generate in a fixed footer while details scroll. Precision transforms, blending, detection tuning, help and selection export use keyboard-accessible disclosures, collapsed initially. Keep model selection in the header and distinguish reusable selection drafts from PNG box exports. Preserve all edit semantics, undo/history and explicit paid actions. The inspector remains usable on narrow windows without hiding the primary action.


Timeline supports Ctrl-drag (Command-drag on macOS) from its media bin onto an existing video-track clip to replace only that clip's source. The target highlights during the modifier drag. Replacement retains the clip id, edit position, duration, transforms, playback speed and reverse setting, starts from the replacement's beginning, and updates its linked embedded audio. Silent replacements remove only that instance's old linked audio; other uses of either bin asset remain unchanged. Locked linked tracks, incompatible media and insufficient replacement duration reject without partial edits. The operation participates in existing Timeline undo/redo and saved-workflow persistence; ordinary track drops still insert clips.

Seedance outpainting prepares directly from the original at the selected full generation canvas resolution (1080x1920 for 9:16 at 1080p), rather than the legacy 432x768 Wan canvas. Preparation uses H.264 CRF 12 and ProRes 4444 XQ MOV delivery; source fps is retained within the provider-supported 24–60 range. Fal outpaint requests use its documented high bitrate_mode and H264 codec with draft disabled. Atlas keeps its verified controls; no unsupported bitrate parameter is assumed. Prepared fingerprints are versioned to invalidate older small-canvas dependencies. Outpaint progress reads Generating Fill... initially and QC Edits... during regeneration.

Outpaint run ownership remains in src/nodeRunners/outpaintRetries.js for saved-call compatibility. Direct Run Outpaint submits only the explicitly requested initial video. Save Output consumes existing results and never runs Outpaint. QC cannot retry generation for any defect, including geometry, anatomy, incomplete fill or timing. Local finishing and AI review retain their results/cost records; rejected candidates stay on the Utility and cannot replace a passed Output. The server rejects legacy automatic repair submissions before uploads. User framing and creative prompts remain unchanged.


Video outpaint finishing first compares an unchanged-fill/source composite with bounded local color-match and overlap-feather variants. Blend Width is a maximum inward overlap in delivery pixels; only that edge ring may mix generated pixels, while the original core overlays fully opaque. The model generates beneath this ring; Wan preparation expands the generation mask inward by the corresponding amount. Full-resolution pixel spacing is retained across every join in every frame (only the long axis of thin strips is reduced), with per-edge seam and temporal measurements in server/outpaint-boundary.js. A candidate must improve the score without worsening another edge or the protected core; rejected variants roll back. AI reviews the selected local finish once and cannot widen the blend. This is not a guarantee of visual perfection. Results preserve local variant scores, selected width, global/local matching status and QC in existing History/result metadata.

Wan VACE outpainting prepares a 720p canvas (720x1280 portrait), its documented route maximum, using CRF 12. Requests explicitly select 720p, maximum video quality, no acceleration, no automatic/temporal downsampling and no interpolation. A 1080p delivery from Wan remains an upscale; Seedance supports native 1080p. No provider or API-key preference is changed.

Atlas Seedance outpainting requests native 1080p by default with draft disabled; its documented output_format=mov requests yuv444p for the retained generation intermediate. Native resolution choices remain user-controlled. Higher -sr/-esr resolutions are enhancement products, not native generation, and are not silently substituted. Provider usage and the MOV request are recorded through the existing durable job/History path; final delivery uses ProRes 4444 XQ MOV with planar 16-bit RGB matching, a 10-bit 4:4:4 composite and PCM audio. Higher precision does not restore absent source detail. AI review uses a high-quality H.264 dependency proxy; the master remains the MOV. Existing MOV playback uses the runtime browser-preview path.

Output offers Same as input (no conversion) for video. ProRes 4444 outpaint masters select it automatically unless the user explicitly chooses a delivery format; the same effective choice drives filename preview and saving, preserving the master bytes rather than silently transcoding to H.264 or ProRes 422. Explicit format changes persist outputVideoFormatExplicit; existing video outputs follow their input until a conversion is explicitly selected.

All video Output nodes default to Same as input (no conversion), copying the input container, video and audio without re-encoding. Format selections become explicit via outputVideoFormatExplicit; until then, legacy default format values do not request conversion. Selecting the contextual MOV option for an outpaint XQ master also copies it unchanged. Explicit MP4 checks the source codec (HEVC in an MP4 container must still convert to H.264); ordinary explicit ProRes conversion remains 422 HQ. Filename preview and save share the effective selection.

Save Output saves only the existing selected source result. Missing or unfinished results produce an actionable error without running, refinishing, or submitting an upstream node. Refinish selected result on the Outpaint node explicitly reuses retained raw media when source, framing, model, resolution and timing still match. Current color/overlap controls may change without changing that framing.

Seedance outpaint submissions keep the selected source clock intact and pad only the tail. The complete submission rounds up to an 8n+1 frame count, based on observed Edit output quantization; nonconforming counts produced compressed action. A tested cloned lead-in did not reliably prevent opening defects and is not used for new runs. Delivery keeps the exact selected frame count and original audio. Retained raw media is refinished using its stored preroll and submission frame count. Analysis exposes only submitted-video timestamps; drafts use same-frame visual events instead of ambiguous delivery-time ranges. Normal submissions include permanent spatial position, same-frame attachment and no-transition instructions. Provider timing compliance is measured, not assumed.

Blend Width is the requested inward overlap (no automatic halving). Local variants compare wider outward color falloffs of up to 256px while keeping that overlap/core fixed. MOV browser proxies and QC proxies use CRF 12 and error-diffusion dithering for 8-bit compatibility; runtime cache keys are versioned to discard older lower-quality previews. Native source/generation bit depth is not inferred from a higher-precision delivery container.


## Krea provider coverage (2026-10-21)

Krea image support includes Ideogram 4.5 at 2K with at most five references. Krea Video Model includes H3 and FLUX 3 Max alongside existing Kling/Gemini routes. 3D Model explicitly routes both Hunyuan and Rodin to Fal or Krea; Krea Rodin accepts up to five views and texture selection, without Fal-only mesh/material options. Utility routes cover matching Topaz image models, matching Topaz video models, FLUX video upscale and Topaz Hyperion SDR-to-HDR; unsupported variants fail rather than silently becoming Proteus. HDR requests retain 10-bit output and source timing/framing. Local-only utility operations remain local. Provider/endpoint/settings and unknown or verified costs are recorded with managed output files. Image Editor remains a separate Fal/Atlas workflow; generation availability does not imply native masked-edit support.

Text / Agent / Director LLM can explicitly select Krea. Use the documented Agent session API with pinned existing LLM choices and attached reference media. Submit one turn, poll its exact session/run, and never resubmit or change provider after an error. Request replies/analysis only, preserve required JSON/Director markers, and do not request generated media or external actions. Agent compute-unit billing is distinct from token APIs; unknown USD/token usage must stay unknown. Missing Krea credentials produce a selected-provider error. Do not enable Krea implicitly via legacy LLM fallback.

### Outpaint temporal evidence and real inward overlap

Utility Video Outpaint uses Seedance Edit. Prepare canvas & mask keeps the full original padded reference for analysis/restoration, creates a separate `generationVideoUrl` with black padding extended inward by Blend Width on expanded sides, and keeps a matching local static PNG matte. Only the generation canvas is sent to Seedance; no mask video is generated or submitted. The original core is restored after fill, with authorized inward overlap blending. The preparation fingerprint invalidates older canvases.

Analyze & draft prompt uses `server/outpaint-frame-presence.js` to present every selected delivery frame in numbered source contact sheets to the configured Fal video-analysis model through its vision route. Batches contain at most 24 frames; frame IDs and complete coverage are validated before drafting. Each paid analysis batch records usage/cost and managed evidence images in History/Stats, including malformed responses. Verified frame-indexed observations feed the final native-video prompt draft. Failed coverage preserves the existing prompt. Held conditioning handles repeat the first/last source frame and use the corresponding presence. This supplies every frame as evidence; it does not guarantee model perception or generative compliance. Hidden generation instructions enforce same-frame attachment, entrances/exits and occlusion: never pre-create legs or other parts based on later footage. QC is disabled; finishing uses only a deterministic inward source-overlap blend, with no review or regeneration.

Seedance outpaint instructions are kept concise so the shared 4000-byte adapter budget cannot silently remove geometry or frame-presence rules. `src/outpaintPromptBudget.js` reserves the actual hidden canvas/overlap bytes inside a 3900-byte submission budget and caps editable direction at the remaining space (up to 1100 UTF-8 bytes). Analyze requests that exact budget and fits oversized returned drafts locally before displaying them. Submission applies the same fitter to saved, pasted and connected prompts, so the length warning does not block Run. Whole sentences are preferred, timing/negative instructions take priority, and Unicode code points are never split. Hidden preservation/presence/canvas instructions are never compacted. The full original analysis draft is retained in History; submitted generations retain the original user prompt and record whether fitting occurred. No additional paid shortening call is made.

### Current outpaint finish: QC paused

Aesthetic QC is disabled globally, including saved finalQc/visualQc settings. `server/video-outpaint.js` composites the actual original crop through a smoothstep alpha ring inside Blend Width, preserving its opaque core. Match extension color is an explicit opt-in, independent of legacy Auto Match: `server/outpaint-color.js` samples up to 32 corresponding frames inside the regenerated overlap, fits robust per-side RGB offsets limited to 16/255, and withholds insufficient or inconsistent fits. Offsets stay constant through the shot and blend spatially across sides; no edge-row texture extrusion, contrast fitting, registration or per-frame grade is used. Correction is applied before source restoration with 10-bit processing. Disabled/unreliable correction leaves the extension ungraded. Matching metadata records applied/withheld evidence; it does not certify color or anatomy. Timing/aspect validation preserves unusable raw results.

Connected reference images have persisted ordered Appearance, Environment or Wardrobe roles. Environment guides the shared set layout/materials and Wardrobe guides garment cut/fabric/pattern/color; source footage owns visible content, lighting, framing, camera, performance and timing. Reuse the same reference image nodes across takes, retaining the same order/roles. These graph assets remain portable with the workflow; no frozen reference frame is composited and exact geometry is not guaranteed. Unassigned/legacy references keep their appearance-only policy. Analysis and actual provider prompts share role mappings and prompt budgeting. Refinish selected result uses retained raw media and saved framing/timing, accepts only finishing overrides, adds a result/history entry and makes no paid request. Backend capability videoOutpaintConsistency gates the new settings.

Seedance Analyze & draft prompt retains every-frame source evidence and native video analysis. It describes each missing region as completed scenery throughout the clip using compact inline TOP:/BOTTOM:/LEFT:/RIGHT: clauses; background replacement has no staged reveal or rendering timeline. Timing language applies only to real boundary-crossing subjects. Prompt fitting prioritizes these region clauses over decorative prose. The mandatory frame-one wrapper remains outside editable fitting. Green is a visual placeholder, not a documented hard mask or guarantee of first-frame replacement. This prompting improvement requires a new user-initiated Analyze/Run to affect a generation; existing prompts/results are preserved.

Finished results record matching.finishVersion=3 and qc.status=off. Source-restored Seedance finishes additionally record matching.motionValidation: every delivery frame is compared against the original picture, including overlapping feature-bearing patches at expansion boundaries and the known source pixels withheld for the blend overlap. A separate local coverage check flags flat black outer strips even when source motion matches perfectly. Failed correspondence or coverage retains a managed candidate dependency and raw paid result, displays the review reason, and cannot replace an accepted Output in direct runs or durable recovery. These bounded local checks make no provider calls and do not certify unseen anatomy, prop completion or generated backgrounds. Auto Match remains hidden; aesthetic QC stays off. Only confident uniform timing offsets may be corrected; inconsistent motion is not warped into place. Original pixels/time remain authoritative, apart from the explicitly authorized inward blend, scaling and encoding. Paid Analyze remains separate from disabled post-generation AI QC.

Video Outpaint guidance images supply appearance and art direction only for generated fill, including wardrobe cut, fabrics, colors and patterns. The source video remains authoritative for composition, camera, framing, pose, subject placement and motion. Analysis and Seedance/Wan generation preserve visible clothing and use compatible reference details only to continue missing areas; references never recompose the shot.

Explore art direction v3 assigns contrasting strategies across unlocked composition, camera, lighting, palette and materials within one planning call. Full planned decisions accompany image requests; saved queues retain their original prompt versions. Our connected Style input, reference controls and provider routing remain intact. Requires the exploreArtDirection backend capability. Adapted from SugerMilks/NewtNode 72c77e39ea317e174146b10047bcece67c0dbe00.

Storyboard Camera Personality offers Restrained, Expressive (default), and Bold planning guidance independently of Approach. Explicit panel cameras and story continuity take priority. Rendering honors requested optical effects, including Dutch Angle. Changing the setting never regenerates existing panels. Adapted from SugerMilks 72c77e3.

Authored Shot List planning (4.36): new boards start with one row; each authored row becomes exactly one frame with preserved IDs, order and explicit camera choices. Plan Shots retains media/versions and marks row provenance. Editing descriptions requires planning before generation; presets retain authored rows while clearing stale media. Existing summary/Director boards retain their approach. Source: SugerMilks 72c77e3.

PDF Script Import (4.39, SugerMilks 72c77e3): managed PDFs are parsed in a bounded PDF.js worker. Explicit import performs billed script discovery/transcription and drafts authored shots with source pages, dialogue, VO and timing. Alternatives require selection; existing/protected shots are retained. No image generation or automatic paid retry. Limits: 40 MB, 200 document pages, 50 selected script pages, with extra confirmation over 30.

ReFrame (4.40, adapted from SugerMilks 72c77e3): manual H3 camera-pass node with Orbit/Travel, local full-resolution frame capture, optional Refine/Topaz/lens versions and image outputs. Auto Refine defaults OFF; capturing alone adds no paid edit. Durable pass/upscale receipts recover by lookup; copies clear jobs; uncertain image edits are never replayed. Diagram positions and lens interpretations are approximate.

Vector (4.41, SugerMilks 72c77e3): manual Fal SVG generation/vectorization with PNG outputs, passive SVG validation, durable receipts, artwork layers/transforms/grouping/color/text, local font/layout references and saved looks. Our existing Output accepts SVG/alpha for Vector companions; PNG remains the default. Scumble boxes_tool.js and inpaint_layered.js were inspected: retain image-space geometry, explicit selection and one-step edits; this port remains an SVG artwork editor rather than Scumble raster/PSD editing.
