import test from "node:test";
import assert from "node:assert/strict";

import { normalizeStylePresetName, styleNodePresetNames, stylePresetNames, stylePresetPrompts } from "../src/modelOptions.js";
import { gradePresetNames, gradePresetPrompts, normalizeGradePresetName } from "../src/colorLook.js";

const addedStylePresetNames = [
  "Cinematic Indie",
  "Cinematic Standard",
  "Cinematic Commercial",
  "Vintage 8mm",
  "UGC Device",
  "Photography Color",
  "Photography B&W",
  "Photography Film",
  "Painterly 3D",
  "80s Animation",
  "90s Animation",
  "Pixel Art"
];

test("Style node options match the upstream order while keeping Found Footage readable", () => {
  assert.deepEqual(styleNodePresetNames, [
    "None", ...addedStylePresetNames, "Storyboard", "Anime", "Claymation", "2D Animation", "3D Animation",
    "Dark as Fuk", "Pop as Fuk", "Sexy as Fuk", "Strange as Fuk"
  ]);
  assert.equal(normalizeStylePresetName("Found Footage"), "Found Footage");
  assert.match(stylePresetPrompts["Found Footage"], /consumer camcorder/);
  assert.equal(normalizeStylePresetName("Vintage 8mm"), "Vintage 8mm");
});

test("new Style Node presets provide complete prompt suffixes", () => {
  for (const presetName of addedStylePresetNames) {
    assert.ok(stylePresetPrompts[presetName].length > 80, `${presetName} should have a complete prompt`);
    assert.match(stylePresetPrompts[presetName], /\.$/);
  }

  assert.match(stylePresetPrompts["UGC Device"], /No foreground phone seen\.$/);
  assert.match(stylePresetPrompts["Pixel Art"], /no anti-aliasing, no text, no watermark\.$/);
});

test("legacy Commercial preset is no longer available", () => {
  assert.equal(stylePresetNames.includes("Commercial"), false);
  assert.equal(Object.hasOwn(stylePresetPrompts, "Commercial"), false);
  assert.equal(stylePresetNames.includes("Cinematic Commercial"), true);
});

test("legacy Cinematic preset is removed and migrates to Cinematic Standard", () => {
  assert.equal(stylePresetNames.includes("Cinematic"), false);
  assert.equal(Object.hasOwn(stylePresetPrompts, "Cinematic"), false);
  assert.equal(normalizeStylePresetName("Cinematic"), "Cinematic Standard");
});

test("Grade choices remain independent from Style choices", () => {
  assert.equal(stylePresetNames.includes("Custom Palette"), false);
  assert.deepEqual(gradePresetNames, [
    "None", "Cool", "Warm", "Refn Beauty", "Spiky Nike", "Vintage Son", "Dusty Brothers",
    "Moody Meadow", "Classy Kubric", "Coney Color", "Custom"
  ]);
  assert.match(gradePresetPrompts.Cool, /COLOR PALETTE:/);
  assert.match(gradePresetPrompts.Warm, /COLOR PALETTE:/);
  assert.equal(normalizeGradePresetName("Unknown"), "None");
});
