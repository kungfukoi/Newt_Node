import { characterDefaultWardrobeId } from "./characterSheetLibrary.js";
import { normalizeCharacterSheetModel } from "./characterSheetModels.js";

export const characterBaseSheetPromptVersion = 2;
export const characterVideoSheetPromptVersion = 5;
export const characterWardrobeEditVersion = 3;

export const characterSheetPrompt =
  "Make one image:\n\nStudy the reference image of the character and preserve the person's identity, physical features, proportions, image quality, and visual style as closely as possible.\n\nCreate one high-resolution horizontal character photo sheet on a clean white background. The final image must contain exactly six panels and exactly six total depictions of the same character. Follow this fixed layout precisely:\n- On the left side, place two tall vertical full-body panels side by side: one full body front view, then one full body side profile.\n- On the right side, place four equal 1:1 square face close-up panels in a clean 2 by 2 grid: top left is a left side face profile, top right is a right side face profile, bottom left is a front face portrait with a resting neutral expression, and bottom right is a front face portrait with a natural talking expression with the mouth slightly open.\n\nEach panel must contain exactly one view only. Keep the grid clean, evenly spaced, and clearly separated by simple white spacing. Do not generate any additional views, duplicate depictions, merged two-in-one panels, alternate variations, split sheets, comparison images, multiple sheets, text, labels, props, frames, or borders.";

export const cinematicCharacterSheetPrompt =
  "Make one image:\n\nStudy the reference image of the character and preserve the person's identity, physical features and proportions as closely as possible. It's important the image is realistic with natural skin texture and natural skin tones. Preserve only the skin detail and texture naturally visible in the reference image, with subtle tonal variation, natural translucency, and restrained matte-to-satin highlights. Do not invent, exaggerate, sharpen, or outline pores, wrinkles, blemishes, facial lines, or other skin features that are not clearly present in the reference. Skin must not look plastic, waxy, airbrushed, porcelain, oily, overly smooth, glossy, synthetic, or digitally retouched. Avoid excessive specular highlights, HDR sheen, beauty-filter smoothing, and CG skin texture. High-end cinematic still frame, shot on ARRI Alexa 35, high quality prime lens, high dynamic range, shallow depth of field, atmospheric cinematography, subtle halation, very gentle lens bloom that does not soften identity-defining detail, fine film grain, realistic lens softness, very slight atmospheric haze, imperfect real-camera texture, high production value, feature film look.\n\nThe final image must contain exactly six panels and exactly six total depictions of the same character placed on the same solid gray background. Follow this fixed layout precisely:\n- On the left side, place two tall vertical full-body panels side by side: one full body front view, then one full body side profile.\n- On the right side, place four equal 1:1 square face close-up panels in a clean 2 by 2 grid: top left is a left side face profile, top right is a right side face profile, bottom left is a front face portrait with a resting neutral expression, and bottom right is a front face portrait with a natural talking expression with the mouth slightly open.\n\nEach panel must contain exactly one view only. Keep the grid clean, evenly spaced, and clearly separated by simple white spacing. Do not generate any additional views, duplicate depictions, merged two-in-one panels, alternate variations, split sheets, comparison images, multiple sheets, text, labels, props, frames, or borders.";

export const cinematicCharacterSheetBackgroundPrompt =
  "CINEMATIC GRAY CYC BACKGROUND: Use exactly one consistent realistic neutral-gray seamless studio cyclorama in every panel. Show a softly illuminated continuous floor-to-wall sweep with gentle natural tonal falloff and grounded contact shadows, but no visible corner, hard horizon line, room architecture, texture, pattern, props, scenery, or environmental details. Keep the background neutral gray—not white, black, transparent, colored, or cut out—and preserve clean panel separation.";

export const stylizedCharacterSheetPrompt = `Make one image:

STRICT CHARACTER DESIGN LOCK: Treat the Original Character Portrait as the sole authority for the character's design. Reproduce that same character; do not reinterpret it as a human or as a more realistic, conventional, mature, idealized, or anatomically normalized version.

Preserve the exact silhouette and the relative proportions of every visible form. Preserve the presence or absence, count, shape, scale, placement, spacing, and relationships of every identity-defining feature. Preserve the source character's surface materials, textures, colors, patterns, translucency, reflectivity, wear, construction, and rendering style. A feature that exists in the reference must remain; a feature that is absent must not be invented. Do not add, remove, replace, resize, reposition, or redesign features merely to make the character look more human, realistic, attractive, or anatomically familiar. Do not invent human skin, musculature, bone structure, facial anatomy, or human proportions that are not present in the reference.

Create one high-resolution horizontal character sheet on a clean white background. The final image must contain exactly six panels and exactly six total depictions of the same character. Follow this fixed layout precisely:
- On the left side, place two tall vertical full-character panels side by side: one complete front view, then one complete side profile. Preserve the character's original full silhouette, scale relationships, and proportions in both panels.
- On the right side, place four equal 1:1 square close-up panels in a clean 2 by 2 grid. Use the character's primary head or identity region without inventing human anatomy: top left is a left-side view, top right is a right-side view, bottom left is a front view in the character's neutral or resting state, and bottom right is a front view with a natural alternate or speaking state only when the existing design supports it. Use only the expressive features already present in the reference; if the design has no conventional face, eyes, nose, ears, hair, or mouth, do not add them.

Each panel must contain exactly one view only. Keep the grid clean, evenly spaced, and clearly separated by simple white spacing. Do not generate additional views, duplicate depictions, merged two-in-one panels, alternate character designs, split sheets, comparison images, multiple sheets, text, labels, props, frames, or borders. The required view and panel layout may change the pose and orientation only; it must not change the character design.`;

export const cinematicCharacterSheetWithGrayCycPrompt =
  `${cinematicCharacterSheetPrompt}\n\n${cinematicCharacterSheetBackgroundPrompt}`;

export const stylizedCinematicCharacterSheetPrompt =
  `${stylizedCharacterSheetPrompt.replace(
    "on a clean white background",
    "on a realistic neutral-gray seamless studio cyclorama background"
  )}\n\n${cinematicCharacterSheetBackgroundPrompt}`;

export const characterNeutralBaseWardrobePrompt =
  "Foundation wardrobe rule: create the identity master without a designed wardrobe. Dress the character only in a minimal, seamless, form-fitting matte charcoal reference bodysuit with no styling, branding, patterns, accessories, jewelry, outerwear, layers, or fashion details. Keep this same neutral reference garment in every panel. This is an anatomy and identity foundation, not a wardrobe look. No nudity.";

export const stylizedCharacterBaseAppearancePrompt =
  "Foundation appearance rule: preserve the character exactly as shown in the Original Character Portrait, including its existing silhouette, proportions, feature inventory, surfaces, materials, textures, colors, construction, and visible wardrobe or integrated coverings. Do not replace the source appearance with a generic bodysuit, human body, exposed anatomy, or newly designed base layer. Treat ambiguous clothing, armor, plating, fur, scales, skin, shells, mechanical parts, painted surfaces, and integrated accessories as part of the character identity and preserve them. This is the locked identity master; later wardrobe edits may change only clearly requested removable clothing.";

export const characterVideoNeutralBaseWardrobePrompt =
  "Foundation wardrobe rule: create the identity master without a designed wardrobe. Use one minimal, seamless, form-fitting matte charcoal reference bodysuit wherever clothing is visible within the existing panel crops. Do not reframe a close-up to show the garment. Do not add styling, branding, patterns, accessories, jewelry, outerwear, layers, or fashion details. This is an identity and body-proportion reference, not a wardrobe look. No nudity.";

export const stylizedCharacterVideoBaseAppearancePrompt =
  "Foundation appearance rule: preserve the exact source character and its existing visible wardrobe or integrated coverings in every panel. Preserve the original silhouette, proportions, feature presence or absence, surfaces, materials, textures, colors, construction, and rendering style. Do not replace the source appearance with a generic bodysuit, human body, exposed anatomy, or newly designed base layer. Reframing for the required panels must not redesign the character.";

export const characterVideoIdentityContinuityPrompt =
  "Identity continuity rule: the Original Character Portrait image is the primary authority for the finished character's facial identity, facial structure, complexion, hair, age, body proportions, recognizable features, and visual treatment. Do not average, reinterpret, replace, beautify, or create a new likeness.";

export const stylizedCharacterIdentityContinuityPrompt =
  "Strict identity continuity rule: the Original Character Portrait is the sole authority for the finished character design. Preserve the exact presence or absence, count, shape, scale, placement, spacing, and relationships of every feature, together with the original silhouette, proportions, surfaces, materials, textures, colors, and rendering style. Do not humanize, anatomically normalize, beautify, mature, or substitute the design. Never add a feature that is absent or remove a feature that is present.";

export const characterWardrobeEditPrompt = `Edit the provided Base Identity Character Sheet. Treat that first image as the locked master image and preserve its exact canvas dimensions, panel layout, dividers, background, crop, camera views, poses, eyelines, facial identity, hair, skin, anatomy, body proportions, expressions, lighting, color treatment, texture, and image quality.

Change only the character's clothing, footwear, and requested wearable accessories. Study the selected wardrobe reference and transfer only its garments, materials, colors, construction, fit, footwear, and styling onto the locked character. Ignore every person, face, body, pose, environment, background, text, label, and unrelated object in the wardrobe reference. The Base Identity Character Sheet remains the sole authority for identity, anatomy, composition, and rendering.

Apply exactly one consistent wardrobe across all six views, including any clothing visible near the neckline in close-up panels. Replace the neutral charcoal reference bodysuit completely where clothing should appear. Return one complete, seamless sheet with naturally connected heads, necks, shoulders, and clothing, never an isolated edit patch or pasted face cutouts. Do not redesign, reframe, relight, retouch, beautify, or regenerate any other part of the sheet. Do not add alternate outfits, comparisons, labels, text, borders, or extra views.`;

export const characterVideoWardrobeEditPrompt = `Edit the provided Base Identity CU Video Sheet. Treat that first image as the pixel-locked master composition and preserve its exact canvas dimensions, three-panel layout, dividers, background, crop, camera views, body positions, portrait pose, eyeline, facial identity, hair, skin, anatomy, body proportions, expression, lighting, color treatment, texture, and image quality.

The reference labeled Original Character Portrait is the sole authority for facial identity and recognizable likeness. The Base Identity CU Video Sheet is the sole authority for layout, composition, camera framing, crop, pose, anatomy, and rendering. The reference labeled Matching Full Character Sheet is supporting evidence for the finished wardrobe and identity only. It is not a layout, framing, crop, pose, or camera reference. Ignore its panel arrangement and any visible heads in its body views.

Hard crop lock: preserve the two left body panels exactly as they appear in the Base Identity CU Video Sheet. Their top panel boundaries must continue to intersect the character at the base of the neck immediately above the clavicles. The chin, face, ears, hair, and entire head must remain physically above and completely outside both left panel boundaries. Never zoom out, extend either body panel upward, shrink the body, or add a head to either body panel. The large portrait on the right is the only panel where the character's head or face may be visible.

Change only the character's clothing, footwear, and requested wearable accessories. Study the selected wardrobe reference and transfer only its garments, materials, colors, construction, fit, footwear, and styling onto the locked character. Ignore every person, face, body, pose, environment, background, text, label, and unrelated object in the wardrobe reference.

Apply exactly one consistent wardrobe to both body panels and the visible neckline of the portrait. Replace the neutral charcoal reference bodysuit completely where clothing should appear. Return the complete, seamless CU Video Sheet with the original panel crops and natural transitions between skin and clothing, never an isolated edit patch or pasted face cutouts. Do not redesign, reframe, relight, retouch, beautify, or regenerate any other part of the sheet. Do not add alternate outfits, comparisons, labels, text, borders, or extra views.`;

export const stylizedCharacterWardrobeEditPrompt = `Edit the provided Base Identity Character Sheet. Treat that first image as a pixel-locked master for every part of the image except the removable wardrobe regions that must change. Preserve the exact canvas dimensions, six-panel layout, dividers, background, crops, camera views, poses, orientation, silhouette, proportions, feature inventory, expression, lighting, surface materials, textures, colors, construction, rendering style, and image quality.

OUTPUT INTEGRITY: Return one complete unobstructed sheet. Do not cover any panel with black or white bars, rectangles, blocks, bands, opaque overlays, blank areas, or other geometric occlusions.

STRICT CHARACTER DESIGN LOCK: preserve the presence or absence, count, shape, scale, placement, spacing, and relationships of every identity-defining feature. Do not add, remove, replace, resize, reposition, humanize, anatomically normalize, beautify, mature, or redesign any feature. Do not invent human skin, anatomy, proportions, or facial structure that is absent from the Base Identity Character Sheet.

Change only clearly removable clothing, footwear, and specifically requested wearable accessories. Study the selected wardrobe reference and transfer only its garments, materials, colors, construction, fit, footwear, and styling onto the locked character. Ignore every person, creature, body, face, pose, environment, background, text, label, and unrelated object in the wardrobe reference. The Base Identity Character Sheet remains the sole authority for the character's identity, anatomy, proportions, surfaces, composition, and rendering.

Apply exactly one consistent wardrobe across all six views, including any clothing visible near the primary identity close-ups. Fit the wardrobe to the character's existing form without changing that form. Do not reinterpret an intrinsic surface or integrated body component as clothing. Do not redesign, reframe, relight, retouch, or regenerate any other part of the sheet. Do not add alternate outfits, comparisons, labels, text, borders, or extra views.`;

export const stylizedCharacterVideoWardrobeEditPrompt = `Edit the provided Base Identity CU Video Sheet. Treat that first image as a pixel-locked master for every part of the image except the removable wardrobe regions that must change. Preserve its exact canvas dimensions, three-panel layout, dividers, background, crop boundaries, camera views, body positions, portrait pose, orientation, silhouette, proportions, feature inventory, expression, lighting, surface materials, textures, colors, construction, rendering style, and image quality.

OUTPUT INTEGRITY: Return one complete unobstructed sheet. Do not cover any panel with black or white bars, rectangles, blocks, bands, opaque overlays, blank areas, or other geometric occlusions.

The Original Character Portrait is the sole authority for the character's identity and exact design. The Base Identity CU Video Sheet is the sole authority for layout, composition, framing, crop, pose, proportions, and rendering. A Matching Full Character Sheet is supporting evidence for the requested wardrobe and identity only; ignore its panel arrangement, crops, poses, and framing.

STRICT CHARACTER DESIGN LOCK: preserve the presence or absence, count, shape, scale, placement, spacing, and relationships of every identity-defining feature. Do not add, remove, replace, resize, reposition, humanize, anatomically normalize, beautify, mature, or redesign any feature. Do not invent human skin, anatomy, proportions, or facial structure that is absent from the locked references.

Hard crop lock: preserve both left-panel crop boundaries exactly as they appear in the Base Identity CU Video Sheet. Keep the character's primary head or identity region completely outside both left panels, exactly as established by the base sheet. Never zoom out, extend either body panel upward, shrink or reshape the character, or add a head or identity region to either left panel. The large panel on the right is the only panel where the primary head or identity region may be visible.

Change only clearly removable clothing, footwear, and specifically requested wearable accessories. Transfer only the selected wardrobe reference's garments, materials, colors, construction, fit, footwear, and styling. Ignore every person, creature, body, face, pose, environment, background, text, label, and unrelated object in that reference. Fit the wardrobe to the existing character form without changing it, and do not reinterpret an intrinsic surface or integrated body component as clothing.

Apply exactly one consistent wardrobe to both body panels and any visible wardrobe area in the right portrait. Do not redesign, reframe, relight, retouch, or regenerate any other part of the sheet. Do not add alternate outfits, comparisons, labels, text, borders, or extra views.`;

export const cinematicCharacterSheetBackgroundContinuityPrompt =
  "CINEMATIC GRAY CYC CONTINUITY: Preserve the same realistic neutral-gray seamless studio cyclorama in every panel, including its soft floor-to-wall sweep, neutral exposure, gentle tonal falloff, and grounded contact shadows. Do not replace any part of it with white, black, transparency, a colored backdrop, geometric occlusions or bars, scenery, or a different environment.";

export const stylizedCharacterDownstreamPrompt =
  "Strict character design lock: preserve the exact presence or absence, count, shape, scale, placement, spacing, and relationships of every identity-defining feature, together with the reference silhouette, proportions, surface materials, textures, colors, construction, and rendering style. Do not humanize, anatomically normalize, beautify, mature, or substitute the design. Never add a feature that is absent or remove a feature that is present.";

export function characterBaseSheetPromptForData(data = {}) {
  if (data.stylizedCharacter) {
    return data.cinematicCharacterSheet ? stylizedCinematicCharacterSheetPrompt : stylizedCharacterSheetPrompt;
  }
  return data.cinematicCharacterSheet ? cinematicCharacterSheetWithGrayCycPrompt : characterSheetPrompt;
}

export function characterBaseAppearancePromptForData(data = {}) {
  return data.stylizedCharacter ? stylizedCharacterBaseAppearancePrompt : characterNeutralBaseWardrobePrompt;
}

export function characterVideoBaseAppearancePromptForData(data = {}) {
  return data.stylizedCharacter ? stylizedCharacterVideoBaseAppearancePrompt : characterVideoNeutralBaseWardrobePrompt;
}

export function characterVideoIdentityContinuityPromptForData(data = {}) {
  return data.stylizedCharacter ? stylizedCharacterIdentityContinuityPrompt : characterVideoIdentityContinuityPrompt;
}

export function characterWardrobeEditPromptForData(data = {}, sheetKind = "image") {
  const prompt = sheetKind === "video"
    ? data.stylizedCharacter ? stylizedCharacterVideoWardrobeEditPrompt : characterVideoWardrobeEditPrompt
    : data.stylizedCharacter ? stylizedCharacterWardrobeEditPrompt : characterWardrobeEditPrompt;
  return data.cinematicCharacterSheet
    ? `${prompt}\n\n${cinematicCharacterSheetBackgroundContinuityPrompt}`
    : prompt;
}

export function characterBaseGenerationSignature(data = {}) {
  const portraitUrl = data.characterPortrait?.localUrl || data.characterPortrait?.url || "";
  const stylized = Boolean(data.stylizedCharacter);
  const cinematic = Boolean(data.cinematicCharacterSheet);
  return JSON.stringify({
    version: characterBaseSheetPromptVersion,
    portraitUrl,
    model: normalizeCharacterSheetModel(data.characterSheetModel),
    cinematic,
    ...(cinematic ? { cinematicBackgroundVersion: 2 } : {}),
    stylized,
    physicalDetails: String(data.characterPhysicalDetails || "").trim()
  });
}

export function characterBaseVideoGenerationSignature(data = {}) {
  const cinematic = Boolean(data.cinematicCharacterSheet);
  return JSON.stringify({
    version: characterVideoSheetPromptVersion,
    portraitUrl: data.characterPortrait?.localUrl || data.characterPortrait?.url || "",
    model: normalizeCharacterSheetModel(data.characterSheetModel),
    ...(cinematic ? { cinematic: true, cinematicBackgroundVersion: 2 } : {}),
    stylized: Boolean(data.stylizedCharacter),
    physicalDetails: String(data.characterPhysicalDetails || "").trim()
  });
}

export function characterBaseVariant({ baseSheet, baseVideoSheet = null, baseSignature = "" } = {}) {
  if (!baseSheet?.url && !baseSheet?.localUrl) return null;
  return {
    wardrobeId: characterDefaultWardrobeId,
    wardrobeUrl: "",
    wardrobeFileName: "Base Identity",
    baseSignature,
    isBase: true,
    generated: baseSheet,
    ...(baseVideoSheet?.url || baseVideoSheet?.localUrl ? { videoGenerated: baseVideoSheet } : {})
  };
}

export async function generateCharacterBaseSheets({
  baseSheet = null,
  baseVideoSheet = null,
  baseSignature = "",
  baseVideoSignature = "",
  includeVideo = false,
  generateBase,
  generateVideo,
  onCheckpoint,
  onGenerationComplete = () => {}
}) {
  const checkpoint = () => onCheckpoint?.({
    characterBaseSheet: baseSheet,
    characterBaseSignature: baseSignature,
    characterBaseVideoSheet: baseVideoSheet,
    characterBaseVideoSignature: baseVideoSheet ? baseVideoSignature : ""
  });
  if (!(baseSheet?.url || baseSheet?.localUrl)) {
    baseSheet = await generateBase();
    await checkpoint();
    onGenerationComplete();
  }
  if (includeVideo && !(baseVideoSheet?.url || baseVideoSheet?.localUrl)) {
    baseVideoSheet = await generateVideo();
    await checkpoint();
    onGenerationComplete();
  }
  return { baseSheet, baseVideoSheet, baseVideoSignature: baseVideoSheet ? baseVideoSignature : "" };
}

export function characterWardrobeVariantIsCurrent(
  variant,
  wardrobe,
  baseSignature = "",
  { requireVideo = false, baseVideoSignature = "" } = {}
) {
  const wardrobeUrl = wardrobe?.localUrl || wardrobe?.url || "";
  if (!variant || variant.wardrobeId !== wardrobe?.id) return false;
  if ((variant.wardrobeUrl || "") !== wardrobeUrl) return false;
  if (variant.wardrobeEditVersion !== characterWardrobeEditVersion) return false;
  if (requireVideo) {
    if (!(variant.videoGenerated?.url || variant.videoGenerated?.localUrl)) return false;
    if (baseVideoSignature) return variant.baseVideoSignature === baseVideoSignature;
    return Boolean(variant.baseSignature && variant.baseSignature === baseSignature);
  }
  return Boolean(
    (variant.generated?.url || variant.generated?.localUrl)
    && variant.baseSignature
    && variant.baseSignature === baseSignature
  );
}

export function upsertCharacterWardrobeVariant(variants = [], nextVariant) {
  const withoutVariant = (Array.isArray(variants) ? variants : []).filter(
    (variant) => variant?.wardrobeId !== nextVariant?.wardrobeId
  );
  if (!nextVariant?.wardrobeId) return withoutVariant;
  const base = withoutVariant.filter((variant) => variant?.wardrobeId === characterDefaultWardrobeId);
  const wardrobes = withoutVariant.filter((variant) => variant?.wardrobeId !== characterDefaultWardrobeId);
  return nextVariant.wardrobeId === characterDefaultWardrobeId
    ? [nextVariant, ...wardrobes]
    : [...base, ...wardrobes, nextVariant];
}
