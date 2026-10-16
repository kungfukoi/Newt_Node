# Creative Workflows

This guide covers the current Director, Storyboard, Character, and shared image-adjustment workflow in NewtNode `3.0.0-beta.0`.

## Director

Director builds a reusable scene package containing setup references, style direction, camera direction, scene overview, and an ordered shot list. Its blue output can drive an Image Model, a supported Video Model, or Storyboard.

Director is the visible name used in the interface. Older saved default titles such as `Film Director` load as `Director`; custom node titles are preserved.

### Quick Start

1. Add a Director node.
2. Connect any Character, Location, Props, or Mood Board sources needed by the scene.
3. Choose an Approach and enter the scene direction.
4. Optionally connect a reference Video or Music source and configure how it should be used.
5. Review and lock Setup, Style Direction, Camera Direction, Scene Overview, and Shot List in order.
6. Build the scene.
7. Connect the Director output to an Image Model, a compatible Video Model, or Storyboard.

Changing an earlier dependency marks only the affected later stages stale. Existing text remains visible for review. Lock accepts the current draft; regeneration is always an explicit action.

### Inputs

| Input | Purpose |
| --- | --- |
| Character | Identity, wardrobe, physical continuity, and available character voice information. |
| Location | The authoritative environment or set reference. |
| Props | Objects or image references that must remain identifiable in the scene. |
| Mood Board | Visual treatment and design reference. |
| Video | Optional temporal, camera, performance, or continuation reference. |
| Music | Timing and vocal authority for Music Video, or optional pacing input for Montage. |

Connected assets receive stable reference tags. A fresh build includes every connected Character, Location, and Prop from Reference Setup as a tagged definition in the final prompt, without forcing every asset into every shot. A revision may intentionally remove a connected asset from the active scene.
Director does not silently cut off a reference when there are more than six in one input category. Downstream models apply their own explicit input limits.

### Approaches

| Approach | Intended Result |
| --- | --- |
| Cinematic | Grounded live-action direction, restrained coverage, continuity, and motivated camera movement. |
| Vintage | Practical vintage capture with an 8mm-inspired texture and cadence. |
| Animation | Coherent cel, CGI, digital-animation, or motion-graphics treatment. |
| Stop-Motion | Tactile miniature, puppet, or clay treatment with deliberate stepped posing. |
| Commercial | Polished premium advertising, beauty, product, or editorial presentation. |
| Photography | Professional still-image composition, lens perspective, pose, lighting, and visual hierarchy. |
| Music Video | Stylized performance and music-driven pacing using the connected audio as timing authority. |
| Montage | Distinct economical vignettes joined through deliberate visual and movement matches. |

Music Video requires connected audio and a supported downstream route. Director currently validates music use for Seedance 2.0, Seedance 2.5, and MiniMax H3. Montage can use music when supplied but does not require it.

### Still Duration

Choose **Still** when the final output is one generated image. Director immediately sets Shots to `1`, keeps that control locked at `1`, and persists the invariant through scene switching and workflow reload. Style Direction, Camera Direction, Scene Overview, and Shot List remain available; the Shot List describes one static drawable instant rather than temporal action or coverage.

When a built Director is connected to an Image Model, its final prompt becomes the primary image prompt. A directly connected Text prompt remains supplemental direction. Active Director Location and Props references flow to Image Prompt, active Characters flow to Character, and direct Image Model references are preserved and deduplicated. Repeated `@tags` in the Director prompt name those references; they do not add another image input. A Mood Board explicitly connected to the Image Model remains an additional reference. The Director itself does not impose a small image-count cap: the selected image model/provider sets the final ceiling. OpenAI Image 2.5 accepts 16 references through Fal or Atlas. The Image Model shows the fully expanded number that will be sent and refuses an over-limit run instead of dropping the last image.

A Style node connected directly to the Image Model overrides conflicting style, palette, lighting-treatment, texture, medium, and grade direction from Director. A Camera node connected directly to the Image Model overrides conflicting framing, lens, angle, composition, depth of field, and camera movement from both Director and Style.

### Reference Video Modes

Only one reference-video mode can be active:

- **Extend** continues from the source video's final visual and temporal state.
- **Camera** extracts shot order, framing progression, movement, and edit timing without importing the source's subjects or look.
- **Reference** uses temporal performance, blocking, camera, composition, edit, and sound timing while replacing source identities and styling with the connected scene assets.

Replacing the connected video invalidates analysis derived from that source without discarding unrelated scene work. Camera and Reference analysis may cache a reusable shot blueprint.

### Audio Modes

- **Production Sound** permits dialogue and restrained location sound but no score.
- **Full Audio** permits native synchronized audio.
- **Silent** disables native and connected audio.

Music Video uses the actual connected audio as the timing and vocal authority. Local analysis may report measured level changes, but it does not claim to detect lyrics, instruments, genre, or verified beats.

## Storyboard

Independent scenes now use Sugermilk's directing skill 2.2.0. Setup offers Auto or
an exact panel count, Standard/Dialogue/Action/Commercial/Montage approaches,
pacing, and optional duration guidance. Create New Plan confirms replacement.
Generate Missing preserves existing images; Regenerate Selected uses the current
directions, and Revise Selected updates directions and images together. Edit panel
opens camera/prompt controls, protection, prior versions and QC notes. Idle panels
remain editable during another panel's render. The export icon offers Frames or
PDF. Character inputs work in monochrome mode. Existing Director connections and
uploaded character sheets remain supported.

Storyboard can use its own scene description and references or accept a built Director package. When Director is connected, Director controls the scene description, active characters, selected references, and requested shot coverage.

Planning validates the proposed board before replacing visible frames. It checks that every Director cut remains in order, continuous shots receive required progression frames, frame numbers are consecutive, and prompts are nonempty and distinct. A rejected plan leaves the existing board untouched.

Visual QC reports reviewed results normally. If review cannot run, the board is marked **Unreviewed** instead of being treated as a false pass or triggering a destructive retry.

## Character Reliability

### Assigned dialogue voices

Video Model offers two explicit **Character voices** modes. **Exact dialogue audio** is the default: author speaker rows, click **Prepare ElevenLabs dialogue**, and listen to the combined track before **Run Video**. Preparation makes paid speech requests but submits no video. The **ElevenLabs audio ready** status applies only to the current model, lines and voice assignments; changes mark the preview stale, and preparation reuses unchanged cached clips. Video Run still validates current assignments. With audio enabled, selected custom voices without exact rows or explicit sample mode produce a local error instead of silently generating native speech.

For **Voice samples (model dialogue)**, first open **Character Build → Voice → Voice sample**, edit the short paragraph if needed, and click **Generate voice sample**. The generated clip is playable and saved with its voice ID. Choose Voice samples mode in Video Model; Character samples from direct inputs and connected Director speakers are submitted with separate speaker labels. Keep the desired dialogue in the video prompt or speaker rows. Instructions identify the sample as a voice reference and prohibit reciting its paragraph. This mode lets the video model generate speech; it does not replace the finished soundtrack with sample paragraphs, and exact voice matching is not guaranteed. Changing the Character voice requires a new sample. All samples share the model's audio duration and reference-count limits, so shorter samples or fewer speakers may be required.

In **Character Build → Voice**, select an ElevenLabs voice from the account's custom and default voices. Configure the ElevenLabs key in Settings first. Refresh reloads the catalog; selecting a voice does not generate paid speech and preserves uploaded voice samples. Choose **Use uploaded dialogue audio** to return to the existing sample workflow.

Connect the locked, activated Character to Director. In **Scene Overview → Dialogue and character voices**, add the exact lines, select each connected speaker, and set the pause after each line. Dialogue is saved per Director scene and binds to Character node IDs, so renaming, copying, and importing do not exchange speakers. Rebuild the Director, connect it to Video Model, enable audio, and run a reference-to-video route.

You can also connect Character directly to **Video Model → Character**. Open Video Model Settings, expand **Dialogue and character voices**, and add the exact lines and speakers there. A Director is optional. The Character's current voice assignment accompanies the direct connection; it is not inferred from freeform prompt text. If both routes contain authored lines, Director lines play first, then Video Model lines, with speakers deduplicated by node ID. The same voice, timing, saved-audio, and model-support rules apply. Image-only consumers continue using the Character sheet without making speech calls.

The Character voice picker shares the Character Sheet Model dropdown's font, colors, height, focus and disabled states. Its compact label and refresh icon follow the existing Character controls; contextual guidance is a tooltip, with visible text reserved for errors. Dialogue controls reuse node form styling and accessible icon actions.

Assigned dialogue currently supports Seedance 2.0, Seedance 2.5, and MiniMax H3. Models whose current adapters cannot consume this speech reject assigned dialogue before synthesis. Seedance 2.5 allows a combined dialogue track up to 30.2 seconds; the other supported routes use a 15-second ceiling. Speech must also fit the chosen video duration. Start/end-frame routes require moving the images to Reference Images.

At Video Run, ElevenLabs generates each exact line with its selected voice. The combined track and timed speaker instructions become model references for lip sync. The downloaded video receives that exact speech track to preserve voice identity; this replaces model-generated sound and does not mix background music or ambience. Visual lip-sync accuracy still depends on the video model.

Successful speech clips are saved as managed assets, recorded in History, and reused across retries. Changing a line or assigned voice generates only that changed speech. If a request has an uncertain outcome, check History and ElevenLabs before using **Regenerate dialogue audio on next run**, which explicitly permits new paid requests. An overlong dialogue error retains completed speech for reuse after adjusting duration.

Provider contracts: [ElevenLabs voice catalog](https://elevenlabs.io/docs/api-reference/voices/search), [Seedance 2.5 reference-to-video](https://fal.ai/models/bytedance/seedance-2.5/reference-to-video/api).

New Character nodes prefer Nano Banana Pro; existing model selections are preserved.
Seedream 5.0 Pro is available for 2K sheets. Standard Base Identity and CU sheets
share the plain charcoal foundation outfit, while Stylized preserves source
coverings. Wardrobe edits now explicitly transfer referenced headwear, eyewear,
footwear and layered outerwear consistently, preserving identity and crops.
The library labels Base and numbered Sheets, including assets stored only with a
managed local URL. Existing sheets are retained until you explicitly generate or
regenerate them; opening a workflow does not regenerate anything.

Character generation checkpoints its Base Identity and CU Video sheets independently. A successful sheet is retained immediately, so a later failure does not erase completed work. Wardrobe image and CU Video variants are also preserved independently and can be regenerated per wardrobe.

Enable **Stylized Character** for a stylized, creature, mechanical, toy-like, illustrated, or otherwise non-standard character whose source design must remain authoritative. The alternate prompt path preserves the required Character and CU Video sheet layouts while locking the source feature inventory, silhouette, proportions, materials, textures, colors, construction, and rendering style. It preserves a feature when present and keeps it absent when absent rather than assuming any particular anatomy. Combine it with **Cinematic Sheet** to retain that strict design lock while using one consistent realistic neutral-gray studio cyclorama across Base Identity, CU Video, and wardrobe-derived sheets.

The selected active Character sheet remains the full-resolution identity reference used by Image Model, Video Model, Composer, Director, and Storyboard. Uploaded custom sheets coexist with generated variants.

## Shared Image Adjustments

Preview/Layout and Edit share the same curve, brightness, contrast, and saturation normalization and pixel math. Matching settings should therefore render the same treatment in both surfaces. Preview operations work from a decoded copy and do not overwrite the original full-resolution asset until an explicit edit or export action is performed.

## Troubleshooting

- If a Video Model rejects a Director connection, select a model that supports Director input. Image Models accept the Director input directly.
- If Music Video cannot run, connect an Audio node to Music and confirm the chosen downstream model supports reference audio.
- If a stage becomes stale, review the changed dependency and rebuild from that stage rather than recreating the node.
- If Storyboard planning fails validation, the previous frames are intentionally preserved; revise the Director shot list or scene request and run planning again.

## Location Coverage

Coverage offers Subject (the existing Standard/Dynamic/Insane presets) and Location. Location scouts nine cinematic shooting positions from one connected image: establishing wide, opposite corner/alternate approach, reverse, left, right, entrance/arrival, elevated overview, primary feature, and detail. Interior/Exterior adapts the geography. Stay near reference favors supported geography and partial reverse views; Explore unseen space permits conservative inference. Unseen areas are inferred, not verified. Location uses its own scouting presets, independently of the retained Subject method. Settings persist with the node; old workflows default to Subject. Existing checkpoint, Stop, history, and result routing remain shared.

Utility Coverage accepts optional Style, Mood Board, and locked active Character inputs in both Subject and Location modes. Every shot includes the existing Style/grade instructions, Mood Board treatment prompt and image, and active Character sheet and identity/wardrobe instructions. Style overrides conflicting Mood Board treatment; the base image owns geography and the Coverage preset owns camera composition. Connecting Characters permits talent in Location scouting and replaces conflicting source identity without copying sheet backgrounds/layouts. Without optional inputs, existing prompts and references are preserved. These ports use stable styleIn/transferIn/characterIn ids and remain available when the Image drawer is collapsed.

Preview Layout tiles drag before or after another tile with a visible insertion edge, retaining order through save/reopen and export. Dragging a tile onto the canvas creates a media node using its full-resolution asset while preserving the Layout item. Double-click opens a Layout-scoped gallery; Left/Right wraps through images and videos in current layout order, preserving each image's own edit context. Typing/editing shortcuts retain their existing guards.

Style includes Found Footage: the shared prompt preset describes consumer camcorder/VHS/body-cam capture, first-person handheld composition, available light, limited dynamic range, analog video artifacts, and recording imperfections. Recording icons and timestamps are excluded unless requested. It uses the existing Style prompt path across connected consumers.
