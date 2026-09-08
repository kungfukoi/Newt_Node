# Creative Workflows

This guide covers the current Director, Storyboard, Character, and shared image-adjustment workflow in NewtNode `3.0.0-beta.0`.

## Director

Director builds a reusable scene package containing setup references, style direction, camera direction, scene overview, and an ordered shot list. Its blue output can drive a supported Video Model or Storyboard node.

Director is the visible name used in the interface. Older saved default titles such as `Film Director` load as `Director`; custom node titles are preserved.

### Quick Start

1. Add a Director node.
2. Connect any Character, Location, Props, or Mood Board sources needed by the scene.
3. Choose an Approach and enter the scene direction.
4. Optionally connect a reference Video or Music source and configure how it should be used.
5. Review and lock Setup, Style Direction, Camera Direction, Scene Overview, and Shot List in order.
6. Build the scene.
7. Connect the Director output to a compatible Video Model or to Storyboard.

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

Connected assets receive stable reference tags. The final scene uses only references selected by or named in the active scene rather than forcing every connected asset into every shot.

### Approaches

| Approach | Intended Result |
| --- | --- |
| Cinematic | Grounded live-action direction, restrained coverage, continuity, and motivated camera movement. |
| Vintage | Practical vintage capture with an 8mm-inspired texture and cadence. |
| Animation | Coherent cel, CGI, digital-animation, or motion-graphics treatment. |
| Stop-Motion | Tactile miniature, puppet, or clay treatment with deliberate stepped posing. |
| Commercial | Polished premium advertising, beauty, product, or editorial presentation. |
| Music Video | Stylized performance and music-driven pacing using the connected audio as timing authority. |
| Montage | Distinct economical vignettes joined through deliberate visual and movement matches. |

Music Video requires connected audio and a supported downstream route. Director currently validates music use for Seedance 2.0, Seedance 2.5, and MiniMax H3. Montage can use music when supplied but does not require it.

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

Storyboard can use its own scene description and references or accept a built Director package. When Director is connected, Director controls the scene description, active characters, selected references, and requested shot coverage.

Planning validates the proposed board before replacing visible frames. It checks that every Director cut remains in order, continuous shots receive required progression frames, frame numbers are consecutive, and prompts are nonempty and distinct. A rejected plan leaves the existing board untouched.

Visual QC reports reviewed results normally. If review cannot run, the board is marked **Unreviewed** instead of being treated as a false pass or triggering a destructive retry.

## Character Reliability

Character generation checkpoints its Base Identity and CU Video sheets independently. A successful sheet is retained immediately, so a later failure does not erase completed work. Wardrobe image and CU Video variants are also preserved independently and can be regenerated per wardrobe.

The selected active Character sheet remains the full-resolution identity reference used by Image Model, Video Model, Composer, Director, and Storyboard. Uploaded custom sheets coexist with generated variants.

## Shared Image Adjustments

Preview/Layout and Edit share the same curve, brightness, contrast, and saturation normalization and pixel math. Matching settings should therefore render the same treatment in both surfaces. Preview operations work from a decoded copy and do not overwrite the original full-resolution asset until an explicit edit or export action is performed.

## Troubleshooting

- If a Video Model rejects a Director connection, select a model that supports Director input.
- If Music Video cannot run, connect an Audio node to Music and confirm the chosen downstream model supports reference audio.
- If a stage becomes stale, review the changed dependency and rebuild from that stage rather than recreating the node.
- If Storyboard planning fails validation, the previous frames are intentionally preserved; revise the Director shot list or scene request and run planning again.
