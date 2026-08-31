import assert from "node:assert/strict";
import test from "node:test";

import { filmDirectorUsesReference } from "../src/filmDirectorScenes.js";

test("Film Director treats the only connected location as active when the scene describes its stage", () => {
  assert.equal(filmDirectorUsesReference({
    sceneOverview: "Bob walks onto the Dead Tonight stage and addresses the audience."
  }, {
    tag: "@TalkShowStage_02",
    label: "TalkShowStage_02",
    type: "location",
    categoryCount: 1
  }), true);
});
