# Features and workflows

Audited 2026-10-15 against checkout 4.5.0-beta.0. This describes the local implementation; it does not certify current vendor availability, prices, generation quality, or every provider/model combination. See the [audit record](documentation-audit-2026-10-15.md) for evidence and checks.

## Start here

Launch with the normal Windows/macOS launcher for a supervised production session. Use Settings to select active credentials, provider routes, enabled models and User Preferences. The development alternative is `npm run dev`; see [development](development.md). Each workspace/window keeps its own draft; the installation shares a backend, credentials, history and provider work limits.

Create a graph with typed ports, connect sources, then run the producer or a dependency-aware selection/Run All. Producer nodes own generation and results; Preview is a viewer. A displayed option may still require an enabled model, supported provider, active key, external service, and valid references. Failure never authorizes a new paid submission or automatic provider switch.

## Node catalog

The table follows `src/nodeRegistry.js` order. Legacy load-only nodes remain valid in saved workflows but do not appear as new palette choices. Image Selection is a generated Image node/result with embedded selection data, not an additional registered node type.

| Node | Internal type | Availability | Role |
| --- | --- | --- | --- |
| Text | `plainText` | Current palette | Author prompt text without a model call. |
| Text Model | `text` | Legacy load-only | Legacy AI text processing; use Text Agent for new work. |
| Text Agent | `textAgent` | Current palette | Conversational assistance with persistent messages and the selected Text Agent model. |
| Image Model | `imageModel` | Current palette | Generate reference-aware images; Style, Camera, Mood Board, Character and Director can guide them. |
| Video Model | `videoModel` | Current palette | Generate video, use supported reference routes, and recover durable Seedance jobs. |
| Audio Model | `audioModel` | Current palette | ElevenLabs TTS, dialogue/character voices, speech conversion, effects and music. |
| Preview | `preview` | Current palette | Inspect connected results; arrange mixed media in Layout and open/edit full-resolution images. |
| Explore | `explore` | Current palette | Develop art directions, resolve looks, favorite/refine results and resume unfinished queues. |
| Auto Aspect | `autoAspect` | Legacy load-only | Legacy standalone reframing; use Utility Image / Auto Aspect. |
| Coverage | `coverage` | Legacy load-only | Legacy standalone nine-angle generation; use Utility Image / Coverage. |
| Style | `style` | Current palette | Combine a written Style treatment with optional Grade/palette instructions. |
| Mood Board | `transfer` | Current palette | Build and lock a visual-reference collage. |
| Character | `character` | Current palette | Create/select identity and wardrobe sheets plus voice references; lock/activate for visual outputs. |
| Camera | `camera` | Current palette | Provide camera/framing/lens instructions to compatible consumers. |
| Composer | `composer` | Current palette | Block scenes, bind Characters and create guide frames; includes Frame It mode. |
| Frame It | `frameIt` | Legacy load-only | Legacy standalone figure-framing node; new work uses Composer modes. |
| Director | `skillDirector` | Current palette | Build staged scene packages, camera direction and shot lists; use per-scene Approach and audio policy. |
| Edit | `edit` | Current palette | Apply local image/video transforms, crop, timing, color, effects, text and supported inpainting workflows. |
| Timeline | `assembly` | Current palette | Assemble media-bin assets into multitrack video/audio with local FFmpeg rendering. |
| Storyboard | `storyboard` | Current palette | Plan and generate panels; revise, protect, restore versions, review and export. |
| Image | `image` | Current palette | Load image media and expose it downstream. |
| Video | `video` | Current palette | Load video media and expose it downstream. |
| Audio | `audio` | Current palette | Load audio media and expose it downstream. |
| 3D | `model3d` | Current palette | Generate Hunyuan/Rodin GLB assets from supported references or inspect loaded 3D media. |
| Output | `output` | Current palette | Choose explicit save targets and supported export/transcode formats. |
| Utility | `utility` | Current palette | Choose image/video tools; execution may be local, hosted, or external ComfyUI. |

## Workflow recipes

### Generate a still

Text → Image Model → Preview; optionally connect Image Prompt, Style, Camera, Mood Board, Character or a built Director. Check the expanded reference count and selected model/provider before Run. Director Still uses one drawable shot. A selected Character sheet remains the identity reference; a Mood Board is treatment guidance rather than a replacement scene. Save results through Output when a particular location or format is needed.

### Scout a location or cover a subject

Image → Utility (Image / Coverage) → Preview / Layout. Subject offers Standard, Dynamic or Insane nine-shot methods. Location offers Interior/Exterior plus Stay near reference or Explore unseen space, with nine cinematic scouting views. Style, Mood Board and Character are optional Utility Coverage inputs and affect every shot. Location excludes people unless Characters are connected. A single image cannot prove unseen geometry. See [Coverage steps](creative-workflows.md#coverage-and-location-scouting).

### Develop looks

Brief and optional references → Explore → favorite/refine selected directions. Explore can plan up to 25 directions; resolved style/grade choices remain fixed through resume/refinement. Check [Explore](explore-node.md) for task, reference influence and queue behavior. Generative reference influence is not an exact pixel lock.

### Direct a scene and storyboard it

Connect available Character, Location, Props, Mood Board and optional music/video references to Director. Lock Setup, Style, Camera, Scene Overview and Shot List in order, then Build and connect the package to Image Model, supported Video Model, or Storyboard. Earlier edits invalidate dependent stages. Reference-video Extend, Camera and Reference modes serve different purposes; do not combine them implicitly. Storyboard supports independent planning, panel protection/versions, Generate Missing and explicit revisions. QC can report Unreviewed and does not certify a panel when review is unavailable.

Current Director approaches: Cinematic, Vintage, Camcorder, Animation, Stop-Motion, Commercial, Photography, Music Video, Montage. Approach governs planning and execution as well as appearance. Style is a written treatment/grade preset; Found Footage is available there. Camcorder Approach directs first-person VHS horror with the operator's flashlight and spatially motivated whip-pan reveals. Still remains one static instant; audio follows the chosen policy.

### Generate exact dialogue for video

Character voices or manual speaker rows → Audio Model (Dialogue and character voices) → listen to the completed track → Video Model Reference Audio. Select Exact dialogue audio on supported Seedance/MiniMax H3 routes and enable audio. Use Reference Images, not Start/End Frames. One completed Audio Model/Audio source supplies exact speech; longer recordings use a managed first-15-second copy without changing the original. Voice samples (model dialogue) is a separate mode in which the model creates the speech. The removed inline Video dialogue editor/Prepare button is not the new-workflow path. See [dialogue details](creative-workflows.md#dialogue-and-character-voices).

### Work with drafts and long video jobs

Seedance 2.5 Draft is opt-in. Fal/Atlas previews can finish at 1080p within the stored conservative seven-day deadline using the original enabled provider key. Krea drafts are preview-only; disabling Draft submits new full-resolution work. Seedance Edit Existing Video explicitly accepts one managed 4–30 second source on Fal/Atlas, not Krea. Durable tracking recovers accepted jobs after reload/restart; investigate uncertain acceptance rather than resubmitting. See [recovery](remote-video-recovery.md).

### Arrange and edit results

Preview Layout supports before/after tile insertion, full-resolution copies dragged to canvas, numbered image tiles, and a mixed image/video gallery opened by double-click. Left/Right follows current Layout order and wraps. Layout Export copies images and original video files in Layout order into a new folder under the chosen destination. Video-only Selects collections are supported; clips retain their format without rendering or transcoding.

The enlarged image editor provides object selection, boxes, drawing, contextual editing, and comparison. Scan image for objects explicitly submits SAM 2; selecting a missed region or selecting by prompt can submit SAM 3. Opening Object Selection alone does not scan. Done saves local drafts by source content identity, including masks, boxes and drawing/prompt state; reopening can reuse them without a scan. Save selections and boxes creates an annotated PNG/Image Selection with portable metadata. Local draft/scan caches do not travel with packages. Boxes are model-guided scene edits; Keep regions provide the explicit pixel-preservation constraint. See [creative workflows](creative-workflows.md).

### Assemble, composite and deliver

Video/image/audio sources → Timeline bin → tracks → edit and preview → local FFmpeg render. Connected bin items track their upstream source/port; direct drops are independent snapshots. Timeline owns transport/playhead and can feed Preview. Extract Frame saves the composition at the current playhead as a full-resolution PNG at the top of its media bin, independently of In/Out render markers. Drag a bin item onto the canvas to create a media node, or onto a compatible Timeline track to create a clip. Use Utility Composite Video for an ordered 2–32 layer stack with blend, opacity and optional masks; its live thumbnail is an approximation, while Run renders the result. Use Output for PNG/JPEG stills or H.264 MP4/ProRes 422 HQ MOV video. A 10-bit ProRes transcode does not restore missing source precision or create HDR.

### Save and reuse

File Save/Save As creates portable workflow packages with inputs, outputs and dependencies. Dirty packaged workflows also maintain rotating autosaves without replacing the main saved JSON. Save As creates a new package identity. Newt Presets stores reusable selected graph fragments with fresh IDs on insertion; deletion removes the preset library entry while retaining dependencies still referenced by workflows. See [Newt Presets](newt-presets.md).

The project output rail has a permanent project catalog independent of the bounded recent-history cache and deleted source nodes. Stats Local uses retained history plus the installation's durable ledger, not complete lifetime/cross-machine spending. Global reflects provider-reported billing support and key permissions, with its own date boundaries. Unknown cost remains unpriced. See [Stats](stats-analytics.md).

## Providers and models

Image catalog: Z-Image, Seedream 5.0 Pro, Nano Banana 2, Nano Banana Pro, OpenAI Image 2.5 Flare, OpenAI Image 2.5 Sunburst, OpenAI Image 2, Ideogram 4.5, Flux 3, Nano Banana 2.1, REVE 2.1, Krea 2 Large.

Video catalog: Seedance 2.0, Seedance 2.5, MiniMax H3, Kling O3 Pro, Kling O3 4K, Gemini Omni Flash, Wan 2.7 Reference-to-Video, Creatify Aurora.

Provider support below is the configured source contract from `src/modelProviderRouting.js`, not a live vendor promise. Tools may expose a narrower model subset; enabled preferences and credential validation apply. The Google image preference is a documented special case: Nano Banana Pro uses Google, while other supported image models use Fal. It does not authorize switching after a failed request. The separate image-editor model preference can have narrower routes than general image generation.

| Route | Provider | Configured model support |
| --- | --- | --- |
| Image Generation | fal | Z-Image, Seedream 5.0 Pro, Nano Banana 2, Nano Banana Pro, OpenAI Image 2.5 Flare, OpenAI Image 2.5 Sunburst, OpenAI Image 2, Ideogram 4.5, Flux 3, Nano Banana 2.1, REVE 2.1, Krea 2 Large |
| Image Generation | google | Nano Banana Pro |
| Image Generation | krea | Z-Image, Seedream 5.0 Pro, Nano Banana 2, Nano Banana 2.1, Nano Banana Pro, OpenAI Image 2.5 Flare, OpenAI Image 2.5 Sunburst, OpenAI Image 2, Krea 2 Large |
| Image Generation | atlas | OpenAI Image 2.5 Flare, OpenAI Image 2.5 Sunburst, OpenAI Image 2, Nano Banana 2, Nano Banana Pro, REVE 2.1 |
| Seedance | fal | Seedance 2.0, Seedance 2.5 |
| Seedance | krea | Seedance 2.0, Seedance 2.5 |
| Seedance | atlas | Seedance 2.0, Seedance 2.5 |
| Video Model (persisted `veo`) | fal | Gemini Omni Flash, Kling O3 Pro, Kling O3 4K, Wan 2.7 Reference-to-Video, Creatify Aurora |
| Video Model (persisted `veo`) | google | Gemini Omni Flash |
| Video Model (persisted `veo`) | krea | Gemini Omni Flash, Kling O3 Pro, Kling O3 4K |
| MiniMax H3 | fal | MiniMax H3 |
| MiniMax H3 | krea | MiniMax H3 |
| MiniMax H3 | atlas | MiniMax H3 |
| MiniMax H3 | local | MiniMax H3 (576P) |
| Text | fal | GPT-5.6 Terra, GPT-6 Astra, GPT-5.6 Sol |
| Text | atlas | GPT-5.6 Luna, GPT-6 Astra, GPT-5.6 Sol |
| Text | openai | GPT-5.6 Luna, GPT-6 Astra, GPT-5.6 Sol |

Nano Banana 2.1 has distinct Fal/Krea payloads, aspect ratios and estimates; Krea supports up to 14 references and excludes 8:1, while the integrated Fal schema does not specify a reference-count ceiling. Atlas 2.1 remains unsupported. Fal's integration-only availability note is dated 2026-10-06, not rechecked by this audit. Pricing is request/provider-specific and should come from the app's current estimates and recorded History rather than a static guide.

Audio Model uses ElevenLabs: Text to Speech (including Eleven v4), Dialogue and character voices, Speech to Speech, Sound Effects and Music. Configure ElevenLabs credentials separately from generic text-model routing. 3D offers Hunyuan 3D 3.1 Pro via Fal/Krea and Rodin 2.5 via Fal.

## Utility inventory and prerequisites

Image options in the current catalog: Auto Aspect, Coverage, Color ID to Matte, Image to Color ID, Qwen Camera Edit, Grab Still Frame, DWPose, Depth Anything, Topaz Image Upscale, Patina, BiRefNet Image, SAM 3 Image.

Video options in the current catalog: Extract Frame, Color ID to Matte, Composite Video, DWPose Video, Depth Anything Video, WanBlend, WanWarp, WanSegment, Wan VACE Mask-to-Video, Wan VACE 14B Inpainting, Wan 2.2 A14B LoRA Text-to-Video, Wan 2.2 A14B LoRA Image-to-Video, Wan 2.2 VACE Fun A14B Depth, Wan 2.2 VACE Fun A14B Pose, Wan 2.2 VACE Fun A14B Inpainting, SAM 3 Video, VOID Video Inpainting, BiRefNet Video, RIFE Video, Bytedance Video Upscaler, Flux Video Upscale, Topaz SDR to HDR, Topaz Video Upscale.

SAM 3 Image/Video Utility options are feature-gated off; their catalog definitions do not mean they are visible/callable. This gate is separate from SAM 2/SAM 3 selection tools in the image editor. Retired/legacy names such as Wan Fun Control are compatibility paths, not new callable choices.

| Execution | Examples | Prerequisites |
| --- | --- | --- |
| Local media | Grab Still Frame, Extract Frame, Color ID to Matte, Composite Video, Edit, Timeline, Output transcode | Bundled FFmpeg/FFprobe and readable managed media; no paid inference for these operations |
| Hosted tools | Coverage, Auto Aspect, Image to Color ID, Qwen Camera Edit, DWPose/Depth, BiRefNet, Patina, hosted Wan/VACE, RIFE/upscalers | Supported provider/key, required source media, and model-specific limits; generation can be paid |
| External ComfyUI | WanBlend, WanWarp; WanSegment defines segment configuration | Reachable ComfyUI, required custom nodes/weights/templates and valid local mappings; see [manifest](comfyWan-requirements.yaml) |
| Optional local model service | MiniMax H3 Local | Separate SGLang/Python/CUDA environment, weights and media mapping; see [setup](minimaxH3-local.md) |

Newt's npm dependency preflight does not install ComfyUI models or SGLang weights. Topaz SDR to HDR is an explicit hosted HDR workflow, distinct from simply transcoding an SDR file to 10-bit ProRes.

## Stops, errors and limits

The global red X stops active canvas waits and queued work, preserves completed results, and dismisses durable video tracking. It does not promise cancellation/refunds from a provider; accepted remote/local work may finish. Unsupported provider/model pairs, missing keys, invalid media and over-limit references must fail explicitly. Inspect History and recovery state before repeating a paid request.

Documentation describes implemented behavior. Mocked browser checks verify controls/contracts, not output quality; a passing local Windows check is not native macOS, GPU/ComfyUI, external service, or paid-provider validation.
