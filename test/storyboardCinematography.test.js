import test from "node:test";
import assert from "node:assert/strict";
import { storyboardCameraPersonalities, storyboardCameraChoices, normalizeStoryboardCameraPersonality, storyboardCinematographyPlanningPrompt, storyboardCameraRenderingPrompt } from "../src/storyboardCinematography.js";
import { storyboardPlanningSettings, storyboardFrameSchema } from "../src/storyboardWorkflow.js";
import { creativeSchemas } from "../server/creative-llm.js";
import { nodeApi } from "../src/api/newtApi.js";

test("camera personality is separate from story approach, defaults to Expressive and normalizes invalid saved values", () => {
  for (const value of [undefined, null, "invented", "", "toString"]) assert.equal(normalizeStoryboardCameraPersonality(value), "Expressive");
  for (const personality of storyboardCameraPersonalities) {
    assert.equal(storyboardPlanningSettings({ storyboardApproach: "Dialogue", storyboardCameraPersonality: personality }).cameraPersonality, personality);
    assert.equal(storyboardPlanningSettings({ storyboardApproach: "Dialogue", storyboardCameraPersonality: personality }).approach, "Dialogue");
    assert.match(storyboardCinematographyPlanningPrompt(personality), new RegExp(`CAMERA PERSONALITY: ${personality}`));
  }
});


test("cinematography respects story, continuity, revision scope and rendering without requiring effects", () => {
  for (const mode of storyboardCameraPersonalities) {
    const prompt = storyboardCinematographyPlanningPrompt(mode);
    for (const pattern of [/outrank personality/, /Only Auto\/None/, /unless the newest request/, /Do not return extra JSON fields/, /not random angles/, /Dutch roll is not an axis crossing/, /Do not erase a listener/, /Simplify surface detail, not/]) assert.match(prompt, pattern);
  }
  assert.match(storyboardCinematographyPlanningPrompt("Restrained"), /natural perspective and level horizons/);
  assert.match(storyboardCinematographyPlanningPrompt("Bold"), /do not tilt or distort every shot/);
});

test("render directions preserve a chosen shot and only explain optics already selected", () => {
  const frame = { shot: "CU", lens: "18mm", angle: "Dutch Angle", prompt: "The key fills the foreground." };
  const before = structuredClone(frame), prompt = storyboardCameraRenderingPrompt(frame);
  assert.match(prompt, /DUTCH ANGLE: Roll the camera/);
  assert.match(prompt, /Strong foreground enlargement requires a close camera/);
  assert.match(prompt, /Preserve the requested shot size/);
  assert.doesNotMatch(storyboardCameraRenderingPrompt({ lens: "50mm", angle: "None" }), /DUTCH ANGLE:|WIDE LENS:|LONG LENS:/);
  assert.match(storyboardCameraRenderingPrompt({ lens: "120mm" }), /not an automatic request to crop out other required people/);
  assert.deepEqual(frame, before);
});
