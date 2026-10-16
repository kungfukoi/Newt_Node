import test from "node:test";
import assert from "node:assert/strict";
import { filmDirectorApproachOptions, normalizeFilmDirectorApproach, filmDirectorApproachDirective, filmDirectorSceneRules, filmDirectorDefaultCameraDirection, filmDirectorSceneTreatment, filmDirectorSupportsMusic } from "../src/filmDirectorApproaches.js";
import { filmDirectorStyleDirectionDirective } from "../src/filmDirectorStyle.js";

test("Camcorder is a persistent Approach with POV, flashlight and VHS direction across planning stages", () => {
  assert.ok(filmDirectorApproachOptions.some(option => option.value === "camcorder" && option.label === "Camcorder"));
  assert.equal(normalizeFilmDirectorApproach("Camcorder"), "camcorder");
  assert.equal(normalizeFilmDirectorApproach(JSON.parse(JSON.stringify({ approach: "camcorder" })).approach), "camcorder");
  for (const prompt of [filmDirectorApproachDirective("camcorder"), filmDirectorSceneRules("camcorder"), filmDirectorStyleDirectionDirective("camcorder")]) {
    assert.match(prompt, /first-person/i);
    assert.match(prompt, /flashlight/i);
    assert.match(prompt, /VHS/);
    assert.match(prompt, /audio policy/);
  }
  const camera = filmDirectorDefaultCameraDirection("camcorder");
  assert.match(camera, /whip pans/);
  assert.match(camera, /extreme close-up/);
  assert.match(camera, /pan changes direction, not distance/);
  assert.match(camera, /For Still/);
  assert.match(filmDirectorApproachDirective("camcorder"), /no temporal whip-pan sequence/);
  assert.match(filmDirectorSceneTreatment("camcorder"), /VHS camcorder horror/);
  assert.equal(filmDirectorSupportsMusic("camcorder"), false);
});
