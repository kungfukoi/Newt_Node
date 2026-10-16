# Creative Workflows

Audited against checkout `4.5.0-beta.0` on 2026-10-15. This guide covers Director, Storyboard, Character/audio handoff, Style, Coverage, Preview Layout, and shared image adjustments. See the [complete feature reference](features-and-workflows.md) for all nodes and provider routing.

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
| Camcorder | Suspenseful first-person VHS horror, POV flashlight lighting, searching holds, and motivated whip pans into physically staged extreme close-ups. |
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

### Dialogue and character voices

Create speech in **Audio Model**. Choose **Text to Speech** for one voice or **Dialogue and character voices** for ordered speaker rows and pauses. Dialogue mode accepts Character connections for names and ElevenLabs voices; a generated identity sheet is not required for that audio input. Manual rows need a speaker name and voice. Generate and listen to the completed managed audio track before submitting video. Speech generation and video generation are separate paid operations.

For exact speech, connect that Audio Model output (or an uploaded Audio node) to **Video Model → Reference Audio**, choose **Character voices → Exact dialogue audio**, and enable Generate Audio. Use a supported Seedance or MiniMax H3 route with Reference Images rather than Start/End Frames. Exactly one completed audio source drives the words, voices, pacing, and lip sync and is retained in the finished video. Recordings longer than 15 seconds use a managed first-15-second copy; the original stays intact. Choose a video duration long enough for the speech. Visual lip-sync quality depends on the generation model.

The current Video node does not expose the former inline dialogue editor or **Prepare ElevenLabs dialogue** button. Existing saved dialogue data retains compatibility handling; it is not the recommended authoring path.

**Voice samples (model dialogue)** is the alternative when the video model should generate the spoken performance. In Character Build → Voice, select an ElevenLabs voice and explicitly generate its sample, or use uploaded dialogue audio. Connect the locked active Character to the video/directing workflow and select sample mode. Put desired dialogue in scene instructions; the sample is a voice reference and must not be recited. Voice identity and lip sync are model-dependent, and reference count/duration limits still apply. Selecting a voice alone does not generate speech. **Off** disables this handoff.

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

## Style and Mood Board

Style presets are written instructions, not LUTs, image filters, or LoRAs. Style combines a selected visual-treatment prompt with optional Grade instructions. Custom Grade builds its direction from the chosen/extracted palette. Found Footage describes consumer camcorder, body-cam/POV, handheld framing, VHS artifacts, and available-light capture without unrequested recording graphics. Results vary by model.

Mood Board builds a locked visual reference collage. Connect its output where a Mood Board input is offered; its image and treatment instructions guide the result without copying the collage layout. Character sheets supply identity and wardrobe, not the sheet background. Direct Style instructions override conflicting treatment in Director-derived Image Model prompts. A directly connected Camera overrides conflicting camera instructions. Approach is the broader directing plan: Camcorder combines horror pacing, POV flashlight lighting, spatially motivated whip pans and VHS treatment; it does not require the Found Footage Style.

## Coverage and location scouting

1. Add **Utility**, select **Image → Coverage**, and connect the source image.
2. Open Image settings and choose **Coverage: Subject** or **Location**.
3. Subject retains Standard, Dynamic, and Insane nine-shot methods. Location uses its own scouting set; choose Interior/Exterior and Stay near reference or Explore unseen space.
4. Optionally connect Style, a locked Mood Board, and locked active Characters. Each request carries the applicable instructions plus labeled board/character images. The base image owns geography, the Coverage preset owns camera direction, Style takes priority over conflicting board treatment, and Characters own identity/wardrobe. Connected Characters allow talent in Location shots; otherwise Location requests no people.
5. Generate Coverage, then connect the output to Preview and open Layout. Each completed shot is retained immediately, including after partial failure or Stop. The global red X stops new submissions; it does not promise provider cancellation or a refund.

Location's nine views are establishing wide, opposite-corner/alternate approach wide, reverse, left-side, right-side, entrance/arrival, elevated overview, primary feature, and material/detail. Stay near reference favors supported geography and partial reverse views. Explore unseen space permits conservative invention. A single photograph cannot verify hidden geometry; scouting is generative, not a reconstructed 3D survey.

Legacy standalone Coverage nodes still load; new workflows use Utility. Optional Style/Mood Board/Character inputs are a Utility Coverage feature.

## Preview Layout

Connect source results to Preview, then open Layout to collect images/videos. Drag to the left or right half of a tile to insert before or after it; the highlighted edge shows placement. Layout order persists and controls image-export order. Removing a tile hides it from that Layout without deleting the underlying asset.

Drag a tile onto empty canvas to create a matching media node using the full-resolution asset. The Layout copy remains. Double-click a tile to open its gallery; Left/Right wraps through images and videos in the current Layout order. Image editing targets the currently viewed Layout item. Typing and editor shortcut guards remain active. Image tiles show their number without an image badge; video tiles retain a video badge. Resizing preserves the complete image with contain/letterbox behavior.

Export collects Layout images; mixed video tiles are not a rendered movie. Use Timeline for video assembly and export. The project output rail has its own gallery and catalog; it is separate from this Layout order.

## Camcorder Approach

Choose **Director → Approach → Camcorder** before locking Scene Setup. It directs first-person handheld horror with the unseen operator's flashlight as the motivated light, searching holds, hesitant movement, and motivated whip pans into close subjects/details. It preserves scene identity and geography. An extreme close-up needs a nearby subject or an explicit approach; rotation alone does not change distance. VHS texture describes the look, not a forced encoded frame rate. Still remains one drawable instant, and the selected audio policy controls sound. Changing Approach invalidates affected planning stages; rebuild the scene package before downstream use.
