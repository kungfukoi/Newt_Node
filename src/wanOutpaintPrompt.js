import { outpaintReferenceAppearanceRule, outpaintSourceColorRule } from "./outpaintContext.js";
import { outpaintFrameOneRule, fullFrameScene } from "./outpaintFrameOne.js";
// VACE conditions on a completed-scene caption, rather than Seedance media tags.
export function wanOutpaintPrompt(prompt, plan, referenceImageCount = 0) {
  const scene = String(prompt || "").replace(/@Video\d+\b/g, "the source footage").replace(/@Image\d+\b/g, "the reference image").trim();
  return [
    fullFrameScene(scene),
    ...(referenceImageCount > 0 ? [outpaintReferenceAppearanceRule] : []),
    "The entire scene is already present from frame one and remains complete in every frame. Only the source action and camera motion continue; the surrounding scene follows their coherent motion and parallax.",
    outpaintSourceColorRule,
    outpaintFrameOneRule
  ].join("\n\n");
}

export function wanOutpaintNegativePrompt(value) {
  return ["letterboxing, borders, black bars, gray unfilled regions, transition, reveal, fade-in, fade-out, dissolve, wipe, iris wipe, curtain opening, moving black bars, shrinking black bars, sliding black bars, animated bar removal, delayed extension, progressive filling, drawing animation", String(value || "").trim()].filter(Boolean).join(", ");
}
