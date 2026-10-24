// Positive completed-scene guidance shared by analysis and submission.
export const outpaintFrameOneRule = "FRAME 1 REQUIREMENT: The complete scene is already present from frame one and remains complete throughout the shot. Only the original scene action and camera motion continue. Source framing, subject scale, placement and timing remain consistent; held source frames stay still.";
export function fullFrameScene(prompt) {
  const scene = String(prompt || "").trim();
  return /^full frame\b/i.test(scene) ? scene : `Full frame ${scene || "of the observed scene."}`;
}
