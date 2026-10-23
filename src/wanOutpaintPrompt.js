import { outpaintFrameOneRule } from "./outpaintFrameOne.js";
// VACE conditions on a completed-scene caption, rather than Seedance media tags.
export function wanOutpaintPrompt(prompt, plan) {
  const sides = [plan.top > 0 && "top", plan.top + plan.sourceHeight < plan.height && "bottom", plan.left > 0 && "left", plan.left + plan.sourceWidth < plan.width && "right"].filter(Boolean);
  const scene = String(prompt || "").replace(/@Video\d+\b/g, "the source footage").replace(/@Image\d+\b/g, "the reference image").trim();
  return [
    "A complete, continuous full-frame shot of the same scene as the source footage, with the entire extension already complete at t=0.",
    scene,
    `The environment continues naturally through the ${sides.join(" and ")} outer regions all the way to the canvas edges, with the same perspective, surface detail, lighting and exposure as the adjacent source picture.`,
    "The entire scene is already present from frame one and remains complete in every frame. Only the source action and camera motion continue; the surrounding scene follows their coherent motion and parallax.",
    outpaintFrameOneRule
  ].join("\n\n");
}

export function wanOutpaintNegativePrompt(value) {
  return ["letterboxing, borders, black bars, gray unfilled regions, transition, reveal, fade-in, fade-out, dissolve, wipe, iris wipe, curtain opening, moving black bars, shrinking black bars, sliding black bars, animated bar removal, delayed extension, progressive filling, drawing animation", String(value || "").trim()].filter(Boolean).join(", ");
}
