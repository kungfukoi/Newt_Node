import test from "node:test";
import assert from "node:assert/strict";
import {
  coverageMethods,
  coveragePresets,
  coveragePreviewItems,
  coverageShotsForMethod,
  normalizeCoverageMethod
} from "../src/coveragePresets.js";

test("Coverage exposes the three expected methods", () => {
  assert.deepEqual(coverageMethods, ["Standard", "Dynamic", "Insane"]);
  assert.equal(normalizeCoverageMethod("Dynamic"), "Dynamic");
  assert.equal(normalizeCoverageMethod("Unknown"), "Standard");
});

test("each Coverage method builds nine distinct camera prompts", () => {
  coverageMethods.forEach((method) => {
    const shots = coverageShotsForMethod(method);
    assert.equal(coveragePresets[method].length, 9);
    assert.equal(shots.length, 9);
    assert.equal(new Set(shots.map((shot) => shot.id)).size, 9);
    assert.equal(new Set(shots.map((shot) => shot.label)).size, 9);
    assert.equal(new Set(shots.map((shot) => shot.prompt)).size, 9);
    shots.forEach((shot) => {
      assert.match(shot.prompt, /provided image as the base image/i);
      assert.match(shot.prompt, /Change only the camera angle/i);
    });
  });
});

test("Coverage preview items keep each generation as a unique layout source", () => {
  const items = coveragePreviewItems([
    { url: "/outputs/coverage-01.png", sourceUrl: "/uploads/base.png" },
    { url: "/outputs/coverage-02.png", sourceUrl: "/uploads/base.png" }
  ]);

  assert.deepEqual(items.map((item) => item.sourceUrl), [
    "/outputs/coverage-01.png",
    "/outputs/coverage-02.png"
  ]);
});

test("Insane frame eight uses the high-angle macro extreme close-up direction", () => {
  const frameEight = coverageShotsForMethod("Insane")[7];
  assert.equal(frameEight.label, "Dutch-Angle High Macro Extreme Close-Up");
  assert.match(frameEight.prompt, /Dutch-angled high macro extreme close-up shot/i);
  assert.match(frameEight.prompt, /macro probe lens/i);
});

test("Standard frame nine uses the eye-level 85mm extreme close-up direction", () => {
  const frameNine = coverageShotsForMethod("Standard")[8];
  assert.equal(frameNine.label, "Extreme Close-Up");
  assert.match(frameNine.prompt, /extreme close-up with an 85mm lens at eye level/i);
  assert.match(frameNine.prompt, /Standard film blocking technique/i);
});

test("Standard frame one uses the low upward camera direction", () => {
  const frameOne = coverageShotsForMethod("Standard")[0];
  assert.equal(frameOne.label, "Worm's Eye View");
  assert.match(frameOne.prompt, /true Warm's Eye View/i);
  assert.match(frameOne.prompt, /camera positioned low, pointing up from the ground/i);
  assert.doesNotMatch(frameOne.prompt, /directly below the subject/i);
});

test("Location scouting preserves geography and adapts interior/exterior views", () => {
  for (const coverageLocationType of ["Interior", "Exterior"]) {
    const shots = coverageShotsForMethod("Insane", { coverageSubject: "Location", coverageLocationType });
    assert.equal(shots.length, 9);
    assert.equal(new Set(shots.map(shot => shot.prompt)).size, 9);
    for (const shot of shots) {
      assert.match(shot.prompt, /Move the camera rather than rearranging/);
      assert.match(shot.prompt, /Do not add people/);
      assert.match(shot.prompt, /Stay close to the visible reference geography/);
      assert.doesNotMatch(shot.prompt, /same pose|same eyeline|Drastically break/);
    }
    assert.match(shots[1].label, coverageLocationType === "Interior" ? /Opposite-Corner/ : /Alternate Approach/);
    assert.match(shots[6].prompt, coverageLocationType === "Interior" ? /below its ceiling/ : /nearby terrain/);
  }
});

test("Location exploration is explicit and legacy subject methods remain unchanged", () => {
  const data = { coverageSubject: "Location", coverageExploration: "Explore unseen space" };
  const shots = coverageShotsForMethod("Standard", data);
  assert.match(shots[2].prompt, /Explore unseen areas/);
  assert.doesNotMatch(shots[2].prompt, /Stay close to the visible reference geography/);
  assert.deepEqual(coverageShotsForMethod("Dynamic", { coverageSubject: "invalid" }), coverageShotsForMethod("Dynamic"));
  assert.deepEqual(coverageShotsForMethod("Insane", data), shots);
  assert.deepEqual(coverageShotsForMethod("Standard", JSON.parse(JSON.stringify(data))), shots);
});

test("Coverage input policy keeps old prompts and resolves optional input conflicts", async () => {
  const { coveragePromptForInputs } = await import("../src/coveragePresets.js");
  for (const coverageSubject of ["Subject", "Location"]) {
    const shot = coverageShotsForMethod("Standard", { coverageSubject })[0];
    assert.equal(coveragePromptForInputs(shot), shot.prompt);
    const styled = coveragePromptForInputs(shot, { hasStyle: true, hasMoodBoard: true });
    assert.match(styled, /Explicit Style instructions take precedence/);
    assert.match(styled, /Mood Board imagery is treatment reference only/);
    const cast = coveragePromptForInputs(shot, { hasCharacters: true });
    assert.doesNotMatch(cast, /Do not add people|without talent/);
    assert.match(cast, /identity and selected wardrobe only/);
    assert.match(cast, /Preserve existing blocking/);
    if (coverageSubject === "Location") assert.match(styled, /Do not add people/);
  }
});
