import { activeCharacterSheetVariant } from "./characterSheetLibrary.js";
import { cinematicCharacterSheetBackgroundPrompt } from "./characterSheetWorkflow.js";

export const characterVideoSheetPrompt = `Edit the provided Portrait image into one CU video reference sheet:

Study the reference image of the character and preserve the person's identity, physical features, body proportions, and selected wardrobe as closely as possible. The result must look realistic and authentic, with natural skin texture, true-to-life skin tones, fine detail, subtle film grain, and restrained cinematic finishing. Photograph the character with the appearance of a real cinema camera and a high-quality 35mm prime lens, high dynamic range, natural lens softness, and feature-film production quality.

Create one clean character reference sheet containing exactly three panels and exactly three depictions of the same character on a consistent neutral studio background.

Follow this layout precisely:

- On the left, place two tall vertical wardrobe-reference panels side by side.
- The first panel shows the character's selected wardrobe from the front, framed cleanly from the base of the neck through the feet.
- The second panel shows the same selected wardrobe from the back, framed cleanly from the base of the neck through the feet.
- In both wardrobe panels, crop the composition at the base of the neck so the head is entirely outside the frame. Do not erase, detach, or distort the head or neck.
- Preserve the exact clothing, footwear, fit, materials, proportions, and wardrobe details across both views.

- On the right, place one large 1:1 square close-up portrait of the character.
- Use a subtle three-quarter portrait: rotate the head approximately 15 degrees away from the camera while keeping both eyes visible.
- Direct the eyes slightly off camera in the same straight on direction. The character must not look into the lens.
- Use a natural mid-speech expression with the mouth slightly open, relaxed facial muscles, and no exaggerated emotion.
- Preserve the character's identity precisely, including facial structure, hair, complexion, and defining physical features.

Each panel must contain exactly one view. Keep the layout clean, evenly spaced, and separated by very narrow white dividers. Do not generate additional views, duplicate characters, merged panels, comparison sheets, alternate wardrobes, text, labels, props, decorative frames, or borders.`;

export const stylizedCharacterVideoSheetPrompt = `Edit the provided Original Character Portrait into one CU video reference sheet.

STRICT CHARACTER DESIGN LOCK: Treat the Original Character Portrait as the sole authority for the character's design. Reproduce that same character; do not reinterpret it as a human or as a more realistic, conventional, mature, idealized, or anatomically normalized version.

Preserve the exact silhouette and the relative proportions of every visible form. Preserve the presence or absence, count, shape, scale, placement, spacing, and relationships of every identity-defining feature. Preserve the source character's surface materials, textures, colors, patterns, translucency, reflectivity, wear, construction, and rendering style. A feature that exists in the reference must remain; a feature that is absent must not be invented. Do not add, remove, replace, resize, reposition, or redesign features merely to make the character look more human, realistic, attractive, or anatomically familiar. Do not invent human skin, musculature, bone structure, facial anatomy, or human proportions that are not present in the reference.

Create one clean character reference sheet containing exactly three panels and exactly three depictions of the same character on a consistent neutral studio background.

Follow this layout precisely:

- On the left, place two tall vertical full-character wardrobe-reference panels side by side.
- The first panel shows the character from the front, framed from the base of the primary head or identity region through the character's lowest extent.
- The second panel shows the same character from the back with the identical crop and scale.
- In both left panels, keep the primary head or identity region entirely outside the frame. If the character has no conventional head, neck, torso, legs, or feet, preserve its real design and use the equivalent crop boundary without inventing those structures.
- Preserve the exact clothing or integrated coverings, form, materials, proportions, and design details across both views.

- On the right, place one large 1:1 square close-up of the character's primary head or identity region.
- Use a subtle three-quarter orientation, approximately 15 degrees away from the camera, only to the extent that the character's actual design supports that orientation.
- Preserve the existing gaze or attention mechanism. Keep it slightly off camera when applicable; do not add eyes or other gaze features when they are absent.
- Use a natural alternate or speaking state only when the existing design supports it. If there is no mouth or speech mechanism, do not invent one; use only existing expressive features, or keep the established neutral state.
- Preserve the exact identity design, feature geometry, materials, colors, textures, and construction.

Each panel must contain exactly one view. Keep the layout clean, evenly spaced, and separated by very narrow white dividers. Do not generate additional views, duplicate characters, merged panels, comparison sheets, alternate character designs, alternate wardrobes, text, labels, props, decorative frames, or borders. The required panel layout may change view and orientation only; it must not change the character design.`;

export const cinematicCharacterVideoSheetPrompt =
  `${characterVideoSheetPrompt}\n\n${cinematicCharacterSheetBackgroundPrompt}`;

export const stylizedCinematicCharacterVideoSheetPrompt =
  `${stylizedCharacterVideoSheetPrompt}\n\n${cinematicCharacterSheetBackgroundPrompt}`;

export const characterVideoBasicWardrobePrompt =
  "Wardrobe rule: use exactly one outfit across all three panels. Replace the current wardrobe with a minimal form-fitting plain black one-piece wardrobe, consistently represented in both body views and the visible neckline of the portrait. Do not show the original wardrobe, alternate clothing, or a wardrobe comparison. No nudity; editorial fashion styling only.";

export const characterVideoWardrobePrompt =
  "Wardrobe rule: use exactly one outfit across all three panels. Study the selected wardrobe sheet reference and apply only its clothing design, garments, footwear, materials, colors, fit, and styling consistently to the character. If any person, model, face, body, skin, hair, pose, environment, background, text, or unrelated subject appears in the wardrobe reference, ignore it completely. Do not transfer that person's identity, anatomy, facial features, pose, body shape, or composition. The character portrait reference is the only source for character identity. Do not show the basic black outfit, the original wardrobe, alternate clothing, or a wardrobe comparison. No nudity; editorial fashion styling only.";

export const characterVideoCustomSheetWardrobePrompt =
  "Wardrobe rule: preserve exactly the one selected outfit visible in the supplied completed character sheet. Reconstruct its clothing, footwear, fit, materials, colors, and styling consistently in both body panels and the visible neckline of the portrait. Do not introduce alternate clothing or a wardrobe comparison.";

export function characterVideoSheetPromptForData(data = {}) {
  if (data.stylizedCharacter) {
    return data.cinematicCharacterSheet
      ? stylizedCinematicCharacterVideoSheetPrompt
      : stylizedCharacterVideoSheetPrompt;
  }
  return data.cinematicCharacterSheet ? cinematicCharacterVideoSheetPrompt : characterVideoSheetPrompt;
}

export { activeCharacterSheetVariant };

export function characterVideoSheetForNode(node) {
  if (!node?.data?.cuVideoGeneration) return null;
  return activeCharacterSheetVariant(node.data)?.videoGenerated || null;
}

export function preferredCharacterReferenceForVideo(node) {
  const videoSheet = characterVideoSheetForNode(node);
  const videoSheetUrl = videoSheet?.url || videoSheet?.localUrl || "";
  if (videoSheetUrl) return { ...videoSheet, url: videoSheetUrl, usesCuVideoSheet: true };

  const imageSheet = activeCharacterSheetVariant(node?.data)?.generated;
  const fallbackUrl = imageSheet?.url || imageSheet?.localUrl || node?.data?.resultUrl || "";
  return fallbackUrl
    ? { ...(imageSheet || {}), url: fallbackUrl, usesCuVideoSheet: false }
    : null;
}
